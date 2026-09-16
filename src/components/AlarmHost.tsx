import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmOverlay } from "@/components/AlarmOverlay";
import { useFamilyMembers, useReminderRecipients, useReminders } from "@/lib/queries";
import { useAlarmSettings } from "@/hooks/useAlarmSettings";
import { completeReminder, skipReminder } from "@/lib/complete-reminder";
import {
  bumpSnoozeCount,
  fetchActiveSnoozes,
  readSnoozeCount,
  readSnoozes,
  recordSnooze,
  snoozeKeyFor,
  snoozeLocally,
} from "@/lib/snooze";
import { formatDate, nextOccurrence, type Reminder } from "@/lib/ereminder";
import { useT } from "@/hooks/useLanguage";

const TICK_MS = 15_000;

/**
 * Watches the clock on every screen and shows the full-screen alarm as soon as
 * a reminder falls due — not only while the timeline happens to be open.
 */
export function AlarmHost() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: reminders } = useReminders();
  const { data: members } = useFamilyMembers();
  const { data: recipientsByReminder } = useReminderRecipients();
  useAlarmSettings();

  const [snoozedIds, setSnoozedIds] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setSnoozedIds((prev) => ({ ...readSnoozes(), ...prev }));
    void fetchActiveSnoozes().then((remote) =>
      setSnoozedIds((prev) => {
        const next = { ...prev };
        for (const [id, until] of Object.entries(remote)) {
          if (until > (next[id] ?? 0)) next[id] = until;
        }
        return next;
      }),
    );
  }, []);

  // Steady heartbeat plus an immediate check when the app regains focus.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
        void queryClient.invalidateQueries({ queryKey: ["reminders"] });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [queryClient]);

  const complete = useMutation({
    mutationFn: (reminder: Reminder) => completeReminder(reminder),
    onSuccess: (result) => {
      toast.success(
        result.recurring && result.upcoming
          ? t("home.doneNext", { date: formatDate(result.upcoming) })
          : t("home.doneOnce"),
      );
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
      void queryClient.invalidateQueries({ queryKey: ["streak"] });
    },
    onError: () => toast.error(t("home.updateFailed")),
  });

  const dueAlarm = useMemo(() => {
    return (reminders ?? [])
      .filter((r) => !r.completed)
      .map((r) => ({ reminder: r, occurrence: nextOccurrence(r) }))
      .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())
      .find(
        ({ reminder, occurrence }) =>
          occurrence.getTime() <= now && (snoozedIds[reminder.id] ?? 0) < now,
      );
  }, [reminders, snoozedIds, now]);

  if (!dueAlarm) return null;

  return (
    <AlarmOverlay
      key={`${dueAlarm.reminder.id}-${dueAlarm.occurrence.getTime()}`}
      reminder={dueAlarm.reminder}
      onDismiss={() => complete.mutate(dueAlarm.reminder)}
      recipients={
        recipientsByReminder?.get(dueAlarm.reminder.id) ??
        (dueAlarm.reminder.family_member_id
          ? (members ?? []).filter((m) => m.id === dueAlarm.reminder.family_member_id)
          : [])
      }
      onSnooze={(minutes) => {
        setSnoozedIds(snoozeLocally(dueAlarm.reminder.id, minutes));
        void recordSnooze(dueAlarm.reminder.id, dueAlarm.occurrence, minutes);
      }}
    />
  );
}
