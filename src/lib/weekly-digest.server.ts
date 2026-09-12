import { nextOccurrence, type Reminder } from "@/lib/ereminder";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Weekly "what's coming up this week" digest.
 *
 * Runs once a week (Monday 08:00 IST) from the weekly-digest cron route.
 * Email works today; WhatsApp goes out only once the MSG91 template named by
 * MSG91_WA_DIGEST_TEMPLATE is approved — until then it fails cleanly and the
 * email path is unaffected.
 */

type Admin = SupabaseClient<Database>;

const WINDOW_DAYS = 7;
const PROFILE_BATCH = 500;
/** WhatsApp body variables have real length limits — keep the list tight. */
const WA_MAX_LINES = 5;
const WA_MAX_CHARS = 900;
/** A cron re-run inside the same week must not re-send. */
const MIN_GAP_MS = 6 * 86_400_000;

export interface DigestItem {
  at: Date;
  label: string;
}

function dayLabel(d: Date): string {
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function nextAnnual(dateStr: string, from: Date): Date | null {
  const base = new Date(`${dateStr}T09:00:00+05:30`);
  if (Number.isNaN(base.getTime())) return null;
  const next = new Date(base);
  while (next < from) next.setFullYear(next.getFullYear() + 1);
  return next;
}

function rupees(amount: number): string {
  return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export async function buildDigest(
  admin: Admin,
  userId: string,
  now = new Date(),
): Promise<{ reminders: DigestItem[]; occasions: DigestItem[] }> {
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);

  const [remindersRes, membersRes, datesRes] = await Promise.all([
    admin
      .from("reminders")
      .select(
        "id,title,category,due_at,recurrence,recurrence_interval_days,completed,payment_amount",
      )
      .eq("user_id", userId)
      .eq("completed", false)
      .limit(300),
    admin
      .from("family_members")
      .select("id,full_name,relationship,birth_date")
      .eq("user_id", userId)
      .limit(200),
    admin
      .from("special_dates")
      .select("family_member_id,title,kind,event_date,recurring")
      .eq("user_id", userId)
      .limit(300),
  ]);

  const reminders: DigestItem[] = [];
  for (const r of remindersRes.data ?? []) {
    const at = nextOccurrence(r as unknown as Reminder, now);
    if (at < now || at > windowEnd) continue;
    const amount = r.payment_amount != null ? ` — ${rupees(Number(r.payment_amount))}` : "";
    reminders.push({ at, label: `${dayLabel(at)} — ${r.title}${amount}` });
  }
  reminders.sort((a, b) => a.at.getTime() - b.at.getTime());

  const memberName = new Map((membersRes.data ?? []).map((m) => [m.id, m.full_name] as const));
  const occasions: DigestItem[] = [];
  for (const d of datesRes.data ?? []) {
    const at = d.recurring
      ? nextAnnual(d.event_date, now)
      : new Date(`${d.event_date}T09:00:00+05:30`);
    if (!at || Number.isNaN(at.getTime()) || at < now || at > windowEnd) continue;
    const who = memberName.get(d.family_member_id) ?? "Family";
    occasions.push({ at, label: `${dayLabel(at)} — ${who}: ${d.title}` });
  }
  for (const m of membersRes.data ?? []) {
    if (!m.birth_date) continue;
    const at = nextAnnual(m.birth_date, now);
    if (!at || at < now || at > windowEnd) continue;
    occasions.push({ at, label: `${dayLabel(at)} — ${m.full_name}'s birthday` });
  }
  occasions.sort((a, b) => a.at.getTime() - b.at.getTime());

  return { reminders, occasions };
}

/** Compact bullet block for the single WhatsApp body variable. */
export function whatsappSummary(items: DigestItem[]): string {
  const lines = items.slice(0, WA_MAX_LINES).map((i) => `• ${i.label}`);
  const extra = items.length - lines.length;
  if (extra > 0) lines.push(`• +${extra} more in the app`);
  return lines.join("\n").slice(0, WA_MAX_CHARS);
}

async function sendWhatsappDigest(
  phone: string,
  name: string,
  summary: string,
): Promise<{ ok: boolean; detail?: string }> {
  const authKey = process.env["MSG91_AUTH_KEY"];
  const integratedNumber = process.env["MSG91_WHATSAPP_NUMBER"];
  if (!authKey || !integratedNumber) return { ok: false, detail: "not_configured" };

  const templateName = process.env["MSG91_WA_DIGEST_TEMPLATE"] ?? "ereminder_weekly_digest";
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
              body_1: { type: "text", value: name.replace(/\s+/g, " ").slice(0, 60) },
              body_2: { type: "text", value: summary.replace(/\n/g, " · ").slice(0, WA_MAX_CHARS) },
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

export interface DigestRunSummary {
  checked: number;
  sent: number;
  skippedEmpty: number;
  skippedRecent: number;
  failed: number;
}

export async function dispatchWeeklyDigests(
  admin: Admin,
  options: { now?: Date; userId?: string; force?: boolean; dryRun?: boolean } = {},
): Promise<DigestRunSummary & { preview?: unknown }> {
  const now = options.now ?? new Date();
  const summary: DigestRunSummary = {
    checked: 0,
    sent: 0,
    skippedEmpty: 0,
    skippedRecent: 0,
    failed: 0,
  };
  const preview: unknown[] = [];

  let query = admin
    .from("profiles")
    .select(
      "id, full_name, phone, phone_verified_at, push_enabled, email_enabled, last_digest_sent_at",
    )
    .or("push_enabled.eq.true,email_enabled.eq.true")
    .limit(PROFILE_BATCH);
  if (options.userId) query = query.eq("id", options.userId);

  const { data: profiles, error } = await query;
  if (error) throw new Error(error.message);

  for (const profile of profiles ?? []) {
    summary.checked += 1;

    if (
      !options.force &&
      profile.last_digest_sent_at &&
      now.getTime() - new Date(profile.last_digest_sent_at).getTime() < MIN_GAP_MS
    ) {
      summary.skippedRecent += 1;
      continue;
    }

    try {
      const { reminders, occasions } = await buildDigest(admin, profile.id, now);
      // Nothing due: stay quiet rather than train people to ignore the digest.
      if (reminders.length === 0 && occasions.length === 0) {
        summary.skippedEmpty += 1;
        continue;
      }

      const name = profile.full_name?.trim() || "there";
      const all = [...reminders, ...occasions].sort((a, b) => a.at.getTime() - b.at.getTime());

      if (options.dryRun) {
        preview.push({
          userId: profile.id,
          name,
          reminders: reminders.map((r) => r.label),
          occasions: occasions.map((o) => o.label),
          whatsappBody: whatsappSummary(all),
        });
        continue;
      }

      let delivered = false;

      if (profile.email_enabled) {
        let email: string | null = null;
        try {
          const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
          const candidate = authUser.user?.email ?? null;
          email =
            candidate && !candidate.toLowerCase().endsWith("@phone.ereminder.app")
              ? candidate
              : null;
        } catch {
          email = null;
        }
        if (email) {
          try {
            const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
            const weekKey = new Date(now.getTime()).toISOString().slice(0, 10);
            const result = await sendTemplateEmail("weekly-digest", email, {
              templateData: {
                recipientName: profile.full_name ?? undefined,
                reminders: reminders.map((r) => r.label),
                occasions: occasions.map((o) => o.label),
              },
              idempotencyKey: `digest-${profile.id}-${weekKey}`,
            });
            if (result.sent) delivered = true;
          } catch (err) {
            console.error(`[digest] email failed user=${profile.id}: ${String(err)}`);
          }
        }
      }

      if (profile.push_enabled && profile.phone_verified_at && profile.phone) {
        const wa = await sendWhatsappDigest(profile.phone, name, whatsappSummary(all));
        if (wa.ok) delivered = true;
        else console.log(`[digest] whatsapp skipped user=${profile.id}: ${wa.detail ?? "error"}`);
      }

      if (!delivered) {
        summary.failed += 1;
        continue;
      }

      await admin
        .from("profiles")
        .update({ last_digest_sent_at: now.toISOString() })
        .eq("id", profile.id);
      summary.sent += 1;
    } catch (err) {
      console.error(`[digest] user=${profile.id} failed: ${String(err)}`);
      summary.failed += 1;
    }
  }

  return options.dryRun ? { ...summary, preview } : summary;
}
