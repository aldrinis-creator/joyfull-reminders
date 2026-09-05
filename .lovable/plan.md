# Connect Razorpay web checkout (no app-store fees)

## What you asked

Accept payments via Razorpay **outside** the app stores, so Apple/Google never take their 30% cut.

## The good news

e-Reminder is a web app (PWA) — payments already run in the browser, not inside an App Store / Play Store app, so **the 30% store commission does not apply at all**. You only pay Razorpay's standard processing fee (~2%). The app even opens Google Pay / UPI deep links as an alternative today.

The Razorpay integration is also **already built** in the app:

- "Pay now" on the order page opens Razorpay's own secure checkout window in the browser (cards, UPI, netbanking, wallets).
- The server creates the Razorpay order and re-checks the amount against the vendor's listed price before payment.
- A signed webhook marks the order "paid" only after Razorpay confirms the money arrived — the browser can never mark an order paid itself.

What's missing is only the **configuration**: your Razorpay account keys and the webhook hookup. That's what this plan finishes.

## Changes

1. **Add your Razorpay API keys** (you paste them into a secure form — nothing in code):
   - `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — from your Razorpay dashboard → Settings → API Keys. Start with **test-mode** keys so we can run a full test payment without real money, then switch to live keys when you're happy.
2. **Set up the payment-confirmation webhook**:
   - In your Razorpay dashboard → Webhooks, add the URL `https://e-reminders.lovable.app/api/public/razorpay/webhook`, tick the `order.paid`, `payment.captured` and `payment.failed` events.
   - You create one strong random secret (e.g. via a password manager), paste it into that webhook form, and save the same value as `RAZORPAY_WEBHOOK_SECRET` in the secure form here.
3. **Small code improvement** in the webhook handler (`src/routes/api/public/razorpay/webhook.ts`): also record `payment.failed` events, so a failed payment shows up clearly on the order instead of leaving it hanging on "pending".
4. **End-to-end test**: with test keys in place, place a small gift order in the preview, pay with Razorpay's test card / test UPI, and confirm the order flips to "Paid" automatically via the webhook.

## Out of scope

- No native app wrapping, no in-app purchase — checkout stays 100% web, so no store commission now or later.
- Gift orders are the only paid flow today; bill reminders keep using the existing GPay/UPI hand-off (the app never touches that money).

## Verify

- Typecheck + build clean.
- Test-mode payment on the preview flips the order to "Paid" without any manual step.
- Failed test payment is recorded as failed.

## What I need from you (during build)

1. Razorpay test-mode Key ID + Key Secret (paste into the secure form when prompted).
2. Later, the live keys when you're ready to accept real money.
3. The webhook secret you generate, plus 2 minutes to paste the webhook URL into your Razorpay dashboard.
