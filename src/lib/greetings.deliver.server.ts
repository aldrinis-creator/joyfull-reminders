// Server-only: shared greeting delivery used by both the interactive
// "Send now" server function and the scheduled-greeting cron dispatcher.
// Keep every provider detail here so the two paths can never drift apart.

export type DeliverGreetingInput = {
  channel: "whatsapp" | "email";
  recipient: string;
  recipientName: string;
  senderName?: string | null | undefined;
  occasion: string;
  message: string;
  cardStyle: string;
  /** Stable key so retries of the same logical greeting don't double-send email. */
  idempotencyKey: string;
  /** Greeting row id — used as the dynamic suffix of the card button URL. */
  greetingId?: string | null | undefined;
  /** Recipient-facing card page (also where a voice note can be played). */
  greetingUrl?: string | null | undefined;
  hasVoiceNote?: boolean | undefined;
  /** Short-lived signed audio URL — embedded inline in email only. */
  voiceUrl?: string | null | undefined;
  /** If WhatsApp is rejected and we know an email address, mail the card instead. */
  fallbackEmail?: string | null | undefined;
};


export type DeliverGreetingResult =
  | {
      ok: true;
      providerMessageId: string | null;
      viaFallbackEmail?: boolean;
      /** Raw provider acknowledgement, kept for diagnosis. */
      providerResponse?: string;
    }
  | {
      ok: false;
      reason: "not_configured" | "suppressed" | "failed";
      detail: string;
    };


async function deliverEmail(input: DeliverGreetingInput): Promise<DeliverGreetingResult> {
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("greeting-card", input.recipient, {
      templateData: {
        senderName: input.senderName ?? undefined,
        recipientName: input.recipientName,
        occasion: input.occasion,
        message: input.message,
        cardStyle: input.cardStyle,
        greetingUrl: input.greetingUrl ?? undefined,
        voiceUrl: input.hasVoiceNote ? (input.voiceUrl ?? undefined) : undefined,

      },
      idempotencyKey: input.idempotencyKey,
    });
    if (!result.sent) {
      return {
        ok: false,
        reason: "suppressed",
        detail: "Recipient unsubscribed or unreachable.",
      };
    }
    return { ok: true, providerMessageId: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Email could not be sent.";
    return { ok: false, reason: "failed", detail: detail.slice(0, 400) };
  }
}

/** Plain message text for the classic two-variable greeting template. */
function whatsappBody(input: DeliverGreetingInput): string {
  return input.message.replace(/\s+/g, " ").slice(0, 700);
}

async function deliverWhatsapp(input: DeliverGreetingInput): Promise<DeliverGreetingResult> {

  const authKey = process.env["MSG91_AUTH_KEY"];
  const integratedNumber = process.env["MSG91_WHATSAPP_NUMBER"];
  const namespace = process.env["MSG91_WA_NAMESPACE"];

  // A greeting that carries a recording goes out on the approved
  // ereminder_voice_greeting template, whose "Open card" URL button carries
  // the card link — links stuffed into a body variable get dropped.
  const useVoiceTemplate = Boolean(input.hasVoiceNote && input.greetingId);
  const templateName = useVoiceTemplate
    ? (process.env["MSG91_WA_VOICE_GREETING_TEMPLATE"] ?? "ereminder_voice_greeting")
    : (process.env["MSG91_WA_GREETING_TEMPLATE"] ?? "ereminder_greeting");

  if (!authKey || !integratedNumber) {
    return {
      ok: false,
      reason: "not_configured",
      detail: "Add your MSG91 credentials to send WhatsApp greetings.",
    };
  }

  const components = useVoiceTemplate
    ? {
        body_1: { type: "text", value: input.recipientName },
        body_2: { type: "text", value: input.occasion.replace(/\s+/g, " ").slice(0, 60) },
        body_3: {
          type: "text",
          value: (input.senderName?.trim() || "a loved one").slice(0, 60),
        },
        body_4: { type: "text", value: whatsappBody(input) },
        button_1: { subtype: "url", type: "text", value: input.greetingId },
      }
    : {
        body_1: { type: "text", value: input.recipientName },
        body_2: { type: "text", value: whatsappBody(input) },
      };

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
            to: [input.recipient.replace(/\D/g, "")],
            components,
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
    // Diagnosis breadcrumb: which template went out, and what the provider said.
    console.log(
      `[greeting-whatsapp] template=${templateName} status=${res.status} body=${bodyText.slice(0, 300)}`,
    );
    if (!res.ok) {
      return { ok: false, reason: "failed", detail: bodyText.slice(0, 400) };
    }
    let providerMessageId: string | null = null;
    try {
      const parsed = JSON.parse(bodyText) as {
        type?: string;
        message?: string;
        data?: { message_id?: string };
        request_id?: string;
      };
      // MSG91 answers 200 even for rejections — the body carries the verdict.
      if (parsed.type === "error") {
        return { ok: false, reason: "failed", detail: (parsed.message ?? "rejected").slice(0, 400) };
      }
      providerMessageId = parsed.data?.message_id ?? parsed.request_id ?? null;
    } catch {
      providerMessageId = null;
    }
    return { ok: true, providerMessageId, providerResponse: bodyText.slice(0, 400) };
  } catch {
    return { ok: false, reason: "failed", detail: "Could not reach the WhatsApp provider." };
  }
}

export async function deliverGreeting(
  input: DeliverGreetingInput,
): Promise<DeliverGreetingResult> {
  if (input.channel === "email") return deliverEmail(input);

  const whatsapp = await deliverWhatsapp(input);
  if (whatsapp.ok) return whatsapp;

  // WhatsApp refused (template/eligibility/provider). If we know an email
  // address for this contact, send the emailed card — it already embeds the
  // player — instead of failing silently.
  const fallback = input.fallbackEmail?.trim();
  if (!fallback) return whatsapp;
  const emailed = await deliverEmail({
    ...input,
    channel: "email",
    recipient: fallback,
    idempotencyKey: `${input.idempotencyKey}-email-fallback`,
  });
  return emailed.ok ? { ...emailed, viaFallbackEmail: true } : whatsapp;
}

