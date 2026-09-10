# Why the reminder alarm is silent — and the fix

## What's happening

The pop-up shows, but the chime is created only at the moment the alarm appears. Phone and desktop browsers block sound that starts on its own, without the person having tapped something first. So the sound is created in a "blocked" state, the app never notices, and the alarm stays silent while the interval keeps firing into a muted output.

This also explains why it can occasionally work: if you had just tapped something on the page, sound is temporarily allowed.

## The fix

1. **Unlock sound on the first tap anywhere in the app.** The very first time you touch or click anything after opening e-Reminder, the app quietly prepares the sound channel and keeps it ready. From then on the alarm can ring by itself.
2. **Handle the blocked case honestly.** If sound is still blocked when an alarm fires (fresh page, no tap yet), the alarm shows a clear "Tap to hear the alarm" button; tapping it starts the chime immediately.
3. **Add vibration as a backup** on phones that support it, so a blocked alarm is still noticeable.
4. **Keep the chime playing reliably** for its one-minute ring: check the sound channel is actually running before each ping instead of assuming it is.
5. Keep the existing behaviour otherwise: same two-tone chime, same 60-second limit, stops on Done/Snooze.

## Technical notes

- Add a small shared audio helper (e.g. `src/lib/alarm-sound.ts`): one lazily-created `AudioContext`, a one-time `pointerdown`/`keydown`/`touchstart` unlock listener registered from the app root, and an exported `isAudioUnlocked()` / `unlockAudio()` pair.
- `useChime` in `AlarmOverlay.tsx` uses that shared context instead of constructing its own, checks `ctx.state === "running"` before scheduling oscillators, and exposes a `blocked` flag when `resume()` fails or the state stays `suspended`.
- Blocked state renders a localized "Tap to hear the alarm" button in the overlay; tapping calls `unlockAudio()` then restarts the chime.
- `navigator.vibrate([400, 200, 400])` on alarm mount, guarded for unsupported browsers.
- New UI strings go through `t()` with English + Hindi entries per project convention.

## Verification

Typecheck and build, then in the preview: load Home, let an alarm fire after a tap (chime audible), and reload without tapping to confirm the "Tap to hear the alarm" fallback appears and works.
