import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sendOtpSms, sendOtpWhatsapp, toMsg91Number } from "@/lib/msg91.server";

const OTP_TTL_SECONDS = 600;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 3;
const WINDOW_MINUTES = 15;

type Channel = "sms" | "whatsapp";
type Purpose = "signin" | "verify";

function randomCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + ((bytes[0] ?? 0) % 900000));
}

async function hashCode(salt: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${code}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function shadowEmail(phone: string): string {
  return `${toMsg91Number(phone)}@phone.ereminder.app`;
}

export async function issueOtp(
  phone: string,
  channel: Channel,
  purpose: Purpose,
  userId: string | null,
): Promise<
  | { ok: true; channel: Channel; expiresInSeconds: number }
  | { ok: false; reason: "not_configured" | "rate_limited" | "failed"; detail: string }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("phone_otp_challenges")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_SENDS_PER_WINDOW) {
    return {
      ok: false,
      reason: "rate_limited",
      detail: "Too many codes requested. Please try again in a few minutes.",
    };
  }

  const id = crypto.randomUUID();
  const code = randomCode();
  const codeHash = await hashCode(id, code);

  const { error: insertError } = await supabaseAdmin.from("phone_otp_challenges").insert({
    id,
    phone,
    channel,
    purpose,
    code_hash: codeHash,
    user_id: userId,
    expires_at: new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString(),
  });
  if (insertError) {
    return { ok: false, reason: "failed", detail: "Could not start verification." };
  }

  const sent = channel === "sms" ? await sendOtpSms(phone, code) : await sendOtpWhatsapp(phone, code);

  if (!sent.ok) {
    await supabaseAdmin
      .from("phone_otp_challenges")
      .update({
        consumed_at: new Date().toISOString(),
        provider_status: "rejected",
        provider_error: sent.detail.slice(0, 500),
      })
      .eq("id", id);
    const notConfigured = sent.detail.includes("not configured");
    return {
      ok: false,
      reason: notConfigured ? "not_configured" : "failed",
      detail: notConfigured
        ? sent.detail
        : channel === "sms"
          ? "The SMS could not be sent. Try WhatsApp instead."
          : "The WhatsApp message could not be sent. Try SMS instead.",
    };
  }

  await supabaseAdmin
    .from("phone_otp_challenges")
    .update({
      provider_message_id: sent.providerMessageId,
      provider_status: sent.providerStatus,
      provider_error: null,
    })
    .eq("id", id);

  return { ok: true, channel, expiresInSeconds: OTP_TTL_SECONDS };
}

export async function consumeOtp(
  phone: string,
  code: string,
  purpose: Purpose,
): Promise<
  { ok: true } | { ok: false; reason: "invalid" | "expired" | "too_many" | "failed"; detail: string }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row } = await supabaseAdmin
    .from("phone_otp_challenges")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("phone", phone)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return { ok: false, reason: "expired", detail: "That code has expired. Request a new one." };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired", detail: "That code has expired. Request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      reason: "too_many",
      detail: "Too many wrong attempts. Request a new code.",
    };
  }

  const expected = await hashCode(row.id, code.trim());
  if (expected !== row.code_hash) {
    await supabaseAdmin
      .from("phone_otp_challenges")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { ok: false, reason: "invalid", detail: "That code is not right. Please try again." };
  }

  await supabaseAdmin
    .from("phone_otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true };
}

export async function signInWithPhone(
  phone: string,
): Promise<
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; reason: "failed"; detail: string }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = shadowEmail(phone);
  const password = crypto.randomUUID() + crypto.randomUUID();

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  let userId = existing?.id ?? null;

  if (!userId) {
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { phone },
    });
    if (created.error || !created.data.user) {
      return { ok: false, reason: "failed", detail: "Could not create your account." };
    }
    userId = created.data.user.id;
  } else {
    const updated = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (updated.error) {
      return { ok: false, reason: "failed", detail: "Could not sign you in." };
    }
  }

  await supabaseAdmin
    .from("profiles")
    .update({ phone, phone_verified_at: new Date().toISOString() })
    .eq("id", userId);

  const anon = createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: session, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !session.session) {
    return { ok: false, reason: "failed", detail: "Could not sign you in. Please try again." };
  }

  return {
    ok: true,
    accessToken: session.session.access_token,
    refreshToken: session.session.refresh_token,
  };
}
