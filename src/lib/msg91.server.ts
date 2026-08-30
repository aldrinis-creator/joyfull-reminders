/**
 * Minimal MSG91 client for one-time passcodes.
 * SMS goes out through a flow template, WhatsApp through an approved template.
 */

export const MSG91_SMS_OTP_TEMPLATE_ID = "69ce5c76e1a28470900ffe46";
export const MSG91_WA_OTP_TEMPLATE = "verification_otp";

export type OtpDispatchResult = { ok: true } | { ok: false; detail: string };

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
    return { ok: true };
  } catch {
    return { ok: false, detail: "Could not reach the SMS provider." };
  }
}

export async function sendOtpWhatsapp(phone: string, code: string): Promise<OtpDispatchResult> {
  const key = authKey();
  const integratedNumber = process.env["MSG91_WHATSAPP_NUMBER"];
  if (!key || !integratedNumber) return { ok: false, detail: "WhatsApp is not configured yet." };

  const templateName = process.env["MSG91_WA_OTP_TEMPLATE"] ?? MSG91_WA_OTP_TEMPLATE;
  const namespace = process.env["MSG91_WA_NAMESPACE"];
  const languageCode = process.env["MSG91_WA_OTP_LANGUAGE"] ?? "en_US";
  // Authentication templates without a copy-code button reject the button
  // component outright, so it is opt-in.
  const withButton = process.env["MSG91_WA_OTP_BUTTON"] === "1";

  const payload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode, policy: "deterministic" },
        ...(namespace ? { namespace } : {}),
        to_and_components: [
          {
            to: [toMsg91Number(phone)],
            components: {
              body_1: { type: "text", value: code },
              ...(withButton
                ? { button_1: { subtype: "url", type: "text", value: code } }
                : {}),
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
        headers: { "Content-Type": "application/json", authkey: key },
        body: JSON.stringify(payload),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      console.error("[msg91] whatsapp otp http error", res.status, text.slice(0, 300));
      return { ok: false, detail: text.slice(0, 300) };
    }
    // MSG91 answers 200 with an error body when it rejects a template.
    try {
      const parsed = JSON.parse(text) as { type?: string; status?: string; message?: unknown };
      if (parsed.type === "error" || parsed.status === "error") {
        const detail =
          typeof parsed.message === "string" ? parsed.message : JSON.stringify(parsed.message);
        console.error("[msg91] whatsapp otp rejected", detail?.slice(0, 300));
        return { ok: false, detail: detail?.slice(0, 300) ?? "WhatsApp message rejected." };
      }
    } catch {
      /* non-JSON success body is fine */
    }
    return { ok: true };
  } catch {
    return { ok: false, detail: "Could not reach the WhatsApp provider." };
  }
}
