# Medicines screen, rebuilt + a talking Ask My-Mitr

Two pieces of work.

---

## 1. Medicines — add medicines properly, and a fuller day view

Today the Medicines screen can only *show* doses, and a dose only exists if you happened to create a reminder with the Health category set to repeat daily. There is no way to add a medicine from this screen. That is the gap.

### Add a medicine

A new "Add medicine" button at the top of the Medicines screen opens a bottom sheet:

- Medicine name (e.g. Metformin)
- Strength / dose (e.g. 500mg, 10ml, 1 tablet)
- How to take it (short note — e.g. after food)
- Times of day: tap Morning / Afternoon / Evening / Night to switch each on, each with its own editable time (defaults 08:00, 13:00, 19:00, 21:30)
- Start date (defaults today)

Saving creates one daily health reminder per selected time, so everything already built — today's dose list, one-tap "taken", the streak, the WhatsApp alert when a dose is late, alarms and notifications — keeps working with no rework.

### My medicines list

Below today's doses, a new "My medicines" section groups the daily health reminders by medicine name and shows one card each: name, strength, and the times it is taken ("8:00 am · 7:00 pm"). Each card has Edit (reopens the sheet, updates the times — adding/removing dose times as needed) and Remove (deletes that medicine's reminders, with a confirm).

### Layout refresh

- Header gains three small stat tiles: doses today, taken today, day streak.
- The empty state changes from "go make a reminder" to the new "Add your first medicine" button.
- Everything else on the screen (time blocks, dose rows, all-taken panel, late-dose WhatsApp alert panel) stays as it is.

### Not included

Pill counts left in the pack, refill alerts and course end dates are not stored anywhere today, so those would need new data. Say the word and I will add them as a follow-up.

---

## 2. Ask My-Mitr — speak, and it speaks back

Using your Sarvam account (Indian-language speech, works well for English and Hindi). After you approve this plan I will ask you to paste the Sarvam API key into a secure box — it is stored safely and never appears in the app's code.

How it will feel:

1. Tap the mic. It listens.
2. You speak. When you stop for about 3 seconds, it stops on its own — no second tap.
3. Your words appear as text, the assistant thinks, and the answer is **spoken aloud** as well as shown.
4. It then starts listening again automatically, so you can just keep talking. A "Stop" button and closing the sheet both end it.

Details:
- The speaking voice matches the app language (Hindi or English).
- The answer still comes from your own data only — the assistant's existing rules are unchanged.
- If the mic is blocked or speech isn't understood, you get a plain message and the typed box still works exactly as now.
- If Sarvam ever fails or the key is missing, the assistant falls back to today's behaviour (text-only) rather than breaking.

---

## Technical notes

**Medicines**
- New `MedicineForm` sheet component; on save it inserts N rows into `reminders` (`category: "health"`, `recurrence: "daily"`, `due_at` = start date at each selected time, title `"{name} {strength}"`, description = instruction). Edit diffs times: update existing, insert new, delete dropped.
- `src/lib/medicines.ts` gains `groupDosesByMedicine()` built on the existing `doseName`/`parseDoseAmount` helpers. No schema change, no change to `completeReminder`, `buildTodayDoses`, or `medicine-escalation.server.ts`.

**Voice**
- `SARVAM_API_KEY` stored via the secrets tool; requested after approval.
- New `src/lib/voice.functions.ts`: `transcribeSpeech` (POST base64 audio → Sarvam `speech-to-text`, `saarika` model, language `hi-IN`/`en-IN`) and `speakText` (POST text → Sarvam `text-to-speech`, `bulbul`, returns base64 wav). Both are `createServerFn` with `requireSupabaseAuth`; the key is read inside the handler and never reaches the browser.
- `AskAssistant.tsx`: replaces the browser `SpeechRecognition` path with `MediaRecorder` + a Web Audio RMS meter for the 3-second silence cut-off, then transcribe → existing `askAssistant` → `speakText` → `Audio` playback → auto-restart listening. Audio is capped at 30s per turn. The existing typed input path is untouched.

**Copy** — all new strings through `t()` with full English and Hindi entries in `src/lib/i18n/locales/*`.

**Verification** — `bunx tsgo --noEmit` clean and the preview build reporting `build OK`.
