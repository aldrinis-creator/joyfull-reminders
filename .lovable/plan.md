# Rename WhatsApp OTP template to `ereminder_verification_otp`

## What changes
- `src/lib/msg91.server.ts` line 7: change the default from `"verification_otp"` to `"ereminder_verification_otp"`.
  - `const MSG91_WA_OTP_TEMPLATE = "ereminder_verification_otp";`
- No other code references this constant; the runtime value also comes from the `MSG91_WA_OTP_TEMPLATE` env var, which is currently unset, so the new default takes effect.

## What you must do outside the code
- In MSG91, create/approve the WhatsApp template under the name **`ereminder_verification_otp`** (same body as the previously planned `verification_otp`: one body variable `{{1}}` = OTP). The existing `verification_otp` name will no longer be used by the app.
- No new env var required; optionally set `MSG91_WA_OTP_TEMPLATE` to override if you ever want a different name without a code change.

## Verification
- Typecheck/build after the edit.
- Confirm OTP WhatsApp still resolves to the new template name at runtime (template approval remains the manual MSG91 step).
