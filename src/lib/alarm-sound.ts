/**
 * Shared alarm audio.
 *
 * Browsers refuse to start sound that wasn't triggered by a user gesture, so
 * the alarm chime used to be created (and silently blocked) at the moment the
 * pop-up appeared. We instead create one AudioContext lazily and unlock it on
 * the first interaction anywhere in the app, so later alarms can ring on their
 * own. When it is still blocked, callers can show a "tap to hear" fallback.
 */

let ctx: AudioContext | null = null;
let listenersAttached = false;

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = new AudioCtor();
  return ctx;
}

export function getAudioContext(): AudioContext | null {
  return createContext();
}

export function isAudioUnlocked(): boolean {
  return ctx?.state === "running";
}

/** Resume (or create) the shared context. Resolves to whether sound can play. */
export async function unlockAudio(): Promise<boolean> {
  const context = createContext();
  if (!context) return false;
  if (context.state === "running") return true;
  try {
    await context.resume();
  } catch {
    return false;
  }
  return isAudioUnlocked();
}

/** Register a one-time unlock on the first interaction. Returns a cleanup fn. */
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined" || listenersAttached) return () => {};
  listenersAttached = true;
  const events: (keyof WindowEventMap)[] = ["pointerdown", "touchstart", "keydown"];
  const handler = () => {
    void unlockAudio().then((ok) => {
      if (ok) cleanup();
    });
  };
  const cleanup = () => {
    events.forEach((e) => window.removeEventListener(e, handler));
    listenersAttached = false;
  };
  events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
  return cleanup;
}

/** Two-tone chime on the shared context. No-op when sound is still blocked. */
export function playChime(): boolean {
  const context = ctx;
  if (!context || context.state !== "running") return false;
  [880, 1174.7].forEach((freq, i) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = context.currentTime + i * 0.28;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain).connect(context.destination);
    osc.start(t);
    osc.stop(t + 1);
  });
  return true;
}

/** Best-effort vibration fallback for phones. */
export function vibrateAlarm() {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try {
    nav.vibrate?.([400, 200, 400]);
  } catch {
    /* unsupported or blocked */
  }
}
