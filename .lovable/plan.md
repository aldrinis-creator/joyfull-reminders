# Recurring bills: no fixed amount, plus a note on pulling bill data

## 1. Don't carry an amount on recurring reminders

For a bill that repeats (monthly electricity, yearly insurance), a saved amount goes stale and can push a wrong figure into the payment app. Change:

- **Reminder form** — the "Amount" field in the payment shortcut section only appears when recurrence is "Once". Choosing any repeating recurrence hides it and clears the stored amount, with a short line explaining that the amount is entered at payment time because it changes each cycle.
- **Pay now / Pay with GPay** — for a recurring reminder the deep link is built without the amount, so Google Pay (or any UPI app) opens with the biller pre-filled and the amount blank for the user to type. One-off reminders keep the pre-filled amount exactly as today.
- **Reminder card and full-screen alarm** — instead of any amount, show a short prompt under the payment buttons: "Amount changes each cycle — enter the current bill amount in your payment app." Nothing else about the card changes.
- All new text added to both English and Hindi dictionaries.

## 2. Can we pull the bill from a consumer / account number?

Short answer: not directly, and not for free.

In India the only sanctioned way to fetch a live bill from a consumer number is **BBPS (Bharat Connect)**. Billers do not expose public APIs; access is through a licensed BBPS agent, and an app reaches it via an aggregator (Razorpay, Cashfree, Setu, Billdesk and similar). That means:

- A commercial agreement plus KYC/onboarding with the aggregator, and usually a per-fetch or per-transaction fee.
- Coverage is good for electricity, gas, water, broadband, DTH, and postpaid mobile — but each biller must be picked from the BBPS biller list, not free text.
- Once live, the flow is: user picks biller + enters consumer number once, the app fetches due amount and due date on each cycle, and the reminder auto-updates itself — which is genuinely better than a typed amount.

Recommendation: ship item 1 now (correct behaviour with zero cost), and treat BBPS as a separate, later piece of work once you decide on an aggregator. If you already have a Razorpay or Cashfree account, tell me which one and I can plan the bill-fetch integration against it: store biller ID + consumer number on the reminder, fetch the bill a few days before the due date via a server function on the existing cron, and show the real amount and due date on the card.

## Technical notes

- `payment_amount` stays in the schema; it is simply not written for recurring reminders and not used when building the UPI query in `src/lib/pay-link.ts` (the shortcut type gains the recurrence so the link builder can decide).
- No database migration and no payment processing — the app still only hands off to the user's own UPI app or the biller's page.

## Verification

Typecheck and build, then in the preview: a monthly bill reminder shows no amount field and its GPay link carries no `am=` parameter, a one-off reminder keeps its amount end to end, and both read correctly in English and Hindi.
