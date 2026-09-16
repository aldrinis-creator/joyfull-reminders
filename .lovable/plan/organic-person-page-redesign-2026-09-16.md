# Organic Person Page Redesign

## Build
- Recompose the person page into a 196px terracotta photo header, overlapping identity card, special-dates block, and delivery coverage block.
- Reuse the Profile avatar fallback, existing member fields, date helpers, dialing behavior, Organic tokens, buttons, and card treatments.
- Derive any “today” badge only from real birthday/anniversary data; omit it when no date applies.
- Query vendors through the existing client query and apply the marketplace’s exact-pincode/serviceable-pincode rules to show truthful category counts.
- Keep special-date, contact, greeting, pincode-sharing, marketplace, and wishlist behavior unchanged while restyling those sections consistently.
- Add English and Hindi translations for every new or changed phrase.

## Technical details
- Keep the current family-member, special-date, and wishlist query/mutations intact.
- Add only the existing `useVendors()` data source for delivery coverage; no new server query or schema change.
- Use `dialNumber()` for the `tel:` action and existing date helpers for age/relative-date facts.
- Verify TypeScript, formatting, preview build diagnostics, and the rendered page where authentication permits.
