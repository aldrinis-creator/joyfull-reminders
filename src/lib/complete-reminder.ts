import { supabase } from "@/integrations/supabase/client";
import { advanceOccurrence, currentOccurrence, localDayKey, type Reminder } from "@/lib/ereminder";

/**
 * Marks a reminder done: logs the occurrence, rolls a recurring reminder
 * forward (or closes a one-off) and keeps the daily streak up to date.
 * Shared by the timeline and the full-screen alarm.
 */
export async function completeReminder(
  reminder: Reminder,
): Promise<{ recurring: boolean; upcoming: Date | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const completedOccurrence = currentOccurrence(reminder);
  const upcoming = advanceOccurrence(reminder);

  if (userId) {
    await supabase.from("reminder_occurrences").insert({
      user_id: userId,
      reminder_id: reminder.id,
      occurrence_at: completedOccurrence.toISOString(),
      status: "completed",
      acknowledged_at: new Date().toISOString(),
    });
  }

  if (upcoming) {
    const { error } = await supabase
      .from("reminders")
      .update({ due_at: upcoming.toISOString(), completed: false, completed_at: null })
      .eq("id", reminder.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("reminders")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", reminder.id);
    if (error) throw error;
  }

  // A medicine dose eats one from the pack.
  if (reminder.medicine_id) {
    const { data: medicine } = await supabase
      .from("medicines")
      .select("id, remaining_qty")
      .eq("id", reminder.medicine_id)
      .maybeSingle();
    if (medicine && medicine.remaining_qty !== null) {
      await supabase
        .from("medicines")
        .update({ remaining_qty: Math.max(0, medicine.remaining_qty - 1) })
        .eq("id", medicine.id);
    }
  }

  if (userId) {

    const today = localDayKey();
    const { data: current } = await supabase
      .from("user_streaks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const yesterday = localDayKey(new Date(Date.now() - 86_400_000));
    const next =
      current?.last_completed_on === today
        ? current.current_streak
        : current?.last_completed_on === yesterday
          ? current.current_streak + 1
          : 1;
    await supabase.from("user_streaks").upsert({
      user_id: userId,
      current_streak: next,
      longest_streak: Math.max(next, current?.longest_streak ?? 0),
      last_completed_on: today,
    });
  }

  return { recurring: Boolean(upcoming), upcoming: upcoming ?? null };
}

/**
 * "Skip" from the alarm: the occurrence is acknowledged and a recurring
 * reminder rolls forward, but the on-time streak is deliberately untouched.
 */
export async function skipReminder(
  reminder: Reminder,
): Promise<{ recurring: boolean; upcoming: Date | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const skipped = currentOccurrence(reminder);
  const upcoming = advanceOccurrence(reminder);

  if (userId) {
    await supabase.from("reminder_occurrences").insert({
      user_id: userId,
      reminder_id: reminder.id,
      occurrence_at: skipped.toISOString(),
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    });
  }

  if (upcoming) {
    const { error } = await supabase
      .from("reminders")
      .update({ due_at: upcoming.toISOString(), completed: false, completed_at: null })
      .eq("id", reminder.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("reminders")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", reminder.id);
    if (error) throw error;
  }

  return { recurring: Boolean(upcoming), upcoming: upcoming ?? null };
}
