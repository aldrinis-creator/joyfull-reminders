# Fold greeting delivery into the existing reminder cron (cost saving)

## Goal
Remove the separate `dispatch-greetings` pg_cron job (96 runs/day) and deliver scheduled greetings from inside the already-running `dispatch-reminders` job (every 10 min). Total scheduled jobs stay at **one** — the reminder job — so no extra database wake-ups. Greetings actually get delivered *faster* (≤10 min after their scheduled time instead of ≤15).

## Changes

1. **Extract the greeting dispatch loop into a shared server helper**
   - Move the body of `src/routes/api/public/cron/dispatch-greetings.ts` (query due greetings → claim → deliver via `deliverGreeting` → update status) into `src/lib/greetings.dispatch.server.ts` as an exported `dispatchDueGreetings(supabaseAdmin)` function returning the same summary. Logic unchanged.

2. **Call it from the reminder cron**
   - In `src/routes/api/public/cron/dispatch-reminders.ts`, after reminders are dispatched, call `dispatchDueGreetings(...)` with the same service-role client and include the greeting summary in the route's JSON response.

3. **Remove the standalone route and job**
   - Delete `src/routes/api/public/cron/dispatch-greetings.ts`.
   - Remove the `dispatch-greetings` pg_cron job (`SELECT cron.unschedule('dispatch-greetings')`), leaving only `dispatch-reminders` at `*/10 * * * *`.

4. **Verify**
   - `bunx tsgo --noEmit` clean.
   - Insert a test scheduled greeting due now, hit the reminder cron route with the cron secret, confirm it gets delivered and a second run shows no double-send; delete test rows.
   - Confirm `cron.job` lists only `dispatch-reminders`.
   - Confirm unauthenticated cron calls still return 401.

## Result
- 1 job instead of 2; greeting runs/day drop from 96 to 0 (piggybacked on the existing job).
- Delivery latency improves to ~10 minutes worst case.
- No user-facing or UI changes.
