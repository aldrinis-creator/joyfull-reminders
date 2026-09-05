# Restore the approved voice-greeting WhatsApp template

`ereminder_voice_greeting` is now approved on MSG91, so voice-note greetings go back to using it — with the proper "Open card" URL button — instead of squeezing the link into the plain-greeting text. Plain greetings keep using `ereminder_greeting` exactly as today.

## Changes

1. **Restore the voice-template branch** in `src/lib/greetings.deliver.server.ts`:
   - Voice-note greetings (has recording + card id) → template `ereminder_voice_greeting` (overridable via `MSG91_WA_VOICE_GREETING_TEMPLATE`), with:
     - body_1 = recipient name, body_2 = occasion, body_3 = sender name, body_4 = message text
     - button_1 = URL button, dynamic suffix = the greeting's card id (matches the approved `https://e-reminders.lovable.app/greeting/{{1}}` button)
   - Plain greetings → unchanged: `ereminder_greeting`, body_1/body_2 only.
2. **Add the WhatsApp namespace** from your approved payload as a project secret: `MSG91_WA_NAMESPACE = e67e5302_b6d0_403e_b3cc_8fa6e8accb01`. The code already passes the namespace when this is set — currently it isn't, and template sends without the namespace can be rejected by WhatsApp.
3. **Keep everything else as-is**: email fallback on WhatsApp rejection, delivery-status recording (`provider_status` / `provider_error` via the MSG91 webhook), and the reminder-alert "Dear User" issue stay untouched.

## Verify

- Typecheck + build clean.
- Stubbed payload check: confirm voice greetings send `ereminder_voice_greeting` with body_1–4 + URL button and the namespace, and plain greetings still send `ereminder_greeting`.
- You then re-send a real voice greeting to +91 70458 68482 from the preview; the greeting row should show "Delivered to their phone" once the provider report comes back.

## Technical notes

- Only file touched: `src/lib/greetings.deliver.server.ts` (restoring the branch that was in place before the last change).
- New secret is added via Project Settings secrets tooling; no code change needed for it.
