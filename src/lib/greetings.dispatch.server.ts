import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import { deliverGreeting } from "@/lib/greetings.deliver.server";

/**
 * Scheduled greeting delivery, called from the shared cron
 * (src/routes/api/public/cron/dispatch-reminders.ts).
 *
 * Picks up greetings in the `scheduled` state whose `scheduled_for` has passed
 * and delivers them through the same code path as an interactive "Send now"
 * (see src/lib/greetings.deliver.server.ts). Each row is claimed before the
 * provider call, so a greeting can never go out twice.
 */

const BATCH_LIMIT = 100;

type Admin = typeof supabaseAdmin;

export async function dispatchDueGreetings(admin: Admin) {
  const nowIso = new Date().toISOString();
  const summary = { checked: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: rows, error } = await admin
    .from("greetings")
    .select(
      "id, user_id, family_member_id, occasion, occasion_key, channel, card_style, message, recipient, scheduled_for, family_members(full_name, email, whatsapp_phone, greetings_enabled)",
    )
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .limit(BATCH_LIMIT);

  if (error) {
    return { error: "query_failed" as const, detail: error.message, ...summary };
  }

  summary.checked = (rows ?? []).length;

  const senderCache = new Map<string, string | null>();
  async function senderName(userId: string) {
    if (senderCache.has(userId)) return senderCache.get(userId) ?? null;
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const name = profile?.full_name ?? null;
    senderCache.set(userId, name);
    return name;
  }

  for (const row of rows ?? []) {
    const member = row.family_members;
    const channel = row.channel;
    if (channel === "share" || !member || !member.greetings_enabled) {
      await admin
        .from("greetings")
        .update({
          status: "skipped",
          scheduled_for: null,
          error_message: "Greetings are switched off for this contact.",
        })
        .eq("id", row.id)
        .eq("status", "scheduled");
      summary.skipped += 1;
      continue;
    }

    const recipient =
      row.recipient ??
      (channel === "whatsapp" ? member.whatsapp_phone : member.email) ??
      null;

    if (!recipient) {
      await admin
        .from("greetings")
        .update({
          status: "skipped",
          scheduled_for: null,
          error_message: "No contact details for this channel.",
        })
        .eq("id", row.id)
        .eq("status", "scheduled");
      summary.skipped += 1;
      continue;
    }

    // Claim the row first: only the worker that flips it out of
    // `scheduled` is allowed to call the provider.
    const { data: claimed } = await admin
      .from("greetings")
      .update({ status: "draft" })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (!claimed) {
      summary.skipped += 1;
      continue;
    }

    try {
      const result = await deliverGreeting({
        channel,
        recipient,
        recipientName: member.full_name,
        senderName: await senderName(row.user_id),
        occasion: row.occasion,
        message: row.message,
        cardStyle: row.card_style,
        idempotencyKey: `greeting-${row.id}`,
      });

      if (result.ok) {
        await admin
          .from("greetings")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: result.providerMessageId,
            error_message: null,
          })
          .eq("id", row.id);
        summary.sent += 1;
      } else {
        await admin
          .from("greetings")
          .update({
            status: result.reason === "suppressed" ? "skipped" : "failed",
            error_message: result.detail.slice(0, 400),
          })
          .eq("id", row.id);
        summary.failed += 1;
      }
    } catch (err) {
      await admin
        .from("greetings")
        .update({
          status: "failed",
          error_message: (err instanceof Error ? err.message : "unknown").slice(0, 400),
        })
        .eq("id", row.id);
      summary.failed += 1;
    }
  }

  return summary;
}
