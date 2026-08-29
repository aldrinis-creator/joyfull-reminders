import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendGreetingSchema } from "@/lib/greetings.schemas";

export type SendGreetingResult =
  | { ok: true; greetingId: string; channel: string }
  | { ok: false; reason: "not_configured" | "no_recipient" | "already_sent" | "failed"; detail: string };

/**
 * Sends a greeting on behalf of the signed-in user.
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
      .select("id")
      .eq("family_member_id", data.familyMemberId)
      .eq("occasion_key", data.occasionKey)
      .eq("channel", data.channel)
      .eq("status", "sent")
      .maybeSingle();

    if (existing) {
      return { ok: false, reason: "already_sent", detail: "This greeting has already gone out." };
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

    if (data.channel === "share") {
      const { data: row, error } = await supabase
        .from("greetings")
        .insert({ ...insertRow, status: "sent" as const, sent_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error || !row) return { ok: false, reason: "failed", detail: "Could not save the greeting." };
      return { ok: true, greetingId: row.id, channel: "share" };
    }

    if (data.channel === "email") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const result = await sendTemplateEmail("greeting-card", recipient!, {
          templateData: {
            senderName: profile?.full_name ?? undefined,
            recipientName: member.full_name,
            occasion: data.occasion,
            message: data.message,
            cardStyle: data.cardStyle,
          },
          idempotencyKey: `greeting-${data.familyMemberId}-${data.occasionKey}-email`,
        });

        if (!result.sent) {
          await supabase.from("greetings").insert({
            ...insertRow,
            status: "skipped" as const,
            error_message: "Recipient unsubscribed or unreachable.",
          });
          return {
            ok: false,
            reason: "failed",
            detail: "This address has opted out of emails, so the card was not sent.",
          };
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Email could not be sent.";
        await supabase
          .from("greetings")
          .insert({ ...insertRow, status: "failed" as const, error_message: detail.slice(0, 400) });
        return { ok: false, reason: "failed", detail: "The email could not be sent right now." };
      }

      const { data: row, error } = await supabase
        .from("greetings")
        .insert({ ...insertRow, status: "sent" as const, sent_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error || !row) return { ok: false, reason: "failed", detail: "Sent, but could not be saved." };
      return { ok: true, greetingId: row.id, channel: "email" };
    }

    // WhatsApp via MSG91
    const authKey = process.env["MSG91_AUTH_KEY"];
    const integratedNumber = process.env["MSG91_WHATSAPP_NUMBER"];
    const templateName = process.env["MSG91_WA_GREETING_TEMPLATE"] ?? "ereminder_greeting";
    const namespace = process.env["MSG91_WA_NAMESPACE"];

    if (!authKey || !integratedNumber) {
      await supabase.from("greetings").insert({ ...insertRow, status: "draft" as const });
      return {
        ok: false,
        reason: "not_configured",
        detail: "Add your MSG91 credentials to send WhatsApp greetings.",
      };
    }

    const to = (recipient ?? "").replace(/\D/g, "");
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
              to: [to],
              components: {
                body_1: { type: "text", value: member.full_name },
                body_2: { type: "text", value: data.message.replace(/\s+/g, " ").slice(0, 900) },
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
      const bodyText = await res.text();
      if (!res.ok) {
        await supabase
          .from("greetings")
          .insert({ ...insertRow, status: "failed" as const, error_message: bodyText.slice(0, 400) });
        return { ok: false, reason: "failed", detail: "WhatsApp provider rejected the message." };
      }
      let providerId: string | null = null;
      try {
        const parsed = JSON.parse(bodyText) as { data?: { message_id?: string }; request_id?: string };
        providerId = parsed.data?.message_id ?? parsed.request_id ?? null;
      } catch {
        providerId = null;
      }
      const { data: row, error } = await supabase
        .from("greetings")
        .insert({
          ...insertRow,
          status: "sent" as const,
          sent_at: new Date().toISOString(),
          provider_message_id: providerId,
        })
        .select("id")
        .single();
      if (error || !row) return { ok: false, reason: "failed", detail: "Sent, but could not be saved." };
      return { ok: true, greetingId: row.id, channel: "whatsapp" };
    } catch {
      await supabase.from("greetings").insert({ ...insertRow, status: "failed" as const });
      return { ok: false, reason: "failed", detail: "Could not reach the WhatsApp provider." };
    }
  });
