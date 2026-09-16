# Add entry points for Calendar and Medicines

## Problem
- **Calendar** (`/calendar`) is reachable only from a small calendar-icon button on the People page. It's not linked from Home, the most-visited screen.
- **Medicines** (`/medicines`) has **no entry point anywhere** — it's an orphaned route that can't be opened through normal navigation.

The bottom tab bar is already full (Today · People · ＋ · Gifts · Orders), so adding new tabs would crowd it. Instead, both screens get icon-link buttons in the Home header next to the existing profile circle, mirroring the icon-button pattern already used on the People page.

## Change

### 1. Home header icon buttons — `src/routes/_authenticated/home.tsx`
In the header row that currently holds the profile-initial circle button, add two 48px outlined icon-link buttons **before** the profile circle:
- **Calendar** → `<Link to="/calendar">` with a `CalendarDays` icon and `aria-label={t("nav.calendar")}`.
- **Medicines** → `<Link to="/medicines">` with a `Pill` icon and `aria-label={t("nav.medicines")}`.

Both reuse the existing `Button asChild variant="outline" size="icon"` styling already used for the profile button. Wrap the three (Calendar, Medicines, Profile) in a `flex items-center gap-2` cluster so they sit neatly together.

Keep the existing People-page calendar icon as-is (no removal) — it stays a second, contextual entry point.

### 2. New i18n key — `src/lib/i18n/locales/common.ts`
Add `nav.medicines`:
- en: `"nav.medicines": "Medicines"`
- hi: `"nav.medicines": "दवाइयाँ"`

`nav.calendar` already exists in both locales — no change needed there.

## Verification
- `bunx tsgo --noEmit` passes (the `/calendar` and `/medicines` route files already exist, so the `Link to` paths typecheck cleanly).
- Build log reports `build OK`.
- Visual: on the Today/Home screen, the header shows Calendar + Medicines icon buttons beside the profile circle; tapping each opens the right screen.
