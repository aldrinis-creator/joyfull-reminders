/**
 * Minimal MSG91 client for one-time passcodes.
 * SMS goes out through a flow template, WhatsApp through an approved template.
 */

export const MSG91_SMS_OTP_TEMPLATE_ID = "69ce5c76e1a28470900ffe46";
export const MSG91_WA_OTP_TEMPLATE = "verification_otp";
export const MSG91_WA_OTP_NAMESPACE = "e67e5302_b6d0_403e_b3cc_8fa6e8accb01";

export type OtpDispatchResult =
  | { ok: true; providerMessageId: string | null; providerStatus: "accepted" }
  | { ok: false; detail: string };

function authKey(): string | undefined {
  return process.env["MSG91_AUTH_KEY"];
}

/** MSG91 wants bare digits (country code included, no plus). */
export function toMsg91Number(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function sendOtpSms(phone: string, code: string): Promise<OtpDispatchResult> {
  const key = authKey();
  if (!key) return { ok: false, detail: "SMS is not configured yet." };

  const templateId = process.env["MSG91_SMS_OTP_TEMPLATE_ID"] ?? MSG91_SMS_OTP_TEMPLATE_ID;
  const sender = process.env["MSG91_SMS_SENDER"];

  const body: Record<string, unknown> = {
    template_id: templateId,
    short_url: "0",
    recipients: [{ mobiles: toMsg91Number(phone), OTP: code, otp: code, var1: code }],
  };
  if (sender) body["sender"] = sender;

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json", authkey: key },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, detail: text.slice(0, 300) };
    // MSG91 returns 200 with {type:"error"} on rejected payloads.
    try {
      const parsed = JSON.parse(text) as { type?: string; message?: string };
      if (parsed.type === "error") return { ok: false, detail: parsed.message ?? "SMS rejected." };
    } catch {
      /* non-JSON success body is fine */
    }
    return { ok: true, providerMessageId: null, providerStatus: "accepted" };
  } catch {
    return { ok: false, detail: "Could not reach the SMS provider." };
  }
}

export async function sendOtpWhatsapp(phone: string, code: string): Promise<OtpDispatchResult> {
  const key = authKey();
  const integratedNumber = process.env["MSG91_WHATSAPP_NUMBER"];
  if (!key || !integratedNumber) return { ok: false, detail: "WhatsApp is not configured yet." };

  const templateName = process.env["MSG91_WA_OTP_TEMPLATE"] ?? MSG91_WA_OTP_TEMPLATE;
  const namespace = process.env["MSG91_WA_NAMESPACE"] ?? MSG91_WA_OTP_NAMESPACE;
  const languageCode = process.env["MSG91_WA_OTP_LANGUAGE"] ?? "en";

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode, policy: "deterministic" },
        namespace,
        to_and_components: [
          {
            to: [toMsg91Number(phone)],
            components: {
              body_1: { type: "text", value: code },
              button_1: { subtype: "url", type: "text", value: code },
            },
          },
        ],
      },
    },
  };

  try {
    const res = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", authkey: key },
        body: JSON.stringify(payload),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      console.error("[msg91] whatsapp otp http error", res.status, text.slice(0, 300));
      return { ok: false, detail: text.slice(0, 300) };
    }
    // MSG91 frequently answers 200 even when the template or recipient failed.
    try {
      const parsed = JSON.parse(text) as {
        hasError?: boolean;
        type?: string;
        status?: string;
        message?: unknown;
        errors?: unknown;
        data?: unknown;
        request_id?: string;
        requestId?: string;
      };
      const nested = JSON.stringify(parsed.errors ?? parsed.data ?? "");
      const nestedFailure = /(?:error|failed|rejected|invalid)/i.test(nested);
      if (
        parsed.hasError === true ||
        parsed.type === "error" ||
        parsed.status === "error" ||
        parsed.status === "failed" ||
        nestedFailure
      ) {
        const detail = typeof parsed.message === "string" ? parsed.message : nested;
        console.error("[msg91] whatsapp otp rejected", detail?.slice(0, 300));
        return { ok: false, detail: detail?.slice(0, 300) ?? "WhatsApp message rejected." };
      }
      const data =
        parsed.data && typeof parsed.data === "object"
          ? (parsed.data as { message_id?: string; request_id?: string })
          : null;
      const providerMessageId =
        parsed.request_id ?? parsed.requestId ?? data?.message_id ?? data?.request_id ?? null;
      if (!providerMessageId) {
        console.error("[msg91] whatsapp otp response missing request id", text.slice(0, 300));
        return { ok: false, detail: "WhatsApp provider did not confirm the request." };
      }
      console.info("[msg91] whatsapp otp accepted", providerMessageId);
      return { ok: true, providerMessageId, providerStatus: "accepted" };
    } catch {
      console.error("[msg91] whatsapp otp invalid response", text.slice(0, 300));
      return { ok: false, detail: "WhatsApp provider returned an invalid response." };
    }
  } catch {
    return { ok: false, detail: "Could not reach the WhatsApp provider." };
  }
}
