# Fix date/time overlap + Google-powered address lookup

## 1. Date and Time fields overlap

On the new-reminder screen the Date and Time inputs sit in a fixed two-column grid (`grid-cols-2`) with no width constraint. Native date/time inputs have a built-in minimum width, so on narrow phones each input is wider than its column and spills over the neighbour — that is the overlap.

Fix:

- Give both inputs `w-full min-w-0` and let the grid columns shrink (`grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`), stacking to a single column on the narrowest widths.
- Apply the same treatment to the other date inputs in the app (add-family-member form, member special-date form) so they can't clip either.
- Verify at 320px, 375px and desktop widths with a screenshot pass.

## 2. Address recognition with Google Maps

Every place the app asks for an address gets type-ahead suggestions after a few characters, and a resolved address always fills **City** and **Pincode** as their own fields.

Screens affected:

- Profile → default delivery address (city already exists; pincode field added)
- Gift checkout → delivery address (city + pincode fields added, pincode pre-filled from the recipient)
- Vendor shop signup and shop settings → shop address (city and pincode already exist, now auto-filled)
- Family member → their city/pincode stay manual (contacts usually only share a pincode)

Behaviour:

- Type 3+ characters, see a dropdown of matching Indian addresses, pick one, and the street line, city and 6-digit pincode fill in automatically.
- Every field stays editable, and typing a full address by hand still works — Google lookup is an assist, never a requirement.
- If a picked place has no pincode, we ask for it inline rather than saving a blank one.
- If the lookup service is unreachable, the field silently falls back to plain text entry.

## Technical notes

- **Key stays server-side.** `GOOGLE_API_KEY` is never shipped to the browser. Two server functions in `src/lib/places.functions.ts`:
  - `searchAddresses({ query, sessionToken })` → Google Places Autocomplete (New) `places:autocomplete`, `regionCode: "IN"`, returns `{ placeId, primary, secondary }[]`.
  - `resolveAddress({ placeId, sessionToken })` → Places Details with a `formattedAddress,addressComponents,location` field mask, returns `{ line, city, state, pincode, lat, lng }` parsed from `locality`/`postal_town`, `administrative_area_level_1` and `postal_code`.
  - Both are `createServerFn` with `requireSupabaseAuth`, Zod-validated input (query 3–120 chars), and a per-user throttle so the key can't be burned through the app. Session tokens are passed through for Google's cheaper session billing.
- **Shared UI:** new `AddressAutocomplete` component (input + Command-style suggestion list, 300 ms debounce, keyboard navigable, `aria-expanded`/`role="listbox"`), used by profile, checkout and vendor forms. It emits the full parsed result so each caller writes its own city/pincode state.
- **Data:** `profiles` gains `pincode`; `orders` gains `delivery_pincode` and `delivery_city` so vendors see them as structured fields. Migration includes GRANTs; existing owner RLS policies cover the new columns. Checkout Zod schema (`src/lib/orders.schemas.ts`) requires a valid 6-digit pincode and a city, validated again server-side in `createGiftOrder`.
- Vendor pincode capture keeps feeding the existing recipient-aware ranking (exact pincode → 5 km → 25 km → pan-India), so auto-filled pincodes immediately improve shop matching.

## Build order

1. Date/time layout fix + width audit of all date inputs.
2. Places server functions and `AddressAutocomplete` component.
3. Migration for the new pincode/city columns.
4. Wire profile, checkout and vendor forms; validate server-side.
