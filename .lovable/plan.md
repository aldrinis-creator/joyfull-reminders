# Fix the Send a Gift screen

Three fixes: the gift order dialog layout and its "Continue to payment" action, address auto-suggestions everywhere, and a Google Pay option on the order screen.

## 1. Gift dialog layout (the "x" problem)

The order dialog currently makes the whole popup scroll, including the corner close button, so the "x" drifts off-screen and the footer button can end up out of reach.

Change the dialog so it never exceeds the screen:
- Cap the popup at the visible screen height and lay it out as a fixed header / scrolling middle / fixed footer.
- The title bar and the "x" stay pinned at the top; only the form fields scroll.
- The "Continue to payment" button stays pinned at the bottom, always tappable.
- Make the close button a larger, clearly visible tap target with a proper background, and respect the phone's safe area at the bottom.

Applies to the shared dialog component, so every other popup in the app benefits.

## 2. "Continue to payment" not firing

The button runs validation first and only shows a small toast if something is missing. Two likely reasons nothing appears to happen: the button/toast is out of the visible frame (fixed by step 1), or the server rejects the order.

Work:
- Fix the layout first, then re-test the flow signed in.
- Make failures obvious: show the validation problem inline next to the offending field (recipient, address, city, pincode, date) instead of only a toast, and surface the real server error message when order creation fails.
- Log the server-side failure reason so we can confirm the cause rather than guess.

If the retest shows a genuine server-side error, that root cause gets fixed in the same pass.

## 3. Address auto-suggestions

Confirmed cause: the current Google key is restricted to website referrers, so our server-side address lookup is rejected with `403 API_KEY_HTTP_REFERRER_BLOCKED` and the code silently returns zero suggestions. That is why nothing ever appears.

Work:
- You add a second, server-only Google key as a secret (`GOOGLE_PLACES_SERVER_KEY`) with Places API (New) enabled and no referrer restriction (IP restriction is fine). I will request it through the secure secret prompt.
- The lookup uses that key when present, falling back to the existing key.
- Stop swallowing errors: log the Google error status server-side and show a short "Address suggestions are unavailable right now — type the address manually" hint in the field so it never fails silently again.
- Use the shared address field on every remaining address input (profile saved location, vendor shop address, checkout, any family/recipient address), each with its own City and Pincode boxes auto-filled from the chosen suggestion.

## 4. Google Pay button on the order screen

Razorpay stays the main payment path. Added alongside it on the order page, while the order is awaiting payment:
- A "Pay with Google Pay" button that opens GPay pre-filled with the order amount (taken from the order's stored amount, never a browser-supplied figure), the shop name, and the order reference.
- Falls back to the generic UPI app chooser if GPay is not installed.
- Shown only when the shop has a UPI ID on file; vendors get a UPI ID field in their shop profile for this. Orders paid this way stay "awaiting payment" until the shop confirms it, with a short note explaining that — the app never handles the money.

All new text goes through the English/Hindi translation files.

## Technical notes

- `src/components/ui/dialog.tsx`: flex column, `max-h-[90dvh]`, non-scrolling header/footer, scrollable body slot; close button z-index above the scroll area.
- `src/routes/_authenticated/market.$vendorId.tsx`: adopt the new dialog structure, per-field error state, real error surfacing from `createGiftOrder`.
- `src/lib/places.functions.ts`: prefer `GOOGLE_PLACES_SERVER_KEY`, return a `reason` field on failure; `AddressAutocomplete` renders the unavailable hint.
- Migration: add `upi_id` and `upi_payee_name` to `public.vendors` (vendor-editable, guarded like the other vendor-owned columns), exposed in the vendor portal form.
- `src/lib/pay-link.ts` already builds `tez://upi/pay` and `upi://pay` links; the order page reuses it with the order amount converted from paise.
