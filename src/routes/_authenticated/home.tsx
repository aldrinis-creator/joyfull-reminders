import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Flame, PartyPopper, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AskAssistant } from "@/components/AskAssistant";
import { ReminderCard } from "@/components/ReminderCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  useFamilyMembers,
  useProfile,
  useReminderRecipients,
  useReminders,
  useStreak,
} from "@/lib/queries";
import { useT } from "@/hooks/useLanguage";
import { completeReminder } from "@/lib/complete-reminder";
import {
  bucketLabel,
  bucketFor,
  formatDate,
  nextOccurrence,
  type Reminder,
  type UrgencyBucket,
} from "@/lib/ereminder";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Your timeline — e-Reminder" },
      {
        name: "description",
        content: "Every upcoming birthday, bill, renewal and deadline in one chronological feed.",
      },
      { property: "og:title", content: "Your timeline — e-Reminder" },
      { property: "og:description", content: "All your upcoming reminders, grouped by urgency." },
    ],
  }),
  component: HomePage,
});

const ORDER: UrgencyBucket[] = ["overdue", "today", "week", "later"];

function HomePage() {
  const { data: reminders, isLoading } = useReminders();
  const { data: members } = useFamilyMembers();
  const { data: recipientsByReminder } = useReminderRecipients();
  const { data: profile } = useProfile();
  const { data: streak } = useStreak();
  const t = useT();
  useAlarmSettings();
  const queryClient = useQueryClient();
  const [snoozedIds, setSnoozedIds] = useState<Record<string, number>>({});
  const [showLater, setShowLater] = useState(false);

  // Snoozes persist across reloads: hydrate from localStorage, then the server.
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

  const remove = useMutation({
    mutationFn: async (reminder: Reminder) => {
      await supabase.from("reminder_alerts").delete().eq("reminder_id", reminder.id);
      await supabase.from("reminder_occurrences").delete().eq("reminder_id", reminder.id);
      const { error } = await supabase.from("reminders").delete().eq("id", reminder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("home.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: () => toast.error(t("home.deleteFailed")),
  });

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


  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    (members ?? []).forEach((m) => map.set(m.id, m.full_name));
    return map;
  }, [members]);

  const active = useMemo(
    () =>
      (reminders ?? [])
        .filter((r) => !r.completed)
        .map((r) => ({ reminder: r, occurrence: nextOccurrence(r) }))
        .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime()),
    [reminders],
  );

  const now0 = new Date();
  const monthEnd = new Date(now0.getFullYear(), now0.getMonth() + 1, 1).getTime();

  const thisMonth = useMemo(
    () => active.filter(({ occurrence }) => occurrence.getTime() < monthEnd),
    [active, monthEnd],
  );
  const later = useMemo(
    () => active.filter(({ occurrence }) => occurrence.getTime() >= monthEnd),
    [active, monthEnd],
  );

  const grouped = useMemo(() => {
    const map: Record<UrgencyBucket, typeof active> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
    };
    thisMonth.forEach((item) => map[bucketFor(item.occurrence)].push(item));
    return map;
  }, [thisMonth]);

  const now = Date.now();
  const dueAlarm = active.find(
    ({ reminder, occurrence }) =>
      reminder.priority === "high" &&
      occurrence.getTime() <= now &&
      (snoozedIds[reminder.id] ?? 0) < now,
  );

  const firstName = (profile?.full_name ?? "").split(" ")[0];

  return (
    <>
      <AppShell
        title={firstName ? t("home.greeting", { name: firstName }) : t("home.title")}
        subtitle={
          thisMonth.length === 1
            ? t("home.subtitleOne")
            : thisMonth.length
              ? t("home.subtitleMany", { count: thisMonth.length })
              : t("home.subtitleEmpty")
        }
        action={
          <Button asChild size="lg" className="bg-indigo text-indigo-foreground h-12 shadow-lifted">
            <Link to="/reminders/new">
              <Plus className="size-5" aria-hidden /> {t("nav.add")}
            </Link>
          </Button>
        }
      >
        {streak && streak.current_streak > 0 ? (
          <div className="bg-accent text-accent-foreground mb-4 flex items-center gap-3 rounded-3xl px-5 py-4 font-semibold">
            <Flame className="size-6" aria-hidden />
            {t("home.streak", { count: streak.current_streak })}
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-3xl" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <div className="space-y-7 pb-6">
            {ORDER.filter((b) => grouped[b].length > 0).map((bucket) => (
              <section key={bucket}>
                <h2 className="text-muted-foreground mb-3 text-sm font-bold tracking-widest uppercase">
                  {bucketLabel(bucket)} · {grouped[bucket].length}
                </h2>
                <div className="space-y-3">
                  {grouped[bucket].map(({ reminder, occurrence }) => (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      occurrence={occurrence}
                      memberName={
                        reminder.family_member_id
                          ? memberName.get(reminder.family_member_id)
                          : undefined
                      }
                      member={
                        reminder.family_member_id
                          ? (members ?? []).find((m) => m.id === reminder.family_member_id)
                          : undefined
                      }
                      recipients={recipientsByReminder?.get(reminder.id)}
                      onComplete={(r) => complete.mutate(r)}
                      onDelete={(r) => remove.mutate(r)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {later.length ? (
              <section>
                <button
                  type="button"
                  onClick={() => setShowLater((v) => !v)}
                  aria-expanded={showLater}
                  className="bg-card shadow-card flex min-h-13 w-full items-center justify-between rounded-3xl px-5 py-4 text-left font-semibold"
                >
                  {t("home.laterSection", { count: later.length })}
                  <ChevronDown
                    className={`size-5 transition-transform ${showLater ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {showLater ? (
                  <div className="mt-3 space-y-3">
                    {later.map(({ reminder, occurrence }) => (
                      <ReminderCard
                        key={reminder.id}
                        reminder={reminder}
                        occurrence={occurrence}
                        memberName={
                          reminder.family_member_id
                            ? memberName.get(reminder.family_member_id)
                            : undefined
                        }
                        member={
                          reminder.family_member_id
                            ? (members ?? []).find((m) => m.id === reminder.family_member_id)
                            : undefined
                        }
                        recipients={recipientsByReminder?.get(reminder.id)}
                      onComplete={(r) => complete.mutate(r)}
                        onDelete={(r) => remove.mutate(r)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </AppShell>

      <AskAssistant />

      {dueAlarm ? (
        <AlarmOverlay
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
      ) : null}
    </>
  );
}

function EmptyState({ t }: { t: (key: string) => string }) {
  return (
    <div className="bg-card shadow-card rounded-3xl px-6 py-12 text-center">
      <PartyPopper className="text-primary mx-auto size-12" aria-hidden />
      <h2 className="mt-4 text-2xl">{t("home.emptyTitle")}</h2>
      <p className="text-muted-foreground mt-2">{t("home.emptyBody")}</p>
      <Button asChild size="lg" className="mt-6 h-14 px-8 text-base">
        <Link to="/reminders/new">{t("home.emptyCta")}</Link>
      </Button>
    </div>
  );
}
