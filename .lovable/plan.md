# Phone OTP via MSG91 (SMS + WhatsApp)

Let people sign in with a mobile number, and verify numbers saved inside the app, using your MSG91 account. The user picks how they want the code delivered — SMS or WhatsApp — before it is sent.

## What the user sees

**Sign in / sign up (Phone tab)**
1. Enter mobile number (international format, default +91).
2. Choose delivery: "Text me on SMS" or "Send on WhatsApp" (two clear buttons).
3. Enter the 6-digit code. Options to resend (30s cooldown) and to switch to the other channel.
4. On success they land on /home. First-time numbers get an account created automatically; the profile asks for their name afterwards.

**Verify a number in the app (Profile, and family contacts)**
- Same choose-channel + code flow in a small dialog, marking the number verified. Verified WhatsApp numbers are the ones greetings go out to.

## Delivery

- SMS: MSG91 flow template `69ce5c76e1a28470900ffe46`.
- WhatsApp: MSG91 template `verification_otp`.
- If the chosen channel hard-fails at the provider, the app says so and offers the other channel immediately (one tap) rather than silently switching.

## Backend behaviour

- Codes are generated server-side, stored only as a hash, expire in 10 minutes, single use, max 5 wrong attempts, and are rate limited (3 sends per number per 15 min, plus a per-IP cap).
- Phone-only accounts are created behind the scenes with an internal address derived from the number (e.g. `919876543210@phone.ereminder.app`); users never see or type it. Existing accounts with the same phone are reused.
- No code, hash or credential is ever returned to the browser.

## Technical details

- Migration: `phone_otp_challenges` table (id, phone, channel, code_hash, expires_at, attempts, consumed_at, ip, created_at) — RLS enabled with **no** client policies; only server code (service role) touches it. Add `phone_verified_at` to `profiles`, and `whatsapp_verified_at` to `family_members`.
- `src/lib/otp.schemas.ts` — Zod schemas (phone E.164, channel enum `sms | whatsapp`, 6-digit code).
- `src/lib/otp.functions.ts` — public `requestPhoneOtp` (rate-limit, generate, hash, dispatch) and `verifyPhoneOtp` (validate, consume, create/find user via admin client, return a session); plus authenticated `requestNumberVerification` / `confirmNumberVerification` for in-app verification.
- `src/lib/msg91.server.ts` — thin client: SMS via MSG91 flow API with `template_id 69ce5c76e1a28470900ffe46`, WhatsApp via the existing bulk outbound endpoint with template `verification_otp`. Reuses `MSG91_AUTH_KEY` / `MSG91_WHATSAPP_NUMBER`; adds `MSG91_SMS_SENDER` (sender ID) as a secret if not present.
- `src/routes/auth.tsx` — Phone tab reworked to the three-step flow above; replaces `supabase.auth.signInWithOtp` / `verifyOtp` so no Supabase SMS provider is needed. Client sets the returned session with `supabase.auth.setSession`.
- `src/routes/_authenticated/profile.tsx` + family member page — verification dialog reusing the same server functions.

## MSG91 setup needed from you

- SMS flow template `69ce5c76e1a28470900ffe46` must expose an OTP variable (I'll wire `##OTP##`/`var1`; tell me the exact variable name if it differs).
- WhatsApp template `verification_otp` approved with one body variable for the code.
- Secrets: `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_NUMBER`, `MSG91_SMS_SENDER`.
