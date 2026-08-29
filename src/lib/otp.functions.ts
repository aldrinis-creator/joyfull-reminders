import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requestOtpSchema, verifyOtpSchema } from "@/lib/otp.schemas";

export type RequestOtpResult =
  | { ok: true; channel: "sms" | "whatsapp"; expiresInSeconds: number }
  | { ok: false; reason: "not_configured" | "rate_limited" | "failed"; detail: string };

export type VerifyOtpResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; reason: "invalid" | "expired" | "too_many" | "failed"; detail: string };

export type VerifyNumberResult = { ok: true } | { ok: false; detail: string };

/** Sends a one-time passcode to a phone number on the channel the user picked. */
export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestOtpSchema.parse(input))
  .handler(async ({ data }): Promise<RequestOtpResult> => {
    const { issueOtp } = await import("@/lib/otp.server");
    return issueOtp(data.phone, data.channel, "signin", null);
  });

/** Verifies the passcode and returns a session for the phone's account. */
export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifyOtpSchema.parse(input))
  .handler(async ({ data }): Promise<VerifyOtpResult> => {
    const { consumeOtp, signInWithPhone } = await import("@/lib/otp.server");
    const check = await consumeOtp(data.phone, data.code, "signin");
    if (!check.ok) return check;
    return signInWithPhone(data.phone);
  });

/** Sends a passcode so a signed-in user can verify a number saved in the app. */
export const requestNumberVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => requestOtpSchema.parse(input))
  .handler(async ({ data, context }): Promise<RequestOtpResult> => {
    const { issueOtp } = await import("@/lib/otp.server");
    return issueOtp(data.phone, data.channel, "verify", context.userId);
  });

/** Confirms an in-app number verification and stamps it on the profile. */
export const confirmNumberVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyOtpSchema.parse(input))
  .handler(async ({ data, context }): Promise<VerifyNumberResult> => {
    const { consumeOtp } = await import("@/lib/otp.server");
    const check = await consumeOtp(data.phone, data.code, "verify");
    if (!check.ok) return { ok: false, detail: check.detail };

    const { error } = await context.supabase
      .from("profiles")
      .update({ phone: data.phone, phone_verified_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) return { ok: false, detail: "Verified, but we could not save it." };
    return { ok: true };
  });
