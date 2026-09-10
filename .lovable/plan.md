# Do we need this? Short answer, and what I'd build instead

## 1. Payment pages per family member — no, skip it

You don't need them:

- Greetings are free to send. There is nothing to charge for, so linking payment details to a relative has no purpose.
- Card / UPI details should never be typed into our app. On the gift orders that do cost money, the payer enters their details on Razorpay's own secure screen. Storing anything payment-related per family member would add real risk for no gain.
- Razorpay checkout is already built and working: "Pay now" on a gift order opens Razorpay's secure window, the amount is re-checked against the shop's listed price on the server, and the order only flips to "Paid" after Razorpay itself confirms the money arrived.

The only piece still outstanding is a one-time setup in your Razorpay dashboard (adding the payment-confirmation address and running a test payment). That is a 5-minute task on your side, not app building. Say the word and I'll walk you through it.

## 2. Reminder sound — already fixed; custom chime is worth building

The chime now rings when the pop-up appears (fixed in the last change). The custom-chime upload is a genuine new feature, so that's what this plan builds.

### What you'll get

- A **Reminder sound** section in Profile.
- A short list of **built-in tones** (Classic chime, Soft bell, Urgent beeps), each with a Play button to preview.
- An **Upload your own sound** option: pick an audio file from your phone or computer, preview it, then save. Limits: audio files only, up to 10 seconds, up to 2 MB, so alarms stay quick to load.
- Your choice is saved to your account and used by every reminder alarm on every device you sign in on.
- A **Remove** action to go back to the default chime.
- The alarm pop-up plays your chosen sound on a loop for its one-minute ring, and keeps the existing "Tap to hear the alarm" fallback and vibration when the phone is still blocking sound.

## Technical notes

- Reuse the existing unused `profiles.alarm_sound` column: it stores either a built-in tone key (`classic`, `bell`, `beeps`) or a storage path for an uploaded file.
- New private storage bucket `alarm-sounds` with owner-folder policies (same shape as `greeting-voice-notes`), plus an authenticated server function returning a short-lived signed URL for playback.
- `src/lib/alarm-sound.ts` gains a `playAlarm()` that plays a decoded `AudioBuffer` for a custom/built-in file on the shared, pre-unlocked `AudioContext`, falling back to the current synthesized two-tone chime if decoding or fetching fails. Buffer is fetched and cached once when the app loads so the alarm never waits on the network.
- `useChime` in `AlarmOverlay.tsx` calls `playAlarm()` instead of `playChime()`; blocked/vibration behaviour unchanged.
- Built-in tones stay synthesized in code (no binary assets to ship).
- Upload validated both client-side and in the server function (MIME type, size, duration).
- All new UI text goes through `t()` with full English + Hindi entries.

## Verification

Typecheck and build, then in the preview: pick a built-in tone and preview it, upload a short sound and preview it, save, trigger a due reminder and confirm the chosen sound plays, then remove it and confirm the default chime returns. Check the same screens in Hindi.
