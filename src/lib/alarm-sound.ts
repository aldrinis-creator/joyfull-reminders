/**
 * Shared alarm audio.
 *
 * Browsers refuse to start sound that wasn't triggered by a user gesture, so
 * we create one AudioContext lazily and unlock it on the first interaction
 * anywhere in the app. Everything plays through a master gain node whose level
 * comes from the person's saved alarm volume.
 */

export type AlarmToneId = "siren" | "beeps" | "bell" | "chime" | "custom";

export const BUILT_IN_TONES: Exclude<AlarmToneId, "custom">[] = [
  "siren",
  "beeps",
  "bell",
  "chime",
];

/** How long one pass of each tone lasts, in seconds. */
const TONE_LENGTH: Record<Exclude<AlarmToneId, "custom">, number> = {
  siren: 2.2,
  beeps: 2.0,
  bell: 2.0,
  chime: 1.6,
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let listenersAttached = false;

let settings: { tone: AlarmToneId; volume: number } = { tone: "siren", volume: 1 };
let customUrl: string | null = null;
let customBuffer: AudioBuffer | null = null;
let customBufferUrl: string | null = null;

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = new AudioCtor();
  master = ctx.createGain();
  master.gain.value = settings.volume;
  master.connect(ctx.destination);
  return ctx;
}

export function getAudioContext(): AudioContext | null {
  return createContext();
}

export function isAudioUnlocked(): boolean {
  return ctx?.state === "running";
}

/** Silent one-sample buffer — iOS only truly starts output after a real play. */
function kick(context: AudioContext) {
  try {
    const buffer = context.createBuffer(1, 1, context.sampleRate);
    const src = context.createBufferSource();
    src.buffer = buffer;
    src.connect(context.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

/** Resume (or create) the shared context. Resolves to whether sound can play. */
export async function unlockAudio(): Promise<boolean> {
  const context = createContext();
  if (!context) return false;
  if (context.state === "running") {
    kick(context);
    return true;
  }
  try {
    // Fire the kick synchronously inside the gesture, then resume.
    kick(context);
    await context.resume();
  } catch {
    return false;
  }
  if (context.state === "running") kick(context);
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

/** Apply the saved alarm preferences. Safe to call on every profile load. */
export function setAlarmSettings(next: { tone?: AlarmToneId; volume?: number; customUrl?: string | null }) {
  if (next.tone) settings.tone = next.tone;
  if (typeof next.volume === "number") {
    settings.volume = Math.min(1, Math.max(0, next.volume));
    if (master) master.gain.value = settings.volume;
  }
  if (next.customUrl !== undefined && next.customUrl !== customUrl) {
    customUrl = next.customUrl;
    customBuffer = null;
    customBufferUrl = null;
    if (customUrl) void loadCustomBuffer();
  }
}

export function getAlarmSettings() {
  return { ...settings };
}

async function loadCustomBuffer(): Promise<AudioBuffer | null> {
  const context = createContext();
  const url = customUrl;
  if (!context || !url) return null;
  if (customBuffer && customBufferUrl === url) return customBuffer;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    const buffer = await context.decodeAudioData(data);
    customBuffer = buffer;
    customBufferUrl = url;
    return buffer;
  } catch {
    return null;
  }
}

/** Preload a custom sound so the first alarm doesn't wait on the network. */
export async function preloadCustomAlarm(url: string | null): Promise<boolean> {
  setAlarmSettings({ customUrl: url });
  if (!url) return true;
  return (await loadCustomBuffer()) !== null;
}

function tone(
  context: AudioContext,
  out: GainNode,
  opts: {
    start: number;
    duration: number;
    from: number;
    to?: number;
    type?: OscillatorType;
    peak?: number;
  },
) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.setValueAtTime(opts.from, opts.start);
  if (opts.to !== undefined) {
    osc.frequency.linearRampToValueAtTime(opts.to, opts.start + opts.duration);
  }
  const peak = opts.peak ?? 0.9;
  gain.gain.setValueAtTime(0.0001, opts.start);
  gain.gain.exponentialRampToValueAtTime(peak, opts.start + 0.02);
  gain.gain.setValueAtTime(peak, opts.start + opts.duration - 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.duration);
  osc.connect(gain).connect(out);
  osc.start(opts.start);
  osc.stop(opts.start + opts.duration + 0.02);
}

function schedule(context: AudioContext, out: GainNode, id: Exclude<AlarmToneId, "custom">) {
  const t0 = context.currentTime + 0.02;
  if (id === "siren") {
    // Rising/falling wail, four sweeps — deliberately attention-grabbing.
    for (let i = 0; i < 4; i += 1) {
      const start = t0 + i * 0.55;
      tone(context, out, { start, duration: 0.27, from: 620, to: 1180, peak: 0.95 });
      tone(context, out, { start: start + 0.27, duration: 0.27, from: 1180, to: 620, peak: 0.95 });
    }
    return;
  }
  if (id === "beeps") {
    for (let i = 0; i < 8; i += 1) {
      tone(context, out, { start: t0 + i * 0.25, duration: 0.14, from: 1000, peak: 0.95 });
    }
    return;
  }
  if (id === "bell") {
    for (let i = 0; i < 4; i += 1) {
      const start = t0 + i * 0.5;
      tone(context, out, { start, duration: 0.42, from: 880, type: "triangle", peak: 0.8 });
      tone(context, out, { start, duration: 0.42, from: 1320, type: "sine", peak: 0.4 });
    }
    return;
  }
  // chime — the original soft two-tone
  [880, 1174.7].forEach((freq, i) => {
    tone(context, out, {
      start: t0 + i * 0.3,
      duration: 0.7,
      from: freq,
      type: "sine",
      peak: 0.35,
    });
  });
}

/**
 * Play one pass of the selected alarm sound.
 * Returns false when sound is still blocked by the browser.
 */
export function playAlarm(override?: { tone?: AlarmToneId; volume?: number }): boolean {
  // Self-sufficient: create the context if nothing has yet, and nudge a
  // suspended one awake instead of silently doing nothing.
  const context = createContext();
  if (!context || !master) {
    lastPlay = false;
    return false;
  }
  if (context.state !== "running") {
    void context.resume().catch(() => {});
  }

  let out = master;
  if (override?.volume !== undefined) {
    const g = context.createGain();
    g.gain.value = Math.min(1, Math.max(0, override.volume));
    g.connect(context.destination);
    out = g;
  }

  const id = override?.tone ?? settings.tone;
  if (id === "custom") {
    const buffer = customBuffer;
    if (!buffer) {
      void loadCustomBuffer();
      schedule(context, out, "siren");
      return true;
    }
    const src = context.createBufferSource();
    src.buffer = buffer;
    src.connect(out);
    src.start();
    return true;
  }
  schedule(context, out, id);
  return true;
}

/** How often the alarm should repeat for the current tone, in milliseconds. */
export function alarmIntervalMs(id: AlarmToneId = settings.tone): number {
  if (id === "custom") {
    const seconds = customBuffer?.duration ?? 3;
    return Math.max(1500, Math.round(seconds * 1000) + 300);
  }
  return Math.round(TONE_LENGTH[id] * 1000) + 200;
}

/** Backwards-compatible alias used by the alarm overlay. */
export function playChime(): boolean {
  return playAlarm();
}

/** Best-effort vibration fallback for phones. */
export function vibrateAlarm() {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try {
    nav.vibrate?.([600, 250, 600, 250, 600]);
  } catch {
    /* unsupported or blocked */
  }
}
