# Alarms that ring, automatic document reminders, and a snappier app

Four fixes, in this order.

## 1. The alarm doesn't ring when a reminder is due

Three separate reasons, all fixed together:

- The alarm pop-up only exists on the Home screen. If you are on Family, Documents, Profile or anywhere else, nothing happens. The alarm moves into the app frame so it can appear on any screen.
- Nothing re-checks the clock. The app only notices a reminder is due when the screen happens to redraw. A steady check every 15 seconds is added, plus an immediate check when you come back to the app.
- Only reminders marked high priority ever rang. Per your answer, every reminder now rings when it falls due.

The existing sound choice, volume, vibration and the "tap to allow sound" fallback all stay as they are. Snooze and Done keep working the same way.

## 2. The "Schedule it" choice in the greeting box

The choice between sending now and scheduling exists but sits partway down a scrolling box, so it is easy to miss and can be pushed out of view on smaller screens. It moves to the top of the greeting box, right under the occasion, as two clearly labelled buttons that are always visible, with the date and time fields appearing directly beneath when scheduling is picked. Same on Home cards and on a family member's page (both use the same box). Verified with a screenshot of the open box.

## 3. Automatic expiry reminders for documents

Right now a reminder is only created when you add a document through the form. A scheduled job runs once a day and, for every document that has an expiry date but no reminder yet, creates one for you: a 9am reminder on the expiry day, with alerts 7 days before and on the day, matching exactly what the manual flow creates. It also keeps an existing reminder's date in step if you change the expiry date, and never creates duplicates.

## 4. Slower-feeling saves and screen changes

Every screen currently re-fetches all its data from scratch on each visit, so tabs look blank then fill in. Changes:

- Cached data is shown instantly while fresh data loads quietly in the background.
- Saving a reminder, document or greeting updates the screen straight away instead of waiting for a full reload of the list.
- Buttons show a clear busy state so a save never feels like nothing happened.

## Technical notes

- New `useDueAlarm` hook + `<AlarmHost>` rendered in `AppShell` (or `__root`), driven by a 15s interval and a `visibilitychange` listener; Home stops owning `AlarmOverlay`. Due test drops the `priority === "high"` condition, keeps the snooze check.
- `GreetingComposer`: move the `mode` pill group above the card-style block; no logic change.
- New authenticated cron route `src/routes/api/public/cron/document-expiry.ts` guarded by `authenticateCronRequest`, scheduled daily via `cron.schedule` (03:00 IST). It reuses the same insert shape as `createExpiryReminder` (server-side, service role, scoped per `user_id`) for `documents` rows where `expiry_date is not null and reminder_id is null`, then writes back `reminder_id`.
- React Query: add `staleTime: 60_000` and `gcTime` defaults in the QueryClient in `src/router.tsx`; keep list queries mounted via placeholder data; convert list mutations in Home/Documents to optimistic cache updates instead of blanket `invalidateQueries`.

## Verification

Typecheck and build, then in the preview: set a reminder one minute out, navigate to another screen and confirm the alarm appears and sounds there; open the greeting box and screenshot the Schedule choice; run the new job once and confirm a reminder appears for an existing document with an expiry date.
