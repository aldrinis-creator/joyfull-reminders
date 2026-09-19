import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmOverlay } from "@/components/AlarmOverlay";
import { useFamilyMembers, useReminderRecipients, useReminders } from "@/lib/queries";
import { useAlarmSettings } from "@/hooks/useAlarmSettings";
import { completeReminder, skipReminder } from "@/lib/complete-reminder";
import { fetchHandledOccurrences, occurrenceKey } from "@/lib/occurrence-status";
import {
  bumpSnoozeCount,
  fetchActiveSnoozes,
  readSnoozeCount,
  readSnoozes,
  recordSnooze,
  snoozeKeyFor,
  snoozeLocally,
} from "@/lib/snooze";
import { currentOccurrence, formatDate, type Reminder } from "@/lib/ereminder";
import { useT } from "@/hooks/useLanguage";

const TICK_MS = 5_000;
/**
 * How long after its moment a recomputed occurrence may still ring. `due_at`
 * only rolls forward when somebody acts on the reminder, so an untouched daily
 * reminder keeps an old stored date — we derive today's occurrence instead and
 * only ring it while it is still fresh.
 */
const DUE_GRACE_MS = 6 * 60 * 60_000;


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
      void queryClient.invalidateQueries({ queryKey: ["handled-occurrences"] });
    },
    onError: () => toast.error(t("home.updateFailed")),
  });

  const skip = useMutation({
    mutationFn: (reminder: Reminder) => skipReminder(reminder),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
      void queryClient.invalidateQueries({ queryKey: ["handled-occurrences"] });
    },
    onError: () => toast.error(t("home.updateFailed")),
  });


  // Occurrences already completed, dismissed or recorded as missed never ring.
  const { data: handled } = useQuery({
    queryKey: ["handled-occurrences"],
    queryFn: fetchHandledOccurrences,
    staleTime: 30_000,
  });

  /** Every reminder whose current occurrence is outstanding right now. */
  const dueList = useMemo(() => {
    return (reminders ?? [])
      .filter((r) => !r.completed)
      // The occurrence actually being asked for right now — not the next future
      // one. `nextOccurrence` jumped to tomorrow the instant a daily reminder's
      // time passed, which silenced the alarm for every recurring reminder.
      .map((r) => ({ reminder: r, occurrence: currentOccurrence(r) }))
      .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())
      .filter(({ reminder, occurrence }) => {
        const at = occurrence.getTime();
        if (at > now) return false;
        const stored = new Date(reminder.due_at).getTime();
        // A rolled (recomputed) occurrence only rings while it is fresh.
        if (at !== stored && now - at > DUE_GRACE_MS) return false;
        if (handled?.has(occurrenceKey(reminder.id, at))) return false;
        return (snoozedIds[reminder.id] ?? 0) < now;
      });
  }, [reminders, snoozedIds, now, handled]);

  const dueAlarm = dueList[0];

  /**
   * Wake up exactly when the next reminder falls due instead of waiting for the
   * next heartbeat — a reminder created seconds before its time used to sit
   * silent until the poll happened to come round.
   */
  const nextDueAt = useMemo(() => {
    const times = (reminders ?? [])
      .filter((r) => !r.completed)
      .map((r) => currentOccurrence(r).getTime())
      .filter((at) => at > now);
    return times.length ? Math.min(...times) : null;
  }, [reminders, now]);

  useEffect(() => {
    if (nextDueAt === null) return;
    const delay = nextDueAt - Date.now();
    if (delay <= 0 || delay > 60 * 60_000) return;
    const timer = setTimeout(() => setNow(Date.now()), delay + 500);
    return () => clearTimeout(timer);
  }, [nextDueAt]);

  /**
   * The overlay keeps its own "snoozed" / "handled" screens, so we hold on to
   * the alarm it is showing instead of unmounting it the moment the reminder
   * stops being due.
   */
  const [held, setHeld] = useState<{ reminder: Reminder; occurrence: Date } | null>(null);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const closedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!dueAlarm) return;
    const key = snoozeKeyFor(dueAlarm.reminder.id, dueAlarm.occurrence);
    if (closedKey.current === key) return;
    setHeld((prev) => {
      if (!prev) return dueAlarm;
      const prevKey = snoozeKeyFor(prev.reminder.id, prev.occurrence);
      if (prevKey === key) return prev;
      // A leftover confirmation screen must never block a newer alarm: if what
      // we are holding is no longer outstanding, hand over to the one that is.
      const stillDue = dueList.some(
        (d) => snoozeKeyFor(d.reminder.id, d.occurrence) === prevKey,
      );
      return stillDue ? prev : dueAlarm;
    });
    setSnoozeCount(readSnoozeCount(key));
  }, [dueAlarm, dueList]);


  if (!held) return null;
  const heldKey = snoozeKeyFor(held.reminder.id, held.occurrence);

  return (
    <AlarmOverlay
      key={heldKey}
      reminder={held.reminder}
      occurrence={held.occurrence}
      snoozeCount={snoozeCount}
      onDismiss={() => complete.mutate(held.reminder)}
      onSkip={() => skip.mutate(held.reminder)}
      onClose={() => {
        closedKey.current = heldKey;
        setHeld(null);
      }}
      recipients={
        recipientsByReminder?.get(held.reminder.id) ??
        (held.reminder.family_member_id
          ? (members ?? []).filter((m) => m.id === held.reminder.family_member_id)
          : [])
      }
      onSnooze={(minutes) => {
        setSnoozedIds(snoozeLocally(held.reminder.id, minutes));
        setSnoozeCount(bumpSnoozeCount(heldKey));
        void recordSnooze(held.reminder.id, held.occurrence, minutes);
      }}
    />
  );
}
