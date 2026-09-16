/**
 * Snooze persistence.
 *
 * The full-screen alarm used to be silenced with component state only, so any
 * refresh or tab switch brought it straight back. We now store the snooze per
 * reminder occurrence: a localStorage mirror for instant effect, plus a
 * `reminder_occurrences` row so it survives on other devices too.
 */
import { supabase } from "@/integrations/supabase/client";

const KEY = "ereminder.snoozes";

export type SnoozeMap = Record<string, number>;

export function readSnoozes(): SnoozeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SnoozeMap;
    const now = Date.now();
    return Object.fromEntries(Object.entries(parsed).filter(([, until]) => until > now));
  } catch {
    return {};
  }
}

function writeSnoozes(map: SnoozeMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage full or blocked — the in-memory state still applies */
  }
}

/** Snooze a reminder for `minutes`; returns the updated local map. */
export function snoozeLocally(reminderId: string, minutes: number): SnoozeMap {
  const next = { ...readSnoozes(), [reminderId]: Date.now() + minutes * 60_000 };
  writeSnoozes(next);
  return next;
}

/** Best-effort history/sync row so the snooze holds across devices. */
export async function recordSnooze(
  reminderId: string,
  occurrenceAt: Date,
  minutes: number,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  await supabase.from("reminder_occurrences").insert({
    user_id: userId,
    reminder_id: reminderId,
    occurrence_at: occurrenceAt.toISOString(),
    status: "snoozed",
    snoozed_until: new Date(Date.now() + minutes * 60_000).toISOString(),
  });
}

/** Snoozes stored server-side that are still in the future. */
export async function fetchActiveSnoozes(): Promise<SnoozeMap> {
  const { data } = await supabase
    .from("reminder_occurrences")
    .select("reminder_id, snoozed_until")
    .eq("status", "snoozed")
    .gt("snoozed_until", new Date().toISOString());
  const map: SnoozeMap = {};
  for (const row of data ?? []) {
    if (!row.snoozed_until) continue;
    const until = new Date(row.snoozed_until).getTime();
    if (until > (map[row.reminder_id] ?? 0)) map[row.reminder_id] = until;
  }
  return map;
}

/** A reminder may only be snoozed three times per occurrence. */
export const SNOOZE_CAP = 3;

const COUNT_KEY = "ereminder.snoozeCounts";

type CountMap = Record<string, number>;

/** Counts are per occurrence, so the next cycle starts fresh. */
export function snoozeKeyFor(reminderId: string, occurrence: Date): string {
  return `${reminderId}:${occurrence.getTime()}`;
}

function readCounts(): CountMap {
  if (typeof window === "undefined") return {};
  try {
    return (JSON.parse(window.localStorage.getItem(COUNT_KEY) ?? "{}") as CountMap) ?? {};
  } catch {
    return {};
  }
}

export function readSnoozeCount(key: string): number {
  return readCounts()[key] ?? 0;
}

/** Records one more snooze for this occurrence and returns the new total. */
export function bumpSnoozeCount(key: string): number {
  const counts = readCounts();
  const next = (counts[key] ?? 0) + 1;
  const trimmed: CountMap = { ...counts, [key]: next };
  // Keep the store small — only the 50 most recent occurrences matter.
  const keys = Object.keys(trimmed);
  if (keys.length > 50) for (const k of keys.slice(0, keys.length - 50)) delete trimmed[k];
  try {
    window.localStorage.setItem(COUNT_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage blocked — the in-memory count still applies for this session */
  }
  return next;
}
