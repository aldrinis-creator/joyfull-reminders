# Ever Bloom

Master System Prompt: Building "e-Reminder"

Markdown

### SYSTEM PROMPT: MOBILE & WEB APP DEVELOPMENT FOR "e-Reminder"

 

#### 1. PROJECT OVERVIEW & VISION

"e-Reminder" is a modern, vibrant, and multi-generational reminder and task-management application. It is designed to relieve users from the stress of fast-paced, multi-tasking lives by ensuring they never miss important personal milestones, administrative deadlines, financial obligations, or family events. The app blends high-utility task tracking with a delightful, happiness-focused vendor fulfillment ecosystem (florists, bakeries, gift shops) and external web-based payment processing via Razorpay.

 

#### 2. BRANDING & UI/UX DESIGN DIRECTIVES

- **Color Palette & Visual Vibe:** Bright, bold, and uplifting colors (e.g., energetic warm ambers, vivid teals, joyful coral pinks, and deep indigo for contrast). The UI should evoke happiness, fulfillment, love, and peace of mind.

- **Interface Experience:** Ultra-smooth, seamless, predictable, and accessible. High contrast, large readable fonts, intuitive icons, and clean card-based layouts suitable for both tech-savvy youth and elderly users.

- **Tab Hierarchy:**

  1. **Home / Timeline:** Unified chronological feed of upcoming reminders, categorized by urgency and event type.

  2. **Family Milestones:** A dedicated priority tab showcasing immediate and extended family members, highlighting their upcoming birthdays, anniversaries, exam dates, and personal milestones.

  3. **Vendor Marketplace:** Local fulfillment options (Florists, Cake Shops, Gift Shops) within a 3–5 km radius.

  4. **Calendar & Categories:** Grid/List views filterable by category (Tax, Vehicle, Health, Investments, Utility Bills, Household).

  5. **Profile & Settings:** Account details, connected family circles, notification preferences, and payment history.

 

#### 3. FUNCTIONAL REQUIREMENTS & MODULES

 

##### A. Account Creation, Login & Onboarding

- **Sign-Up Options:** Phone Number (OTP), Email & Password, and Social Single Sign-On (Google / Apple).

- **Profile Setup:** User profile creation with optional Location permissions (for 3–5 km local vendor discovery) and Family Circle creation.

- **Family Hub Creation:** Ability to add profiles for family members, capturing:

  - Full Name & Relationship (e.g., Mother, Spouse, Child).

  - Birth Year / Age (automatically calculates upcoming age/milestone anniversaries).

  - Special dates (Birthdays, Anniversaries, Memorial/Death Anniversaries, Exam Schedule).

- the family member likes, tastes, music genres liked or any other aspect of what makes them happy.

 

##### B. Smart Reminder Engine & Category Tagging

- **Event Categories:**

  - *Personal & Family:* Birthdays, Anniversaries, Death Anniversaries, Family Milestones.

  - *Finance & Tax:* IT Returns Filing, FD Maturity, Rent, Utility Bills, Insurance Renewals, SIPs/Investments.

  - *Automotive (India Specific):* PUC (Pollution Under Control) Expiry, Vehicle Insurance, Servicing.

  - *Academic & Career:* Exam Application Form Deadlines, Interview Reminders, Project Deadlines.

  - *Custom/General:* Any user-defined task or errand.

- **Data Capture Fields:** Title, Category, Description/Narration, Date & Time, Optional Birth Year/Age, Recurrence/Frequency (Once, Daily, Weekly, Monthly, Yearly, Custom Intervals).

- **Customizable Alert Schedules:** Multiple notification triggers (e.g., "7 days before", "1 day before", "On the day at 9:00 AM", or custom offset).

 

##### C. Alarm, Popup & Dismissal Protocol

- **Due Date Alarm Display:** When a high-priority reminder is due, trigger a full-screen or prominent overlay popup.

- **60-Second Active Alarm:** Plays a user-selected ambient/alarm chime for up to 60 seconds.

- **Action Buttons:**

  - **Dismiss:** Stops sound, marks event as acknowledged/completed.

  - **Snooze:** Customizable snooze options (15 mins, 1 hour, Tomorrow).

  - **Action Shortcut:** Direct link to fulfill (e.g., "Order Cake" or "Pay Bill").

 

##### D. Local Marketplace & Order Fulfillment (3–5 km Radius) Ideally an all_India vendor.

- **Vendor Integration:** Connect with local Florists, Bakeries/Cake Shops, and Gift Shops based on geofencing (3–5 km radius from user's active/saved location).

- **Milestone Gifting Flow:** When a Birthday or Anniversary alert triggers, display curated nearby gift/cake/flower options.

- **Order Lifecycle Tracking:**

  - **On the Day of Delivery:** Push notification updating delivery status (e.g., "Out for Delivery").

  - **Post-Delivery Confirmation:** Notification & in-app confirmation banner upon successful delivery.

 

##### E. External Razorpay Payment Integration (Webhook Return Pattern)

- **Payment Architecture:**

  1. User selects a gift/flower/cake or service in the app and taps "Pay Now".

  2. The app redirects the user to an external web payment page hosted on the backend server.

  3. The web page initializes Razorpay Standard Checkout.

  4. Upon payment completion, Razorpay fires a server-to-server **Webhook** (`order.paid` or `payment.captured`) to the app backend.

  5. The backend validates the signature, updates the order status in the database, and redirects the user back to the app via a Deep Link / Custom URL Scheme.

  6. The app catches the deep link return and displays the payment confirmation and tracking dashboard.

 

#### 4. YOUTH-CENTRIC & ENGAGEMENT FEATURES (ADDITIONAL SUGGESTIONS)

1. **"Never-Late" Exam & Career Tracker:** Dedicated tracker for national/university entrance exam registration deadlines with auto-filled document checklists.

2. **Subscription & Trial Manager:** Tracks OTT platforms, gym memberships, and software trials, sending alerts 3 days before auto-debiting.

3. **Shared Family Reminders ("Group Reminders"):** Assign reminders to siblings or family members so everyone stays synced for parents' anniversaries or joint bill payments.

4. **Wishlist & Gift Hints:** Family members can maintain an in-app wishlist so gift-givers buy what they actually want.

5. **Gamified Consistency Streaks:** Rewards users with badges or local vendor discount coupons for completing/dismissing tasks on time.

 

#### 5. TECHNICAL STACK & ARCHITECTURE SUGGESTIONS

- **Frontend:** React Native / Flutter (Cross-platform iOS & Android) with local notifications and background task schedulers.

- **Backend:** Node.js / Python FastAPI with PostgreSQL / MongoDB for user and event stores.

- **Payment & Webhooks:** Razorpay API integration with secure HMAC SHA256 signature verification on webhooks.

- **Location Services:** Google Maps API / Location Services for 3–5 km geofenced vendor matching.

 

#### 6. OUTPUT EXPECTED

Please generate:

1. Complete Information Architecture and Screen-by-Screen User Flow.

2. UI/UX Wireframe Concepts for Home, Family Milestones, Alarm Popup, and Marketplace.

3. Database Schema for Users, Reminders, Family Members, Vendors, and Orders.

4. Step-by-Step API Specification for the Razorpay Webhook Payment Flow.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://joyfull-reminders.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/17d8316c-d311-4315-859e-81bfa64ad6ef).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

  
 