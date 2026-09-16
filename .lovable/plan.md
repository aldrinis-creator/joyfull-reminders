# Rename e-Reminder to My-Mitr

## What will change
- Replace the visible product name with **My-Mitr** throughout the English and Hindi app interface, sign-in, assistant, marketplace, alerts, greetings, and document screens.
- Update every page title and social-sharing title to use **My-Mitr**.
- Update installable-app metadata so newly installed home-screen apps show **My-Mitr**.
- Update email sender names and branded email content to **My-Mitr**.
- Update calendar feed names and exported calendar branding to **My-Mitr**.
- Update notification-facing branding where the app supplies it.

## What will stay unchanged
- Keep existing live URLs and domain-bound WebOTP text working; renaming the product does not automatically rename a domain.
- Keep approved MSG91 template identifiers such as `ereminder_weekly_digest` unchanged, because renaming those identifiers would break approved WhatsApp delivery.
- Keep internal storage keys and code filenames unchanged where users never see them, preserving existing preferences, sessions, snoozes, and integrations.

## Verification
- Search the live product source for any remaining user-visible old-name references.
- Check English and Hindi screens, page titles, install metadata, and email previews.
- Confirm the preview compiles cleanly and opens without runtime errors.
