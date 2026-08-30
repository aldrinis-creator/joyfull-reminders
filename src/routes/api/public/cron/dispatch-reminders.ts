import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { categoryMeta } from "@/lib/ereminder";
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
        const summary = { checked: 0, sent: 0, skipped: 0, failed: 0 };

        const { data: alerts, error } = await supabaseAdmin
          .from("reminder_alerts")
          .select(
            "id, user_id, reminder_id, offset_minutes, last_notified_occurrence_at, reminders!inner(id, title, category, due_at, recurrence, completed)",
          )
          .limit(BATCH_LIMIT);

        if (error) {
          return Response.json({ error: "query_failed", detail: error.message }, { status: 500 });
        }

        // Only alerts whose window has opened and that haven't fired for this occurrence.
        const due = (alerts ?? []).filter((row) => {
          const reminder = row.reminders;
          if (!reminder) return false;
          if (reminder.recurrence === "once" && reminder.completed) return false;
          const dueAt = new Date(reminder.due_at).getTime();
          const fireAt = dueAt - row.offset_minutes * 60_000;
          if (Date.now() < fireAt) return false;
          if (!row.last_notified_occurrence_at) return true;
          return new Date(row.last_notified_occurrence_at).getTime() !== dueAt;
        });

        // One message per reminder occurrence, never one per alert row: a
        // reminder usually has several alerts (e.g. 1 day before + at due time)
        // and once the due moment passes every one of their windows is open.
        // We keep the alert closest to the due time and stamp all the siblings.
        const perReminder = new Map<string, { chosen: (typeof due)[number] }>();
        for (const row of due) {
          const key = `${row.reminder_id}|${row.reminders?.due_at}`;
          const entry = perReminder.get(key);
          if (!entry) {
            perReminder.set(key, { chosen: row });
            continue;
          }
          if (row.offset_minutes < entry.chosen.offset_minutes) entry.chosen = row;
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

        for (const { chosen: row } of batches) {
          const reminder = row.reminders;
          if (!reminder) continue;
          try {
            const owner = await loadOwner(row.user_id);
            if (!owner) {
              summary.skipped += 1;
              continue;
            }

            const when = formatDue(reminder.due_at);
            const label = offsetLabel(row.offset_minutes);
            let delivered = false;

            if (owner.pushEnabled && owner.phoneVerified && owner.phone) {
              const wa = await sendWhatsapp(owner.phone, reminder.title, when);
              if (wa.ok) delivered = true;
            }

            if (owner.emailEnabled && owner.email) {
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
                  idempotencyKey: `reminder-${row.id}-${reminder.due_at}`,
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
              .update({ last_notified_occurrence_at: reminder.due_at })
              // Every alert of this reminder is stamped for this occurrence, so
              // no sibling row can send a second message for the same event.
              .eq("reminder_id", row.reminder_id);
            if (stampError) {
              summary.failed += 1;
              continue;
            }
            summary.sent += 1;
          } catch {
            summary.failed += 1;
          }
        }

        return Response.json({ ok: true, ranAt: nowIso, ...summary });
      },
    },
  },
});
