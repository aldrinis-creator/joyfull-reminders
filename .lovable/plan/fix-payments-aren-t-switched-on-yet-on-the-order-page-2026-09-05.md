# Fix "Payments aren't switched on yet" on the order page

## What's happening

The screenshot shows the "Payments aren't switched on yet" message on the gift order page. That message appears only when the server can't see the Razorpay keys at the moment you tap "Pay now".

The keys **are saved** — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` all exist in the project's secure secret store. The most likely cause is that the preview's running server was started before the keys were added, so it hasn't picked them up yet. (Unconfirmed until we test — step 1 below verifies it.)

## Changes

1. **Restart the preview server** so it loads the newly saved Razorpay secrets, then re-check the order page — in most cases this alone flips the "Pay now" button to open Razorpay checkout.
2. **If the message still appears**, inspect the server logs for the checkout call to see exactly why the keys aren't being read (e.g. environment injection lag on the preview), and fix that specific cause.
3. **End-to-end test with the test-mode keys**: place a small gift order, tap "Pay now", complete a Razorpay test payment, and confirm the order flips to "Paid" automatically via the webhook.
4. **Webhook dashboard step (you, 2 minutes)**: in your Razorpay dashboard → Webhooks, confirm the URL `https://e-reminders.lovable.app/api/public/razorpay/webhook` is added with the `order.paid`, `payment.captured`, and `payment.failed` events, using the same webhook secret you saved here.

## Verify

- "Pay now" opens the Razorpay checkout window instead of the red error message.
- A test payment flips the order to "Paid" without any manual step.
- Typecheck/build clean.

## What I need from you

- Just re-test after the restart. If you haven't added the webhook in your Razorpay dashboard yet, that step is needed for the order to flip to "Paid" automatically.
