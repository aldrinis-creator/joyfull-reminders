import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, PartyPopper } from "lucide-react";
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
import { activeLocale } from "@/lib/i18n";
import { completeReminder } from "@/lib/complete-reminder";
import {
  bucketFor,
  formatDate,
  localDayKey,
  nextOccurrence,
  type FamilyMember,
  type Reminder,
} from "@/lib/ereminder";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Your timeline — My-Mitr" },
      {
        name: "description",
        content: "Every upcoming birthday, bill, renewal and deadline in one chronological feed.",
      },
      { property: "og:title", content: "Your timeline — My-Mitr" },
      { property: "og:description", content: "All your upcoming reminders, grouped by urgency." },
    ],
  }),
  component: HomePage,
});

type TimelineItem = { reminder: Reminder; occurrence: Date };

function HomePage() {
  const { data: reminders, isLoading } = useReminders();
  const { data: members } = useFamilyMembers();
  const { data: recipientsByReminder } = useReminderRecipients();
  const { data: profile } = useProfile();
  useStreak();
  const t = useT();
  const queryClient = useQueryClient();
  const [showLater, setShowLater] = useState(false);
  const [clearedToday, setClearedToday] = useState(false);

  /** Drops a reminder from the cached list straight away, so the card goes instantly. */
  function removeFromCache(id: string) {
    queryClient.setQueryData<Reminder[]>(["reminders"], (old) =>
      (old ?? []).filter((r) => r.id !== id),
    );
  }

  const remove = useMutation({
    mutationFn: async (reminder: Reminder) => {
      await supabase.from("reminder_alerts").delete().eq("reminder_id", reminder.id);
      await supabase.from("reminder_occurrences").delete().eq("reminder_id", reminder.id);
      const { error } = await supabase.from("reminders").delete().eq("id", reminder.id);
      if (error) throw error;
    },
    onMutate: (reminder: Reminder) => removeFromCache(reminder.id),
    onSuccess: () => {
      toast.success(t("home.deleted"));
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: () => {
      toast.error(t("home.deleteFailed"));
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const complete = useMutation({
    mutationFn: (reminder: Reminder) => completeReminder(reminder),
    onMutate: (reminder: Reminder) => {
      const occurrence = nextOccurrence(reminder);
      if (bucketFor(occurrence) === "today" && todayItems.length === 1) setClearedToday(true);
      removeFromCache(reminder.id);
    },
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

  const overdue = useMemo(() => active.filter(({ occurrence }) => bucketFor(occurrence) === "overdue"), [active]);
  const currentAndFuture = useMemo(() => thisMonth.filter(({ occurrence }) => bucketFor(occurrence) !== "overdue"), [thisMonth]);
  const todayItems = useMemo(() => currentAndFuture.filter(({ occurrence }) => bucketFor(occurrence) === "today"), [currentAndFuture]);
  const dayGroups = useMemo(() => groupByDay(currentAndFuture), [currentAndFuture]);
  const laterGroups = useMemo(() => groupByDay(later), [later]);

  useEffect(() => {
    if (todayItems.length > 0) setClearedToday(false);
  }, [todayItems.length]);

  const firstName = (profile?.full_name ?? "").split(" ")[0];
  const profileInitial = firstName.slice(0, 1).toUpperCase() || "M";
  const now = new Date();
  const nextAfterToday = active.find(({ occurrence }) => bucketFor(occurrence) !== "overdue" && bucketFor(occurrence) !== "today")?.occurrence;
  const daysToNext = nextAfterToday
    ? Math.max(1, Math.ceil((new Date(nextAfterToday.getFullYear(), nextAfterToday.getMonth(), nextAfterToday.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000))
    : null;
  const subtitle = overdue.length
    ? t("home.subtitleLate", { overdue: overdue.length, today: todayItems.length })
    : todayItems.length
      ? t("home.subtitleDue", { today: todayItems.length })
      : daysToNext
        ? t("home.subtitleClear", { days: daysToNext })
        : nextAfterToday
          ? t("home.subtitleClearNext", { date: formatDate(nextAfterToday) })
          : t("home.subtitleClearAll");

  return (
    <>
      <AppShell title={t("nav.today")} hideHeader>
        <div className="px-[22px] pt-4 pb-5">
          <p className="text-foreground/50 text-[11px] font-semibold">
            {t("home.statusToday", {
              time: now.toLocaleTimeString(activeLocale(), { hour: "numeric", minute: "2-digit" }),
              date: now.toLocaleDateString(activeLocale(), { weekday: "short", day: "numeric", month: "short" }),
            })}
          </p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[29px] leading-tight">
                {firstName ? t("home.greeting", { name: firstName }) : t("home.title")}
              </h1>
              <p className="text-muted-foreground mt-1.5 text-[13.5px] font-semibold">{subtitle}</p>
            </div>
            <Button asChild variant="outline" size="icon" className="bg-card shadow-card size-12 shrink-0 rounded-full text-base font-semibold" aria-label={t("nav.profile")}>
              <Link to="/profile">{profileInitial}</Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 px-[22px]">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-3xl" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="px-[22px]"><EmptyState t={t} /></div>
        ) : (
          <div className="pb-6">
            {overdue.length ? (
              <section className="mb-6 px-[22px]">
                <p className="text-accent-700 mb-2 text-[11px] font-semibold uppercase">{t("home.overdueCount", { count: overdue.length })}</p>
                <div className="space-y-3">
                  {overdue.map(({ reminder, occurrence }) => (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      occurrence={occurrence}
                      tone="overdue"
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
            ) : null}

            {clearedToday && todayItems.length === 0 ? (
              <div className="animate-mm-rise mx-[22px] mb-5 rounded-[26px] bg-accent-2-100 px-6 py-7 text-center">
                <h2 className="text-accent-2-900 text-base font-semibold">{t("home.allClearTitle")}</h2>
                <p className="text-accent-2-800 mt-1 text-[13px]">
                  {nextAfterToday ? t("home.allClearNext", { date: formatDate(nextAfterToday) }) : t("home.allClearNoNext")}
                </p>
              </div>
            ) : null}

            <div className="px-[22px]">
              {dayGroups.map(([key, items]) => (
                <DayGroup
                  key={key}
                  items={items}
                  members={members ?? []}
                  recipientsByReminder={recipientsByReminder}
                  memberName={memberName}
                  onComplete={(reminder) => complete.mutate(reminder)}
                  onDelete={(reminder) => remove.mutate(reminder)}
                />
              ))}
            </div>

            {later.length ? (
              <section className="px-[22px] pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLater((v) => !v)}
                  aria-expanded={showLater}
                  className="bg-card shadow-card flex min-h-13 w-full items-center justify-between rounded-[26px] px-5 py-4 text-left font-semibold"
                >
                  {t("home.laterSection", { count: later.length })}
                  <ChevronDown
                    className={`size-5 transition-transform ${showLater ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </Button>
                {showLater ? (
                  <div className="mt-5">
                    {laterGroups.map(([key, items]) => (
                      <DayGroup key={key} items={items} members={members ?? []} recipientsByReminder={recipientsByReminder} memberName={memberName} onComplete={(reminder) => complete.mutate(reminder)} onDelete={(reminder) => remove.mutate(reminder)} />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </AppShell>

      <AskAssistant />
    </>
  );
}

function groupByDay(items: TimelineItem[]): [string, TimelineItem[]][] {
  const map = new Map<string, TimelineItem[]>();
  items.forEach((item) => {
    const key = localDayKey(item.occurrence);
    map.set(key, [...(map.get(key) ?? []), item]);
  });
  return [...map.entries()];
}

function DayGroup({ items, members, recipientsByReminder, memberName, onComplete, onDelete }: {
  items: TimelineItem[];
  members: FamilyMember[];
  recipientsByReminder: Map<string, FamilyMember[]> | undefined;
  memberName: Map<string, string>;
  onComplete: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}) {
  const occurrence = items[0]?.occurrence;
  if (!occurrence) return null;
  const today = localDayKey(occurrence) === localDayKey();
  const familyDate = items.some(({ reminder }) => reminder.category === "personal_family");
  return (
    <section className="grid grid-cols-[46px_14px_minmax(0,1fr)] gap-x-3 pb-5">
      <div className={today ? "text-accent-700 text-right" : "text-foreground text-right"}>
        <p className="text-lg font-semibold leading-none">{occurrence.getDate()}</p>
        <p className="text-muted-foreground mt-1 text-[10px] font-semibold uppercase">{occurrence.toLocaleDateString(activeLocale(), { weekday: "short" })}</p>
      </div>
      <div className="flex min-h-full flex-col items-center">
        <span className={cn("size-3.5 shrink-0 rounded-full", today ? "bg-primary" : familyDate ? "bg-accent-300" : "bg-accent-2-400")} />
        <span className="mt-1 w-0.5 flex-1 bg-border" />
      </div>
      <div className="space-y-2.5">
        {items.map(({ reminder, occurrence: itemOccurrence }) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            occurrence={itemOccurrence}
            memberName={reminder.family_member_id ? memberName.get(reminder.family_member_id) : undefined}
            member={reminder.family_member_id ? members.find((member) => member.id === reminder.family_member_id) : undefined}
            recipients={recipientsByReminder?.get(reminder.id)}
            onComplete={onComplete}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
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
