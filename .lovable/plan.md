# Greetings + Pincode-based Gifting

Two connected additions: sending greetings to your family/contacts on their special days, and collecting each contact's pincode so the app can show shops that actually deliver to *them*.

## My advice up front

- **Contacts:** keep everything inside the app's Family Hub. Phone-contact import only works on Android Chrome and is blocked on iPhone and desktop, so it would fail for most users. Family members get two new optional fields (email, WhatsApp number) and become the single contact list.
- **Greetings:** start with email, which works immediately with built-in sending. WhatsApp needs a WhatsApp Business provider and pre-approved message templates — that approval takes days and is outside the app, so it gets built as a second channel behind a clearly-labelled "needs setup" state rather than blocking the release.
- **Gifting:** storing only the pincode is the right call. It is enough to find shops near the recipient, it is low-risk if a contact shares it casually, and the full delivery address is collected once at checkout.

## 1. Greeting sender

**Ask first, then send.** Nothing goes out automatically.

- Each family member gets optional **email** and **WhatsApp number** fields, plus a "Send greetings to this person" toggle.
- When a birthday/anniversary reminder comes due, the reminder card and the alarm popup gain a **"Send greeting"** action.
- Tapping it opens a composer: pick occasion, pick a card style, edit the auto-written message (name and occasion pre-filled), choose channel (Email / WhatsApp / copy-share), preview, send.
- Every send is recorded so the timeline shows "Greeting sent to Amma — 29 Aug" and the same greeting is never sent twice for the same occasion.
- **Email channel:** sends through Lovable's built-in email with a branded greeting card design. Requires connecting a sending domain once — I'll walk you through it when we get there.
- **WhatsApp channel:** a template-based send through a WhatsApp Business provider. Until credentials are added, the option shows "Connect WhatsApp to enable" and offers a share-link fallback that opens WhatsApp on your own phone with the message pre-filled.
- **Share fallback:** always available. Generates a public greeting-card page you can send through any app.

## 2. Pincode-based gifting

- Family members get **pincode**, **city**, and optional recipient phone.
- If the pincode is missing when you tap "Send gift", a short sheet asks for it first (with a "Ask them for it" share-link option that lets the contact fill in their own pincode privately).
- Vendor discovery switches from "near me" to **"near the recipient"**: shops are matched to the recipient's pincode area first, then by distance within 3–5 km, then pan-India shippers as a fallback so gifting never dead-ends.
- Marketplace and vendor pages show "Delivers to 400705" or "Ships pan-India" so it's obvious before ordering.
- Checkout is pre-filled with recipient name, phone and pincode; only house/street lines and delivery date remain to be entered.

## Technical notes

**Database (one migration)**
- `family_members`: add `email`, `whatsapp_phone`, `pincode`, `city`, `greetings_enabled`.
- New `pincodes` table (code, city, state, lat, lng) seeded with major Indian pincode centroids so recipient coordinates can be derived without a paid geocoding API; unknown pincodes fall back to prefix/city matching.
- `vendors`: add `serviceable_pincodes text[]` and `pincode`, so shops can declare exact delivery coverage in the vendor portal.
- New `greetings` table (family_member_id, reminder_id, occasion, channel, message, status, sent_at, provider_message_id) with owner-scoped RLS and GRANTs.

**Sending**
- `sendGreeting` server function (auth middleware): validates the contact belongs to the caller, renders the message, dispatches by channel, writes the `greetings` row with an idempotency key of `member + occasion + year`.
- Email uses the scaffolded app-email template helper (a new `greeting-card` React Email template).
- WhatsApp uses provider credentials stored as secrets; missing credentials return a `configured: false` result the UI renders as "Connect WhatsApp".

**Vendor matching**
- `findVendorsForPincode(pincode)` resolves the pincode to lat/lng, then ranks: exact `serviceable_pincodes` match → within 5 km → within 25 km → `ships_all_india`.

**UI**
- New `GreetingComposer` dialog, greeting action on `ReminderCard` and `AlarmOverlay`, contact fields in the family add/edit forms, a "Gift & greeting details" section on the member page, recipient-context banner on the marketplace, and coverage editing in the vendor portal.

## Build order

1. Migration (contact fields, pincodes, vendor coverage, greetings table).
2. Contact detail capture + "ask for pincode" share link.
3. Greeting composer with share-link channel (works with zero setup).
4. Email channel + branded card template.
5. Recipient-aware vendor discovery and pre-filled checkout.
6. WhatsApp channel behind credential check.
