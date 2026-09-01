import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cancelScheduledGreetingSchema,
  sendGreetingSchema,
  updateScheduledGreetingSchema,
} from "@/lib/greetings.schemas";

export type SendGreetingResult =
  | { ok: true; greetingId: string; channel: string; scheduled?: boolean }
  | { ok: false; reason: "not_configured" | "no_recipient" | "already_sent" | "failed"; detail: string };

/**
 * Sends a greeting on behalf of the signed-in user, or queues it when
 * `scheduledFor` is given (the cron dispatcher then delivers it).
 * WhatsApp goes out through MSG91; email needs a verified sending domain;
 * "share" simply records the card the user shared themselves.
 */
export const sendGreeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendGreetingSchema.parse(input))
  .handler(async ({ data, context }): Promise<SendGreetingResult> => {
    const { supabase, userId } = context;

    const { data: member, error: memberError } = await supabase
      .from("family_members")
      .select("id, full_name, email, whatsapp_phone, greetings_enabled")
      .eq("id", data.familyMemberId)
      .maybeSingle();

    if (memberError || !member) {
      return { ok: false, reason: "failed", detail: "We couldn't find that contact." };
    }
    if (!member.greetings_enabled) {
      return { ok: false, reason: "failed", detail: "Greetings are switched off for this contact." };
    }

    const { data: existing } = await supabase
      .from("greetings")
      .select("id, status")
      .eq("family_member_id", data.familyMemberId)
      .eq("occasion_key", data.occasionKey)
      .eq("channel", data.channel)
      .in("status", ["sent", "scheduled"])
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        reason: "already_sent",
        detail:
          existing.status === "scheduled"
            ? "A greeting for this occasion is already scheduled."
            : "This greeting has already gone out.",
      };
    }

    const recipient =
      data.channel === "whatsapp"
        ? member.whatsapp_phone
        : data.channel === "email"
          ? member.email
          : null;

    if (data.channel !== "share" && !recipient) {
      return {
        ok: false,
        reason: "no_recipient",
        detail:
          data.channel === "whatsapp"
            ? "Add their WhatsApp number first."
            : "Add their email address first.",
      };
    }

    const insertRow = {
      user_id: userId,
      family_member_id: data.familyMemberId,
      reminder_id: data.reminderId ?? null,
      occasion: data.occasion,
      occasion_key: data.occasionKey,
      channel: data.channel,
      card_style: data.cardStyle,
      message: data.message,
      recipient,
    };

    // Queue for later — the cron dispatcher delivers it.
    if (data.scheduledFor && data.channel !== "share") {
      const { data: row, error } = await supabase
        .from("greetings")
        .insert({
          ...insertRow,
          status: "scheduled" as const,
          scheduled_for: data.scheduledFor,
        })
        .select("id")
        .single();
      if (error || !row) {
        return { ok: false, reason: "failed", detail: "Could not schedule the greeting." };
      }
      return { ok: true, greetingId: row.id, channel: data.channel, scheduled: true };
    }

    if (data.channel === "share") {
      const { data: row, error } = await supabase
        .from("greetings")
        .insert({ ...insertRow, status: "sent" as const, sent_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error || !row) return { ok: false, reason: "failed", detail: "Could not save the greeting." };
      return { ok: true, greetingId: row.id, channel: "share" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const { deliverGreeting } = await import("@/lib/greetings.deliver.server");
    const result = await deliverGreeting({
      channel: data.channel,
      recipient: recipient!,
      recipientName: member.full_name,
      senderName: profile?.full_name ?? null,
      occasion: data.occasion,
      message: data.message,
      cardStyle: data.cardStyle,
      idempotencyKey: `greeting-${data.familyMemberId}-${data.occasionKey}-${data.channel}`,
    });

    if (!result.ok) {
      const status =
        result.reason === "not_configured"
          ? ("draft" as const)
          : result.reason === "suppressed"
            ? ("skipped" as const)
            : ("failed" as const);
      await supabase
        .from("greetings")
        .insert({ ...insertRow, status, error_message: result.detail.slice(0, 400) });
      return {
        ok: false,
        reason: result.reason === "not_configured" ? "not_configured" : "failed",
        detail: result.detail,
      };
    }

    const { data: row, error } = await supabase
      .from("greetings")
      .insert({
        ...insertRow,
        status: "sent" as const,
        sent_at: new Date().toISOString(),
        provider_message_id: result.providerMessageId,
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false, reason: "failed", detail: "Sent, but could not be saved." };
    return { ok: true, greetingId: row.id, channel: data.channel };
  });

/** Edits a still-pending scheduled greeting (date/time, message, card style). */
export const updateScheduledGreeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateScheduledGreetingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("greetings")
      .update({
        scheduled_for: data.scheduledFor,
        message: data.message,
        ...(data.cardStyle ? { card_style: data.cardStyle } : {}),
      })
      .eq("id", data.greetingId)
      .eq("status", "scheduled");
    if (error) return { ok: false as const, detail: "Could not update the scheduled greeting." };
    return { ok: true as const };
  });

/** Cancels a scheduled greeting so the dispatcher skips it. */
export const cancelScheduledGreeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelScheduledGreetingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("greetings")
      .update({ status: "cancelled" as const, scheduled_for: null })
      .eq("id", data.greetingId)
      .eq("status", "scheduled");
    if (error) return { ok: false as const, detail: "Could not cancel the scheduled greeting." };
    return { ok: true as const };
  });
