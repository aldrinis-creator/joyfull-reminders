# Automatic bill fetching — no build work

The question about pulling bill data from a consumer/account number was answered as a feasibility discussion only. Per your answer, nothing is built now.

## If/when you want it later

- Requires Razorpay Bharat Connect (BBPS) enabled as a commercial add-on on your Razorpay account (KYC + per-fetch fees).
- Then: biller picker + consumer-number field on bill reminders, a Validate step (fetch returns account holder name + current bill), and the existing 10-minute cron re-fetches the bill before the due date and updates the reminder's amount and due date.

## No code, migration, or cron changes in this step.
