# e-Reminder — Build Plan

A mobile-first web app (installable on phones) for reminders, family milestones, a vendor marketplace, and Razorpay payments. Native iOS/Android is not built here; the web app is responsive and phone-optimised, and can be wrapped natively later.

## First step: design directions

Before any code, I'll render 3 clickable design concepts around your brief (warm amber, vivid teal, coral pink, deep indigo; large type, high contrast, card layouts, elderly-friendly). You pick one and everything below is built in that style.

## Phase 1 — Foundation & accounts

- Lovable Cloud backend (database, auth, storage, server functions).
- Sign-up/login: Email + password, Google sign-in, phone OTP.
- Onboarding: profile, optional location permission (for nearby vendors), create your Family Circle.
- Bottom tab shell: Home, Family, Marketplace, Calendar, Profile.

## Phase 2 — Reminder engine

- Create/edit reminders: title, category, description, date & time, optional birth year, recurrence (once/daily/weekly/monthly/yearly/custom).
- Categories: Personal & Family, Finance & Tax, Automotive (PUC, insurance, servicing), Academic & Career, Subscriptions & Trials, Custom.
- Multiple alert offsets per reminder (7 days before, 1 day before, on the day at a set time, custom).
- Home timeline: chronological feed grouped by urgency (Today / This week / Later) with category colour coding.
- Calendar tab: month grid + list view, filterable by category.

## Phase 3 — Family hub

- Family members: name, relationship, birth year/age, photo.
- Special dates: birthday, anniversary, memorial, exam schedule — auto-generating recurring reminders and computed upcoming age.
- "What makes them happy": likes, tastes, music genres, gift hints — surfaced as gift suggestions when their event nears.
- Wishlist per member; shared/group reminders assigned to other members of the circle.

## Phase 4 — Alarm & dismissal

- Full-screen overlay when a high-priority reminder is due, with chime playing up to 60 seconds (user-selectable sound).
- Dismiss (marks acknowledged), Snooze (15 min / 1 hour / tomorrow), and an Action Shortcut that jumps straight to "Order cake", "Order flowers" or "Pay bill".
- Web push notifications for alerts when the app is closed.

## Phase 5 — Vendor marketplace

- Two vendor sources, both supported: seeded demo vendors so the marketplace is populated from day one, plus a vendor self-signup portal where shops register, set their service radius, and manage listings.
- Buyer view: florists, bakeries, gift shops; distance-sorted within a 3–5 km radius with an all-India fallback for pan-India sellers.
- Product listings, cart-free single-item checkout, delivery date tied to the reminder.
- Order lifecycle: Placed → Confirmed → Out for delivery → Delivered, with notifications at each step and a post-delivery confirmation banner.

## Phase 6 — Razorpay payments

- "Pay Now" sends the user to a hosted payment page that initialises Razorpay Standard Checkout.
- Razorpay calls a secure webhook (`order.paid` / `payment.captured`); the server verifies the HMAC SHA256 signature, updates the order, then returns the user to the app's confirmation/tracking screen.
- Orders are only marked paid by the verified webhook, never by the browser redirect.

## Phase 7 — Engagement

- Exam & career tracker with document checklists.
- Subscription/trial manager alerting 3 days before auto-debit.
- Streaks and badges for on-time completion, redeemable as vendor coupons.
- Profile & settings: family circle management, notification preferences, payment history.

## Technical notes

- Stack: TanStack Start (React + TypeScript), Tailwind, Lovable Cloud (Postgres + auth + storage), server functions for all backend logic.
- Schema: `profiles`, `family_members`, `special_dates`, `reminders`, `reminder_alerts`, `reminder_instances`, `wishlist_items`, `family_circles` + `circle_members`, `vendors`, `vendor_products`, `orders`, `order_events`, `payments`, `user_roles` (user/vendor/admin in a separate roles table). Row-level security scopes every table to its owner or circle.
- Razorpay needs **your own Razorpay Key ID, Key Secret and Webhook Secret** — Lovable's built-in payment providers are Stripe and Paddle, so Razorpay runs on your keys, stored as encrypted secrets. I'll ask for them at Phase 6; everything before that can be built and tested without them.
- Phone OTP sign-in requires an SMS provider (Twilio or MSG91) configured in Cloud auth; I'll flag this at Phase 1 and keep email + Google working regardless.
- Web push and background alarms are reliable when the app is installed to the home screen; iOS Safari requires installation for push.

## Suggested order of delivery

Phases 1–4 first (a fully usable reminder app), then 5–6 (marketplace + payments), then 7. I'll build them in sequence and you can review after each.
