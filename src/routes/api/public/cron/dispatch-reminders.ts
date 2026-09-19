import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { categoryMeta, occurrenceAtOrBefore } from "@/lib/ereminder";
import type { Database } from "@/integrations/supabase/types";

/**
 * Scheduled reminder delivery.
 *
 * Called every 10 minutes by pg_cron with the LOVABLE_CRON_SECRET bearer token.
 * Sends each due alert once per occurrence: `last_notified_occurrence_at` is
 * stamped with the reminder's current `due_at`, and because completing a
 * recurring reminder rolls `due_at` forward, the next occurrence re-arms itself.
 *
 * This is in addition to the in-app full-screen alarm, not a replacement.
 */

const BATCH_LIMIT = 200;
/** Extra push-only nudges after the first send, for one unhandled occurrence. */
const MAX_RENOTIFY = 3;
/** Roughly one cron pass apart; the slack absorbs jitter in the schedule. */
const RENOTIFY_GAP_MS = 9 * 60_000;
const HANDLED_STATUSES = ["completed", "acknowledged", "missed"] as const;
/** Never chase a stale occurrence: nudges only run within an hour of due time. */
const RENOTIFY_WINDOW_MS = 60 * 60_000;
/**
 * How late a recomputed occurrence may still be delivered. `due_at` only rolls
 * forward when somebody completes or skips the reminder in the app, so a
 * recurring reminder nobody touches keeps an old `due_at` forever. We derive
 * today's occurrence from the recurrence instead, and only send it if its
 * moment is recent — never a dose time from days ago.
 */
const DUE_GRACE_MS = 2 * 60 * 60_000;

type ReminderCategory = Database["public"]["Enums"]["reminder_category"];

function formatDue(dueAt: string): string {
  return new Date(dueAt).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function offsetLabel(minutes: number): string {
  if (minutes <= 0) return "Due now";
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? "" : "s"} before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"} before`;
  }
  return `${minutes} minutes before`;
}

async function sendWhatsapp(
  phone: string,
  title: string,
  when: string,
): Promise<{ ok: boolean; detail?: string }> {
  const authKey = process.env["MSG91_AUTH_KEY"];
  const integratedNumber = process.env["MSG91_WHATSAPP_NUMBER"];
  if (!authKey || !integratedNumber) return { ok: false, detail: "not_configured" };

  const templateName = process.env["MSG91_WA_REMINDER_TEMPLATE"] ?? "ereminder_alert";
  const namespace = process.env["MSG91_WA_NAMESPACE"];

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: templateName,
        language: { code: "en", policy: "deterministic" },
        ...(namespace ? { namespace } : {}),
        to_and_components: [
          {
            to: [phone.replace(/\D/g, "")],
            components: {
              body_1: { type: "text", value: title.replace(/\s+/g, " ").slice(0, 200) },
              body_2: { type: "text", value: when },
            },
          },
        ],
      },
    },
  };

  try {
    const res = await fetch(
      "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", authkey: authKey },
        body: JSON.stringify(payload),
      },
    );
    const text = await res.text();
    if (!res.ok) return { ok: false, detail: text.slice(0, 200) };
    try {
      const parsed = JSON.parse(text) as { type?: string; message?: string };
      if (parsed.type === "error") return { ok: false, detail: parsed.message ?? "rejected" };
    } catch {
      /* non-JSON success body is fine */
    }
    return { ok: true };
  } catch {
    return { ok: false, detail: "provider_unreachable" };
  }
}

export const Route = createFileRoute("/api/public/cron/dispatch-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const nowIso = new Date().toISOString();
        const summary = { checked: 0, sent: 0, skipped: 0, failed: 0, nagged: 0 };

        /**
         * Durable, per-channel record of every attempt. Server logs expire in
         * hours; these rows are what a later investigation can actually read.
         */
        async function logDelivery(entry: {
          userId: string;
          reminderId: string;
          occurrenceIso: string;
          channel: "push" | "whatsapp" | "email";
          mode: string;
          outcome: "selected" | "accepted" | "failed";
          detail?: string | null;
          target?: string | null;
        }) {
          try {
            await supabaseAdmin.from("reminder_deliveries").insert({
              user_id: entry.userId,
              reminder_id: entry.reminderId,
              occurrence_at: entry.occurrenceIso,
              channel: entry.channel,
              mode: entry.mode,
              outcome: entry.outcome,
              detail: entry.detail ?? null,
              target: entry.target ? entry.target.slice(-12) : null,
            });
          } catch {
            /* bookkeeping must never sink a delivery */
          }
        }

        const { data: alerts, error } = await supabaseAdmin
          .from("reminder_alerts")
          .select(
            "id, user_id, reminder_id, offset_minutes, last_notified_occurrence_at, renotify_count, last_renotified_at, reminders!inner(id, title, category, due_at, recurrence, recurrence_interval_days, completed, medicine_id)",
          )
          .limit(BATCH_LIMIT);


        if (error) {
          return Response.json({ error: "query_failed", detail: error.message }, { status: 500 });
        }

        type AlertRow = NonNullable<typeof alerts>[number];
        type Candidate = { row: AlertRow; mode: "full" | "nag"; occAt: number };

        // "full" = first send for this occurrence (every channel).
        // "nag"  = the occurrence already went out but nobody handled it, so we
        //          repeat the push only — WhatsApp and email stay single-send.
        const candidates: Candidate[] = [];
        for (const row of alerts ?? []) {
          const reminder = row.reminders;
          if (!reminder) continue;
          if (reminder.recurrence === "once" && reminder.completed) continue;
          const dueAt = new Date(reminder.due_at).getTime();
          // The occurrence we are actually delivering, derived from the
          // recurrence — not the stored `due_at`, which is only rolled forward
          // by in-app actions and goes stale on untouched recurring reminders.
          const occAt = occurrenceAtOrBefore(
            dueAt,
            reminder.recurrence,
            reminder.recurrence_interval_days,
            Date.now(),
          );
          const fireAt = occAt - row.offset_minutes * 60_000;
          if (Date.now() < fireAt) continue;
          // A recomputed (rolled) occurrence is only ever sent while it is
          // fresh, so an old reminder never fires at the wrong hour.
          if (occAt !== dueAt && Date.now() - occAt > DUE_GRACE_MS) continue;
          const stamped = row.last_notified_occurrence_at
            ? new Date(row.last_notified_occurrence_at).getTime()
            : null;
          if (stamped === null || stamped !== occAt) {
            candidates.push({ row, mode: "full", occAt });
            continue;
          }
          if ((row.renotify_count ?? 0) >= MAX_RENOTIFY) continue;
          if (Date.now() - occAt > RENOTIFY_WINDOW_MS) continue;
          const lastNag = row.last_renotified_at ? new Date(row.last_renotified_at).getTime() : 0;
          if (Date.now() - lastNag < RENOTIFY_GAP_MS) continue;
          candidates.push({ row, mode: "nag", occAt });
        }

        // One message per reminder occurrence, never one per alert row: a
        // reminder usually has several alerts (e.g. 1 day before + at due time)
        // and once the due moment passes every one of their windows is open.
        // We keep the alert closest to the due time and stamp all the siblings.
        const perReminder = new Map<string, Candidate>();
        for (const candidate of candidates) {
          const key = `${candidate.row.reminder_id}|${candidate.occAt}`;
          const entry = perReminder.get(key);
          if (!entry) {
            perReminder.set(key, { ...candidate });
            continue;
          }
          // A pending first send always wins over a follow-up nudge.
          if (candidate.mode === "full" && entry.mode === "nag") {
            entry.row = candidate.row;
            entry.mode = "full";
            continue;
          }
          if (
            candidate.mode === entry.mode &&
            candidate.row.offset_minutes < entry.row.offset_minutes
          ) {
            entry.row = candidate.row;
          }
        }

        // Drop nags the person already handled. We match on when the row was
        // recorded rather than on `occurrence_at`, because the app stamps an
        // occurrence from its own clock — anything logged since the dose moment
        // means they dealt with it.
        const nagEntries = [...perReminder.entries()].filter(([, e]) => e.mode === "nag");
        if (nagEntries.length) {
          const earliest = Math.min(...nagEntries.map(([, e]) => e.occAt));
          const { data: handled } = await supabaseAdmin
            .from("reminder_occurrences")
            .select("reminder_id, created_at, status")
            .in(
              "reminder_id",
              nagEntries.map(([, e]) => e.row.reminder_id),
            )
            .in("status", [...HANDLED_STATUSES])
            .gte("created_at", new Date(earliest - 5 * 60_000).toISOString());
          const latestHandled = new Map<string, number>();
          for (const occ of handled ?? []) {
            const at = new Date(occ.created_at).getTime();
            const prev = latestHandled.get(occ.reminder_id) ?? 0;
            if (at > prev) latestHandled.set(occ.reminder_id, at);
          }
          for (const [key, entry] of nagEntries) {
            const at = latestHandled.get(entry.row.reminder_id);
            if (at !== undefined && at >= entry.occAt - 5 * 60_000) perReminder.delete(key);
          }
        }

        const batches = [...perReminder.values()];

        summary.checked = batches.length;




        // Cache profile + auth email lookups per owner across the batch.
        const ownerCache = new Map<
          string,
          {
            fullName: string | null;
            phone: string | null;
            phoneVerified: boolean;
            pushEnabled: boolean;
            emailEnabled: boolean;
            email: string | null;
          } | null
        >();

        async function loadOwner(userId: string) {
          if (ownerCache.has(userId)) return ownerCache.get(userId) ?? null;
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("full_name, phone, phone_verified_at, push_enabled, email_enabled")
            .eq("id", userId)
            .maybeSingle();
          if (!profile) {
            ownerCache.set(userId, null);
            return null;
          }
          let email: string | null = null;
          try {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
            const candidate = authUser.user?.email ?? null;
            // Phone-only accounts get an internal shadow email (see shadowEmail()
            // in src/lib/otp.server.ts) — never mail those.
            email =
              candidate && !candidate.toLowerCase().endsWith("@phone.ereminder.app")
                ? candidate
                : null;
          } catch {
            email = null;
          }
          const owner = {
            fullName: profile.full_name,
            phone: profile.phone,
            phoneVerified: Boolean(profile.phone_verified_at),
            pushEnabled: profile.push_enabled,
            emailEnabled: profile.email_enabled,
            email,
          };
          ownerCache.set(userId, owner);
          return owner;
        }

        for (const { row, mode, occAt } of batches) {
          const reminder = row.reminders;
          if (!reminder) continue;
          try {
            const owner = await loadOwner(row.user_id);
            if (!owner) {
              summary.skipped += 1;
              continue;
            }

            const occurrenceIso = new Date(occAt).toISOString();
            const when = formatDue(occurrenceIso);
            const label = offsetLabel(row.offset_minutes);

            let delivered = false;

            if (mode === "full" && owner.pushEnabled && owner.phoneVerified && owner.phone) {
              const wa = await sendWhatsapp(owner.phone, reminder.title, when);
              if (wa.ok) delivered = true;
            }

            if (owner.pushEnabled) {
              try {
                const { sendPushToUser } = await import("@/lib/push.server");
                const push = await sendPushToUser(supabaseAdmin, row.user_id, {
                  title: reminder.title,
                  body: `${label} · ${when}`,
                  path: "/home",
                  dismiss: { reminderId: reminder.id, occurrenceAt: occurrenceIso },
                });
                // Delivery visibility: without this, a silent zero-token or
                // gateway failure is indistinguishable from a successful send.
                console.log(
                  `[cron] push reminder=${row.reminder_id} mode=${mode} sent=${push.sent} failed=${push.failed}`,
                );
                if (push.sent > 0) delivered = true;
              } catch (err) {
                console.error(`[cron] push threw for reminder=${row.reminder_id}: ${String(err)}`);
              }
            }

            if (mode === "full" && owner.emailEnabled && owner.email) {
              try {
                const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
                const result = await sendTemplateEmail("reminder-alert", owner.email, {
                  templateData: {
                    recipientName: owner.fullName ?? undefined,
                    title: reminder.title,
                    category: categoryMeta(reminder.category as ReminderCategory).label,
                    dueAt: when,
                    offsetLabel: label,
                  },
                  idempotencyKey: `reminder-${row.id}-${occurrenceIso}`,
                });
                if (result.sent) delivered = true;
              } catch {
                /* one channel failing must not sink the batch */
              }
            }

            if (!delivered) {
              summary.skipped += 1;
              continue;
            }

            const { error: stampError } = await supabaseAdmin
              .from("reminder_alerts")
              .update(
                mode === "full"
                  ? {
                      last_notified_occurrence_at: occurrenceIso,
                      renotify_count: 0,
                      last_renotified_at: null,
                    }
                  : {
                      renotify_count: (row.renotify_count ?? 0) + 1,
                      last_renotified_at: new Date().toISOString(),
                    },
              )
              // Every alert of this reminder is stamped for this occurrence, so
              // no sibling row can send a second message for the same event.
              .eq("reminder_id", row.reminder_id);
            if (stampError) {
              summary.failed += 1;
              continue;
            }
            if (mode === "nag") summary.nagged += 1;
            else summary.sent += 1;

          } catch {
            summary.failed += 1;
          }
        }

        // Scheduled greetings ride along on this same job so no separate
        // cron schedule (and database wake-up) is needed. A failure here
        // must not sink the reminder summary.
        let greetings: unknown = null;
        try {
          const { dispatchDueGreetings } = await import("@/lib/greetings.dispatch.server");
          greetings = await dispatchDueGreetings(supabaseAdmin);
        } catch {
          greetings = { error: "greetings_dispatch_failed" };
        }

        // Missed medicine doses escalate to the chosen family member on the
        // same schedule. A failure here must not sink the reminder summary.
        let medicines: unknown = null;
        try {
          const { escalateMissedDoses } = await import("@/lib/medicine-escalation.server");
          medicines = await escalateMissedDoses(supabaseAdmin as never);
        } catch {
          medicines = { error: "medicine_escalation_failed" };
        }

        return Response.json({ ok: true, ranAt: nowIso, ...summary, greetings, medicines });
      },
    },
  },
});
