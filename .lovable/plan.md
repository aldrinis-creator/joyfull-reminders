# Profile Organic redesign

## Build
- Replace the stacked Profile cards with one mobile-first scroll: identity, three live stat tiles, two grouped settings panels, and the outlined sign-out action.
- Use the saved avatar, name, phone, and verified timestamp; fall back to the app’s existing person placeholder pattern.
- Derive every summary from current account data: tracked dates, streak, completed gifts, notification channels, alarm choice/volume, calendar state, document count/PIN state, address, and order count/spend.
- Keep direct toggles inline. Open alarm, notification-device, address, language, and document-PIN controls in bottom sheets without changing their underlying behavior.
- Make Calendar sync an inline switch backed by the existing private calendar-link state, with its existing controls available in a sheet when enabled.
- Preserve routes to Documents and Orders, and keep phone verification reachable from the identity area.

## Copy and styling
- Add all new Profile copy to the existing English and Hindi dictionaries.
- Apply the Organic card, terracotta, sage, typography, spacing, switch, divider, and action treatments using existing semantic design tokens.

## Verification
- Check desktop and mobile Profile rendering, sheet opening, row summaries, links, toggles, and sign out.
- Confirm current diagnostics report a successful build and fix any errors introduced by this change.

## Assumptions
- “Dates kept” is the de-duplicated total of reminders and family special dates currently tracked.
- “Completed gift orders” includes delivered orders; total spent includes successfully paid/fulfilled gift orders and excludes pending, failed, and cancelled orders.
- The app supports only English and Hindi, matching the existing locale configuration.
