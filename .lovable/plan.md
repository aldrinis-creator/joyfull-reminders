# Voice greeting not received on WhatsApp — diagnosis and fix

## What the records show

The greeting you sent at 09:44 to +917045868482 (contact "Check-iN") was saved as **sent**, with a 13-second recording attached and a provider reference returned by the messaging provider. So the app did its part and the provider accepted the request — but nothing tells us whether the phone actually received it, because greetings do not record a delivery report today (only sign-in codes do).

Two things are most likely behind the silence, and both are template-related:

1. **The card link travels inside a template text field.** For a greeting with a recording, the app appends "Hear a voice message from …: https://…" into the message variable of the approved `ereminder_greeting` template. WhatsApp routinely rejects or silently drops links placed inside a text variable — links are supposed to come either as fixed text in the approved template or as a proper URL button. That would explain: plain greeting arrived earlier, greeting with a recording did not.
2. **No delivery visibility.** Without a delivery report saved against the greeting we are guessing. That should be fixed regardless.

## About your question: sender names

WhatsApp always shows **your business profile name** as the sender — there is no way to make a message appear to come from an individual user's own name or number. What we can do is put the names inside the message itself, which needs template variables. Today's template only carries two: the recipient's name and one blob of message text. So yes — a new template is worth creating.

## Proposed new WhatsApp template

Name: `ereminder_voice_greeting`, category Utility, language English.

```text
Hi {{1}}, you have a {{2}} greeting from {{3}}.

{{4}}

Tap below to open the card and hear their voice message.
```
Button: "Open card" — dynamic URL, `https://e-reminders.lovable.app/greeting/{{1}}`

- {{1}} recipient name, {{2}} occasion, {{3}} sender name, {{4}} the message text
- The link moves out of the text and into an approved URL button, which is the supported way to send links.

The existing `ereminder_greeting` stays as-is for greetings with no recording.

## Work to do once the template is approved

1. Send greetings with a recording through the new template (recipient name, occasion, sender name, message, and the card id in the button); keep the current template for plain greetings, with no link stuffed into the text.
2. Record the provider's delivery report against each greeting (delivered / read / failed plus the provider's reason), reusing the existing status webhook, so a silent failure is visible instead of guessed.
3. Show that status on the reminder's greeting row, so you can see "Delivered" or "Failed — reason" rather than only "Sent".
4. Fall back automatically: if the provider rejects the WhatsApp send and the contact has an email address, send the emailed card (which already embeds the player) instead of failing quietly.
5. Re-test to +917045868482 with a fresh recording and confirm the delivery report comes back.

## Technical notes

- New template name behind an environment setting (`MSG91_WA_VOICE_GREETING_TEMPLATE`), defaulting to `ereminder_voice_greeting`, alongside the existing `MSG91_WA_GREETING_TEMPLATE`.
- `deliverWhatsapp()` in `src/lib/greetings.deliver.server.ts` picks the template by whether a voice note is present, sends `body_1..body_4` plus `button_1` (URL suffix = greeting id), and stops appending the link to the body.
- Migration: add `provider_status` and `provider_error` to `public.greetings` (+ index on `provider_message_id`); extend `src/routes/api/public/msg91/whatsapp-status.ts` to stamp greetings as well as OTP challenges.
- Both the immediate path (`sendGreeting`) and the scheduled path (`greetings.dispatch.server.ts`) go through the same delivery helper, so they pick this up together.
