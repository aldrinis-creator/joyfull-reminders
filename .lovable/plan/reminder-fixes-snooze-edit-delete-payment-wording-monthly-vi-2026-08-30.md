# Reminder fixes: snooze, edit/delete, payment wording, monthly view

## 1. Snooze actually sticks
Today the snooze is only kept in the Home page's React state, so any refresh, tab switch or navigation back to Home brings the full-screen alarm straight back — that's why "1 hour" feels like it re-fires within minutes.

Fix: persist snooze per reminder occurrence in the database (`reminder_occurrences.snoozed_until`, a table that already exists), with a localStorage mirror so it also holds instantly before the write returns. The alarm only shows when `now >= snoozed_until`. Snoozing 15 min / 1 hour / Tomorrow will then survive reloads.

## 2. Edit and delete reminders
- New route `/reminders/$reminderId/edit` reusing the same form as "New reminder", pre-filled, saving with an update instead of an insert (including alerts and the payment shortcut fields).
- On every reminder card: an "Edit" action and a "Delete" action; delete asks for confirmation and removes the reminder plus its dependent alert/occurrence rows, then refreshes the list.
- Both labels added to English and Hindi dictionaries.

## 3. "Biller" wording in the payment shortcut
Relabel the fields to "Payment link of biller", "UPI ID of biller", "Biller name", "Amount" (with matching Hindi). English + Hindi dictionary updates only; no logic change.

## 4. Google Pay instead of a generic UPI hand-off
The "Pay now" UPI button will open Google Pay's UPI deep link (`tez://upi/pay?...`) with the same pre-filled payee/amount/note, and fall back to the standard `upi://pay?...` link when Google Pay isn't installed/handled. Button label becomes "Pay with GPay" (Hindi equivalent added). "Copy UPI ID" stays as the desktop fallback.

## 5. Header counts this month only
Home subtitle becomes "4 events coming up this month" (singular variant for 1, and an empty-state variant), counting only reminders whose next occurrence falls in the current calendar month. Hindi strings added.

## 6. Month-first timeline
- The current month's reminders stay exactly as today: the tiles/cards grouped by urgency (Overdue / Today / This week / Later this month).
- Everything beyond the current month moves into a single collapsed "Later — N events" section that expands on tap, so the first screen stays short.

## Technical notes
- No schema change needed: `reminder_occurrences.snoozed_until` already exists; deletion cascades are handled explicitly if foreign keys don't cascade.
- The new edit route lives under `_authenticated`, and the existing new-reminder form is extracted into a shared form component used by both create and edit.
- All new UI text goes through the `t()` helper with full English + Hindi entries, per project convention.
- No payment processing is added — GPay/UPI remains a pure deep-link hand-off.

## Verification
Typecheck and build, then check in the preview: snooze 1 hour then reload (alarm must stay hidden), edit + delete a reminder, the month-only header count, the collapsed beyond-this-month section, and the same screens in Hindi.
