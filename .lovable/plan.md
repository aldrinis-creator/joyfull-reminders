# PIN lock for the Document Shelf

Protect the Document Shelf behind a 4-6 digit PIN, stored only as a one-way hash on the server.

## What the user sees

**First visit to the Document Shelf (no PIN yet)**
A friendly prompt: "Set a PIN to protect your documents", with the PIN typed twice to confirm. A "Set up later" button skips it — never a hard block — and the prompt reappears on the next visit until a PIN is set.

**Visits once a PIN exists**
An "Enter PIN" screen appears before any document is shown. A correct PIN unlocks the shelf for the rest of that browser session; navigating around the app doesn't ask again, but closing and re-opening the app does.

**Wrong attempts**
After 5 wrong tries the input is disabled for 30 seconds with a visible countdown.

**In Profile**
A new "Document Shelf PIN" card with:
- Change PIN — asks for the current PIN, then the new one twice.
- Forgot PIN? — sends a one-time code to the verified phone using the existing code flow; only after the code checks out can a brand new PIN be set.

All text in English and Hindi.

## Technical design

**Database**
Migration adds `profiles.documents_pin_hash text` (nullable). No policy change needed — profiles are already owner-scoped — but the client never reads this column directly; all access goes through server functions.

**Hashing**
PBKDF2-SHA256 (150k iterations) via WebCrypto, which works in the Worker runtime without native deps. Stored as `pbkdf2$<iterations>$<saltB64>$<hashB64>`. Comparison is constant-time on the server.

**Server functions** — new `src/lib/documents-pin.functions.ts`, all with `requireSupabaseAuth`, hashing in `src/lib/documents-pin.server.ts`:
- `hasDocumentsPin()` → `{ hasPin: boolean }`
- `setDocumentsPin({ pin })` → validates 4-6 digits with Zod, hashes, overwrites the stored hash
- `verifyDocumentsPin({ pin })` → returns `{ ok: boolean }` only
- `resetDocumentsPinWithOtp({ phone, code, pin })` → consumes the OTP through the existing `consumeOtp` helper (same path `PhoneVerifyDialog` uses), and only then writes the new hash

The hash is never returned to the client. Attempt counting and the 30-second cooldown are client-side UX; server-side OTP rate limits already guard the recovery path.

**UI**
- `src/components/DocumentsPinGate.tsx` — wraps the shelf content in `/documents`; handles the set-up prompt, enter-PIN screen, attempt counter, countdown, and the `sessionStorage` unlock flag (`ereminder.documentsPinUnlocked`).
- `src/components/DocumentsPinCard.tsx` — Profile card with Change PIN and Forgot PIN? dialogs, reusing the existing OTP request/verify calls.
- New `pin` i18n namespace with full English + Hindi strings.

## Testing

Typecheck and build, plus browser checks of the set-up prompt, the lock screen, wrong-attempt counting and the 30-second countdown, session-unlock persistence across navigation and re-lock after reload. Signed-in checks depend on whether a preview session can be minted; I'll state plainly which parts were exercised live versus read-only, and I will not send a real recovery SMS unless you want me to.
