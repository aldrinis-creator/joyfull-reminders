# Publish alarm fixes + live verification

## Step 1 — Publish
Publish the current project (includes the AlarmHost fixes from commit-ready state: 5s tick, 30s reminders refetch, held-state handover, update banner). Expected live URL: https://mitr.world (deploy typically ~1 minute).

## Step 2 — Aldrin reloads the app (required)
The update banner only works once the new code is loaded, so this first reload must be manual:
1. On his iPhone, fully close My-Mitr (swipe up in the app switcher).
2. Reopen it from the home screen.
3. Cold start loads `AppShell-DzCKLAmD.js` — confirmed already live — so he will then have all fixes.

## Step 3 — Live alarm test
1. Aldrin creates a new reminder 2–3 minutes in the future (any category).
2. Keep the app open in the foreground.
3. Confirm at the due time:
   - The full-screen loud alarm (AlarmOverlay) appears with Taken / Skip / Snooze.
   - It appears within ~5 seconds of the due time (5s tick).
4. Report pass/fail. If it fails, next diagnostic: check reminder_deliveries + whether the reminders query had refreshed (the reminder should also appear in his home list within 30s of creation — if it doesn't, that's the caching path to dig into).
