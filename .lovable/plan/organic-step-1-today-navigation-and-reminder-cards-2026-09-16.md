# Organic Step 1: Today, navigation, and reminder cards

## Navigation shell
- Replace the five-tab bar with **Today · People · (+) · Gifts · Orders** while preserving the existing Home, Family, Market, and add-reminder destinations.
- Add a dedicated `/orders` list using the app’s existing owner-scoped orders query and existing order-detail links.
- Remove Calendar and Profile from the tab bar. Add a visible Calendar control to People and make the Today avatar link to Profile.
- Keep `AlarmHost` mounted in `AppShell` and replace the shared gradient header with a plain Organic background header so non-Today screens retain their title/action slots without layout breakage.
- Build the fixed Organic tab bar with stable active-dot spacing, 52–56px targets, and a raised 60px center add button.

## Shared reminder card
- Restyle cards to the Organic 26px-radius treatment and reduce the visible action area to one contextual action plus a 46px circular Done control.
- Use payment as the primary action when configured; use the existing gift destination for family reminders; show no extra primary action otherwise.
- Add a visible overflow button opening a bottom sheet containing edit, delete, WhatsApp/email sharing, add-to-calendar, and any secondary recipient/greeting controls, preserving existing confirmation and callback behavior.
- Keep all current `ReminderCard` call sites and mutation props compatible.

## Today screen
- Move the greeting, derived subtitle, status/date row, and tappable initials avatar into the Home scroll column.
- Preserve `nextOccurrence`, `bucketFor`, query caching, and optimistic completion behavior.
- Pin overdue reminders above the dated spine in the dark terracotta treatment.
- Group remaining reminders by calendar day into the 46px date rail, 14px dot/line rail, and right-hand card column, retaining the existing collapsed future-month section.
- Show the animated all-clear panel when the last Today item is completed, with the next upcoming date in its copy.
- Derive subtitle copy from overdue/today/next-event state rather than a static monthly total.

## Language and accessibility
- Add complete English and Hindi strings for Today, People, Orders, overflow actions, subtitle variants, status/date labels, and all-clear copy.
- Keep visible copy behind `useT()`, provide labels for avatar/overflow controls, preserve keyboard navigation, and maintain 44px-or-larger targets.

## Verification
- Confirm the generated route tree and build are clean.
- Exercise Today, People → Calendar, center Add, Gifts, Orders, Profile avatar, reminder completion, and overflow actions in the preview.
- Check mobile and desktop screenshots for clipping, tab stability, readable cards, and the dated spine.
