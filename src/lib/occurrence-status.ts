/**
 * Which reminder occurrences the person has already dealt with.
 *
 * The full-screen alarm now works out "the occurrence that is due right now"
 * from the recurrence pattern (see `currentOccurrence`), which means a dose
 * whose time has just passed still counts as outstanding. So we need the other
 * half of the picture: the occurrences already completed, dismissed or missed,
 * which must never ring again.
 */
import { supabase } from "@/integrations/supabase/client";

export const HANDLED_STATUSES = ["completed", "acknowledged", "missed"] as const;

/** Key used to match an occurrence across the app. */
export function occurrenceKey(reminderId: string, occurrence: Date | number): string {
  const ms = typeof occurrence === "number" ? occurrence : occurrence.getTime();
  return `${reminderId}:${ms}`;
}

/** Handled occurrences from the last few days — enough for any live alarm. */
export async function fetchHandledOccurrences(): Promise<Set<string>> {
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("reminder_occurrences")
    .select("reminder_id, occurrence_at, status")
    .in("status", [...HANDLED_STATUSES])
    .gte("occurrence_at", since);
  const keys = new Set<string>();
  for (const row of data ?? []) {
    if (!row.occurrence_at) continue;
    keys.add(occurrenceKey(row.reminder_id, new Date(row.occurrence_at)));
  }
  return keys;
}
