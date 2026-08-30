# Fix WhatsApp OTP delivery and duplicate reminder alerts

## 1. Duplicate WhatsApp/SMS reminder alerts (confirmed cause)

Checked the live data: the reminder "Payment of Airtel bill" has two alert rows (at due time and 2 hours before), and **both** were marked as notified for the same occurrence — so two WhatsApp messages went out for one reminder. Every reminder created in the app gets two alert rows by default, so this happens to all of them.

Fix in the delivery job:
- Group the due alerts by reminder + occurrence and send **one** message per reminder occurrence, using the most relevant open alert (the closest one to the due time whose window has opened).
- Stamp *all* of that reminder's alert rows for the same occurrence as notified, so a second row can never fire for the same occurrence — this applies to WhatsApp, SMS and email alike.
- The next occurrence of a recurring reminder re-arms normally, as today.

## 2. WhatsApp OTP not firing

The WhatsApp credentials are configured, so the send is being attempted but the message never arrives. The current code only treats an HTTP failure as an error: MSG91 answers with HTTP 200 and an error body when it rejects a template (wrong template name, wrong language locale, or a button component the approved template doesn't have). We therefore report "code sent" while nothing was delivered, and the real reason is thrown away.

Work:
- Parse MSG91's response body for the OTP WhatsApp send (same handling the greeting and reminder senders already use) and treat a rejection as a failure, so the user sees a real error and the SMS fallback kicks in instead of a silent dead end.
- Log the provider's rejection reason server-side (never the code itself) so the exact cause is visible.
- Make the template name, language locale and the optional copy-code button configurable, and drop the button component when the approved template has none — a mismatched component is the most common cause of a silent rejection for authentication templates.
- Then run one real test send to your number, read the provider's response, and correct the template name/locale to match what MSG91 has approved.

I'll need one thing from you at that point: the phone number to test with (and confirmation that `ereminder_verification_otp` is the exact approved template name, whether its language is English or English (US), and whether it has a copy-code button).

## Technical notes
- Delivery job: `src/routes/api/public/cron/dispatch-reminders.ts` — dedupe by `reminder_id` + `due_at` before sending, then bulk-update every matching `reminder_alerts` row's `last_notified_occurrence_at`.
- OTP: `src/lib/msg91.server.ts` (`sendOtpWhatsapp`) — inspect the 200-with-error body, optional `button_1`, env-overridable template/locale; `src/lib/otp.server.ts` keeps the existing fallback behaviour.
- No schema change, no user-facing copy change beyond existing translated error strings.

## Verification
Trigger the delivery job against a test reminder with two alerts and confirm exactly one WhatsApp message and one stamped occurrence; request a WhatsApp OTP and confirm it arrives (or that the provider's rejection is now reported accurately).
