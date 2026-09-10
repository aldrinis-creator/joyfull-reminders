# A loud, customisable reminder alarm

## What you get

- When a reminder is due and the app is open, it plays a **loud urgent alarm** — a repeating siren-style pattern that keeps going until you tap Done or Snooze (still capped at 60 seconds).
- In Profile, a new **Alarm sound** section:
  - a short list of built-in tones (Siren, Urgent beeps, Classic bell, Gentle chime) each with a Preview button
  - **Upload your own** MP3/WAV (up to about 2 MB) to use instead
  - a **Volume slider** with a Test button, defaulting to maximum
- Your choice is saved to your account, so it applies on every device you sign in on.

## Honest note about notifications when the app is closed

The loud alarm plays when e-Reminder is open on screen. When the app is closed, the alert arrives as a phone notification, and **the phone — not the app — decides how loud that is and which sound it uses**. Web apps cannot force a custom alarm tone on a closed phone. To make those louder, set the e-Reminder notification channel on your phone to a loud/alarm tone and turn off Do Not Disturb for it. We will add a short "make notifications louder" help note in Profile explaining this per phone type.

## How it will be built

1. **Sound engine** (`src/lib/alarm-sound.ts`): replace the two-tone chime with a configurable alarm engine — a rising/falling siren sweep plus sharp beeps at high gain, driven through a master gain node set from the saved volume. Keep the existing unlock-on-first-interaction handling and the "Tap to hear the alarm" fallback.
2. **Built-in tones**: generated in code (no audio files to download), each defined as a small pattern description so more can be added later.
3. **Custom upload**: new private storage bucket `alarm-sounds` with owner-folder policies; the file is fetched, decoded once and played through the same volume-controlled path, with automatic fallback to the built-in siren if it cannot load.
4. **Saved settings**: reuse the existing `profiles.alarm_sound` column for the chosen tone id, and add nullable `alarm_volume` and `alarm_sound_path` columns.
5. **Profile UI**: an Alarm sound card with tone list, Preview/Test, volume slider, upload/remove control, and the notification-loudness help note.
6. **Alarm overlay**: keeps ringing with the selected sound until dismissed/snoozed, plus the existing vibration.
7. All new text goes through the translation helper with English and Hindi entries.

## Verification

Typecheck and build, then in the preview: preview each tone, move the volume slider, upload a short file and play it back, and confirm a due reminder rings loudly and stops on Done/Snooze.
