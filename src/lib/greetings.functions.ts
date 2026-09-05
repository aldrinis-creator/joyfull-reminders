import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cancelScheduledGreetingSchema,
  publicGreetingSchema,
  sendGreetingSchema,
  updateScheduledGreetingSchema,
  uploadVoiceNoteSchema,
} from "@/lib/greetings.schemas";

export type SendGreetingResult =
  | { ok: true; greetingId: string; channel: string; scheduled?: boolean }
  | { ok: false; reason: "not_configured" | "no_recipient" | "already_sent" | "failed"; detail: string };

/**
 * Stores a recorded voice note in the private bucket under the signed-in
 * user's own folder and hands the path back to the composer.
 */
export const uploadGreetingVoiceNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadVoiceNoteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ext = data.mimeType.includes("mp4")
      ? "m4a"
      : data.mimeType.includes("ogg")
        ? "ogg"
        : data.mimeType.includes("mpeg")
          ? "mp3"
          : "webm";
    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { VOICE_BUCKET } = await import("@/lib/greetings.voice.server");
    const { error } = await supabase.storage.from(VOICE_BUCKET).upload(path, bytes, {
      contentType: data.mimeType,
      upsert: false,
    });
    if (error) {
      return { ok: false as const, detail: "Could not save the recording." };
    }
    return { ok: true as const, path, seconds: data.seconds };
  });

export type PublicGreeting = {
  occasion: string;
  message: string;
  cardStyle: string;
  recipientName: string | null;
  voiceUrl: string | null;
  voiceSeconds: number | null;
};

/**
 * Public (recipient-facing) read of a single greeting card. Returns only the
 * fields printed on the card plus a freshly signed audio URL — never the
 * sender's identity or contact details.
 */
export const getPublicGreeting = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => publicGreetingSchema.parse(input))
  .handler(async ({ data }): Promise<PublicGreeting | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("greetings")
      .select("occasion, message, card_style, voice_note_path, voice_note_seconds, family_members(full_name)")
      .eq("id", data.greetingId)
      .maybeSingle();
    if (!row) return null;

    let voiceUrl: string | null = null;
    if (row.voice_note_path) {
      const { createVoiceSignedUrl } = await import("@/lib/greetings.voice.server");
      voiceUrl = await createVoiceSignedUrl(row.voice_note_path);
    }

    return {
      occasion: row.occasion,
      message: row.message,
      cardStyle: row.card_style,
      recipientName: row.family_members?.full_name ?? null,
      voiceUrl,
      voiceSeconds: row.voice_note_seconds ?? null,
    };
  });

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

    // An explicit re-send ("Send again anyway") skips the duplicate guard.
    const { data: existing } = data.force
      ? { data: null as { id: string; status: string } | null }
      : await supabase
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

    // The card link lives inside the delivered message, so the row id has to
    // exist before we call the provider.
    const greetingId = crypto.randomUUID();

    const insertRow = {
      id: greetingId,
      user_id: userId,
      family_member_id: data.familyMemberId,
      reminder_id: data.reminderId ?? null,
      occasion: data.occasion,
      occasion_key: data.occasionKey,
      channel: data.channel,
      card_style: data.cardStyle,
      message: data.message,
      recipient,
      voice_note_path: data.voiceNotePath ?? null,
      voice_note_seconds: data.voiceNotePath ? (data.voiceNoteSeconds ?? null) : null,
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

    const { greetingPageUrl, createVoiceSignedUrl } = await import("@/lib/greetings.voice.server");
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
      greetingId,
      greetingUrl: greetingPageUrl(greetingId),
      hasVoiceNote: Boolean(data.voiceNotePath),
      voiceUrl: data.voiceNotePath ? await createVoiceSignedUrl(data.voiceNotePath) : null,
      fallbackEmail: data.channel === "whatsapp" ? member.email : null,
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
