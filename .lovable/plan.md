# Alerts that reach you when e-Reminder is closed

## What's happening now

The chime only rings while the app is open on screen, because the sound comes from the web page itself. When the app is closed there is no page to play it. The WhatsApp and email alerts at the due time are the only thing that reaches you today.

## What we'll build

1. **Real phone notifications.** When a reminder falls due, your phone or computer shows a notification with the reminder title and its own notification sound, whether or not e-Reminder is open. Tapping it opens the reminder.
2. **A one-tap "Turn on notifications" control** in Profile, showing whether notifications are on for this device. You can turn them on for each phone/laptop you use.
3. **Add to Home Screen support** so e-Reminder installs like an app. On iPhone this is required — Apple only allows notifications for apps added to the home screen. We'll show a short "Add to Home Screen" hint on iPhone when it isn't installed yet.
4. **Keep WhatsApp and email alerts** exactly as they are, so you get both.
5. **In-app chime stays** for when the app is open.

## What you'll need to do

Notification delivery needs a Firebase account connected (free). I'll show a connect card at build time; you sign in with a Google account and pick/create a Firebase project, and I handle the rest.

Note: iPhone lock-screen notifications only work once you add e-Reminder to your home screen from Safari. Android and desktop work straight away in the browser.

## Technical notes

- Connect the Firebase Cloud Messaging connector (with web push) via `standard_connectors--connect`; send from the server through the Lovable connector gateway, never direct to FCM.
- Add `public/firebase-messaging-sw.js` (messaging worker only — no app-shell service worker, no `vite-plugin-pwa`) and a manifest-only PWA setup: `public/manifest.webmanifest`, app icons, and manifest/theme-color/apple-touch-icon tags in `src/routes/__root.tsx`.
- New table `push_tokens` (id, user_id, token unique, platform, user_agent, created_at, last_seen_at) with GRANTs and owner-scoped RLS; a `registerPushToken` / `removePushToken` server fn pair under `src/lib/push.functions.ts` using `requireSupabaseAuth`.
- Client helper `src/lib/push-client.ts` implementing the documented `enablePush()` flow, including the `open-in-new-tab` branch for the Lovable preview iframe, plus `denied` / `unsupported` / `not-configured` states.
- Extend `src/routes/api/public/cron/dispatch-reminders.ts`: alongside the existing WhatsApp/email sends, when `profiles.push_enabled` is true, fetch the owner's tokens and POST `v1/projects/_/messages:send` per token with title/body and `data.path` to the reminder; delete tokens on 404 UNREGISTERED / 400 INVALID_ARGUMENT. Reuse the existing per-occurrence dedupe so no duplicate alerts.
- Profile UI toggle wired to `push_enabled` plus per-device registration; all new strings added to `src/lib/i18n/locales/*` in English and Hindi.

## Verification

Typecheck and build, register a token from the published app, fire a due reminder through the cron path, and confirm the notification arrives with the app fully closed on Android/desktop, and on iPhone after Add to Home Screen.
