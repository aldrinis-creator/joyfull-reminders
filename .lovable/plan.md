# Organic Step 2: Landing Page

## What will change
- Rebuild the public landing page as a full-bleed cream layout within a centered 900px content column.
- Add the compact My-Mitr navigation, sign-in link, and terracotta account button.
- Create the hero with the specified typography, copy, decorative terracotta/sage circles, and a washed family-photo placeholder.
- Add a reusable `.washed` photo utility for later Organic screens.
- Replace the current feature grid with the four specified Organic feature cards and exact English copy.
- Remove the old lower call-to-action treatment so only the navigation and hero account buttons remain.
- Add complete English and Hindi translations for every new visible label.
- Preserve the existing signed-in redirect to Today without changing its behavior.

## Responsive behavior
- Keep the requested desktop sizing and spacing where space permits.
- On phones, collapse feature cards to one column, simplify navigation links, scale the headline to fit, and reposition decorative/photo circles without overlap.

## Technical details
- Update only `src/routes/index.tsx`, `src/styles.css`, and the public translation namespace.
- Continue using the existing Button, TanStack links, Lucide icons, Organic semantic color tokens, Caprasimo, and Figtree.
- Preserve route-specific metadata and add the required social metadata fields if currently missing.
- Verify compilation, current preview diagnostics, and screenshots at desktop and mobile sizes.
