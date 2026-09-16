# Organic step 3 — full-screen alarm (2a)

Rebuild `src/components/AlarmOverlay.tsx` into a three-state screen: ringing, snoozed, handled. The chime, snooze storage and alarm-sound wiring stay exactly as they are.

## Ringing
- Full-bleed terracotta ground, cream text, 30/26/26 padding, everything centred.
- Kicker "Ringing now · {time}" in small spaced caps at 85% opacity.
- 150px round photo of the person the reminder is for (family photo when there is one, otherwise the same initials circle the rest of the app uses), with two pulsing white rings behind it, the second delayed 350ms.
- Big 38px headline: "{Name} turns {age}" for a birthday with a known age, otherwise the reminder title. Under it a 16px line saying what happens if they ignore it, written per category.
- Spacer, then the action stack with 10px gaps:
  - 62px cream pill — the main action for that category.
  - 58px outlined pill — the secondary action, only when the category has a real one.
  - Row of two 54px translucent pills: "Snooze 10 min" and "Done".
- The existing "tap to hear the alarm" retry button stays, shown only when the browser is blocking sound.

## Category actions
| Category | Primary | Secondary |
| --- | --- | --- |
| Personal & Family | Call {name} (`tel:` from the saved number; falls back to opening the reminder when no number) | Send a gift (existing gift entry point) |
| Bills / Household | Pay ₹{amount} via the existing pay hand-off | Copy UPI ID when a UPI ID is saved, else none |
| Vehicle | Find a centre (Google Maps search near the user) | Mark renewed (existing done flow) |
| Health | Taken (done flow) | Skip (logs a skipped occurrence, distinct from done) |
| Anything else | Open (reminder edit page) | none |

No invented second button when a category has no sensible one.

## Snoozed
Cream screen, 72px terracotta circle with a clock popping in, "Back at {time}.", then "I'll ring loudly again. {n} snoozes left before I just keep ringing." and a 52px outlined "Ring it again now". Snoozes are capped at 3 per occurrence — after the third the snooze pill disappears and the alarm just keeps ringing.

## Handled
Sage screen, 86px sage circle with a checkmark popping in, "Handled." and a line naming the real consequence per category (next occurrence date, payment noted, dose logged), then a 52px outlined pill to close.

## Technical notes
- `snooze.ts` gains a per-reminder snooze counter (local mirror + existing occurrence rows) and a `SNOOZE_CAP = 3` helper; the existing persistence and DB shape are unchanged.
- `AlarmHost` passes the reminder's family recipients (already does), the complete mutation and a new skip path; the overlay owns which of the three states is on screen.
- "Skip" writes a `skipped` reminder occurrence and advances a recurring reminder without touching the streak.
- All copy goes through `t()` with new English and Hindi keys in `src/lib/i18n/locales/home.ts`.
- Overlay stays a fixed top-layer element; nothing about how or when alarms fire changes.

## Verification
Typecheck and build, then a preview render of each state at mobile width.
