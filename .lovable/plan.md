# Plan: Activate approved MSG91 templates (`ereminder_greeting`, `ereminder_alert`)

## Current state (verified)
- `ereminder_greeting` — already used as the default template name in the greeting send path (`greetings.functions.ts`), with one body variable: the contact's name.
- `ereminder_alert` — already used as the default template name in the reminder dispatch cron (`dispatch-reminders.ts`), with one body variable: the reminder title.
- OTP template `ereminder_verification_otp` is wired with body + URL-button variables.

## What to do

1. **Verify required secrets exist**: `MSG91_AUTH_KEY` and `MSG91_WHATSAPP_NUMBER`. Add any that are missing (ask you for the values if not already stored). Namespace stays optional via `MSG91_WA_NAMESPACE`.
2. **Match variables to the approved templates**: confirm the approved `ereminder_greeting` body uses one `{{1}}` (contact name) and `ereminder_alert` uses one `{{1}}` (reminder title). If the approved versions have more/fewer variables or buttons, adjust the payload mapping in `greetings.functions.ts` and `dispatch-reminders.ts` to match exactly.
3. **End-to-end test**: trigger a test greeting send and a reminder dispatch to your own number, confirm MSG91 accepts both templates (no "template not found"/variable-count errors), and report the result.
4. **Typecheck/build**, fix anything that surfaces.

## Question for you
Please confirm (or paste from the MSG91 dashboard) the exact body of each approved template, e.g.:
- `ereminder_greeting`: "Hi {{1}}, ..." — how many `{{}}` variables and any buttons?
- `ereminder_alert`: "...{{1}}..." — how many variables?

If both are single-variable as assumed, step 2 needs no code change and we go straight to testing.
