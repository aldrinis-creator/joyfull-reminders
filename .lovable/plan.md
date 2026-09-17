# Fuller medicine records + a voice assistant that actually answers

## 1. Why the mic gives no answer (confirmed)

The recording your phone makes is labelled `audio/webm;codecs=opus`. The speech service
rejects that exact label — it accepts `audio/webm`, but not with the codec suffix — so every
voice question came back as "Sorry, that didn't work". I reproduced this in the live logs.

A second, hidden fault: the voice used for speaking answers aloud has been retired by the
provider, so even a successful question would have stayed silent.

Fix:
- Send a clean audio label (drop the codec suffix) and name the upload to match.
- Move the speaking voice to the provider's current one.
- If either step still fails, show the real reason ("I could not hear that clearly", "voice
  reply unavailable") instead of one generic apology, and keep the answer on screen as text.
- Verified end to end: a real spoken clip transcribes correctly once the label is clean.

## 2. Medicines — a proper medicine record

Today a medicine is only a set of daily reminders, so there is nowhere to keep quantity or an
end date. This adds a real medicine record, keeping the dose reminders working exactly as now.

Each medicine gets:

- Name and dosage (e.g. Metformin, 1 tablet)
- **Frequency**: every day, certain days of the week, or every N days
- **Day of the week** picker, shown only for the weekly option
- Instructions (e.g. take after food)
- **Total quantity** and **remaining**
- **Low-stock threshold** (default 5)
- **Schedule times** — add as many times as needed, not just the four fixed slots
- **Start date** and optional **end date**

Editing: every medicine card opens the same form pre-filled, and saving updates the reminders
behind it — times added, removed or retimed as needed. Removing deletes the medicine and its
reminders after a confirm.

### Refills

- Each time a dose is ticked as taken, remaining drops by one.
- When remaining falls to the threshold or below, the medicine card turns amber with
  "Only {n} left — time to refill", and a refill banner appears at the top of the Medicines
  screen listing everything running low.
- The banner has a "Refilled" button that asks for the new quantity and resets remaining.
- A medicine past its end date stops producing doses and moves to a finished state.

Dose rows, the taken tick, the streak, the all-taken panel and the late-dose WhatsApp alert
all stay exactly as they are.

## Technical notes

**Data** — new `public.medicines` table (user_id, name, dosage, frequency, days_of_week,
interval_days, instructions, total_qty, remaining_qty, low_stock_threshold, times[],
start_date, end_date, active, timestamps) with GRANTs, RLS owner-only policies, and
`updated_at` trigger. `reminders` gains a nullable `medicine_id` FK so each dose reminder
points back at its medicine; existing daily health reminders keep working untouched.

**Decrement** — `completeReminder` (or a thin wrapper used by the Medicines screen) decrements
`remaining_qty` when the reminder carries a `medicine_id`, floored at 0.

**Form** — `MedicineForm.tsx` rewritten around the new fields; on save it writes the medicine
row then reconciles reminders (`recurrence` daily / weekly / custom with
`recurrence_interval_days`) per schedule time.

**Screen** — `medicines.tsx` reads medicines from the new table (falling back to the existing
reminder grouping for medicines created before this change), adds the low-stock banner, amber
cards, edit/remove, and the finished state.

**Voice** — `voice.functions.ts`: strip mime parameters before building the upload, switch TTS
to `bulbul:v3` with a supported speaker, and return distinct failure reasons.
`AskAssistant.tsx` maps those reasons to distinct messages.

**Copy** — all new strings via `t()` with English and Hindi entries.

**Verification** — `bunx tsgo --noEmit` clean, `build OK`, and a real spoken sample round-tripped
through transcribe → answer → speech.
