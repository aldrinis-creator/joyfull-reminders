# Greetings sent but not received — find out what WhatsApp actually did

## What the records show right now

- Only **one** new greeting was saved today after your last test: 16:59 to +91 70458 68482 (occasion "exam", no recording). The provider accepted it and returned a reference.
- For **Lira Alphonso** there is **no new greeting row at all** — her latest is still 09:48 this morning. So her send never reached the provider: the app refuses a second greeting for the same contact + occasion + channel and shows "already sent / already scheduled". That is why nothing went out for her.
- Every greeting row has an empty delivery report. Reason: the delivery-report webhook is switched off — it needs a shared secret (`MSG91_WEBHOOK_SECRET`) that is not configured, so the messaging provider's reports are rejected before they can be recorded. We have literally no evidence of what WhatsApp did with any message.
- One strong suspect for the number +91 70458 68482: it is also the WhatsApp Business number the app sends **from**. WhatsApp does not deliver a message from a business number to itself, so that test can never arrive — that number cannot be used as a test recipient.

Everything above is confirmed from the database and the code; nothing about handset delivery is confirmed either way, because no report is being stored.

## Plan

1. **Turn on delivery reports (webhook)** — add the shared secret, and give you the exact callback URL to paste into the messaging provider console. From then on each greeting records delivered / read / failed plus the provider's reason.
2. **Also pull the report actively**, so we are not dependent on the console being configured: right after sending, and again a minute later from the existing 10-minute job, ask the provider for the status of that message and store it on the greeting. This is what turns "sent" into a real answer.
3. **Record the provider's full response** on the greeting row when it is not a clean success, so a rejected template or an ineligible number is visible in the app instead of silent.
4. **Stop the silent duplicate block from looking like a success**: when a greeting is refused because one already went out for that occasion, show a clear message with an "Send again anyway" option, so a re-test actually sends.
5. **Re-test properly** to Lira's number (+91 99671 34652) — a number that is not the sending business number — once 1–3 are in, and read the recorded status.

## What I need from you

- A **webhook/callback secret**: create one strong random value, paste it into the provider's WhatsApp webhook settings together with the callback URL I give you, and save the same value in the app's secure secrets form.
- Confirmation of which number the app sends **from** (the business/integrated number), so we can rule the self-send problem in or out.

## Technical notes

- Webhook route already exists at `src/routes/api/public/msg91/whatsapp-status.ts`; it returns 503 until `MSG91_WEBHOOK_SECRET` is set. Callback URL: `https://e-reminders.lovable.app/api/public/msg91/whatsapp-status`.
- Active polling: new helper in `src/lib/greetings.deliver.server.ts` (or a sibling `greetings.status.server.ts`) calling MSG91's report endpoint by `provider_message_id`, invoked from `sendGreeting` and from the existing `dispatch-reminders` cron for greetings sent in the last hour with an empty `provider_status`.
- Store the raw non-success body in `greetings.provider_error` (already exists), truncated.
- Duplicate handling: `sendGreeting`'s `already_sent` branch plus a `force` flag in `sendGreetingSchema`, surfaced in `GreetingComposer`.
- Out of scope: the reminder-alert "Dear User" template issue.
