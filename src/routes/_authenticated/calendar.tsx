import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ReminderCard } from "@/components/ReminderCard";
import { ScheduledGreetingsList } from "@/components/ScheduledGreetingsList";
import { supabase } from "@/integrations/supabase/client";
import { useReminderRecipients, useReminders } from "@/lib/queries";
import { completeReminder } from "@/lib/complete-reminder";
import { useT } from "@/hooks/useLanguage";
import { activeLocale } from "@/lib/i18n";
import {
  SELECTABLE_CATEGORIES,
  categoryMeta,
  categoryShortLabel,
  formatDate,
  nextOccurrence,
  type Reminder,
  type ReminderCategory,
} from "@/lib/ereminder";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar & categories — My-Mitr" },
      {
        name: "description",
        content:
          "See your month at a glance and filter reminders by tax, vehicle, health, investments, bills and household.",
      },
      { property: "og:title", content: "Calendar & categories — My-Mitr" },
      { property: "og:description", content: "A month grid plus category filters for everything you track." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const t = useT();
  const { data: reminders } = useReminders();
  const { data: recipientsByReminder } = useReminderRecipients();
  const [monthOffset, setMonthOffset] = useState(0);
  const [category, setCategory] = useState<ReminderCategory | "all">("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [view, setView] = useState<"reminders" | "scheduled">("reminders");
  const queryClient = useQueryClient();

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
    onMutate: (reminder: Reminder) => removeFromCache(reminder.id),
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

  const base = new Date();
  const cursor = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);

  const events = useMemo(
    () =>
      (reminders ?? [])
        .filter((r) => (category === "all" ? true : r.category === category))
        .map((r) => ({ reminder: r, occurrence: nextOccurrence(r) }))
        .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime()),
    [reminders, category],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof events>();
    events.forEach((e) => {
      const key = e.occurrence.toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    });
    return map;
  }, [events]);

  const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1),
    ),
  ];

  const selectedEvents = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <AppShell
      title={t("nav.calendar")}
      subtitle={cursor.toLocaleDateString(activeLocale(), { month: "long", year: "numeric" })}
    >
      <div className="mb-4 flex gap-2">
        <Chip active={view === "reminders"} onClick={() => setView("reminders")}>
          {t("reminders.viewReminders")}
        </Chip>
        <Chip active={view === "scheduled"} onClick={() => setView("scheduled")}>
          {t("reminders.viewScheduled")}
        </Chip>
      </div>

      {view === "scheduled" ? (
        <section className="space-y-3 pb-6">
          <h2 className="text-muted-foreground text-sm font-bold tracking-widest uppercase">
            {t("reminders.scheduledGreetings")}
          </h2>
          <ScheduledGreetingsList />
        </section>
      ) : (
        <>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          {t("reminders.filterAll")}
        </Chip>
        {SELECTABLE_CATEGORIES.map((c) => (
          <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
            {c.emoji} {categoryShortLabel(c.value)}
          </Chip>
        ))}
      </div>

      <section className="bg-card shadow-card rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="size-12"
            aria-label={t("reminders.prevMonth")}
            onClick={() => setMonthOffset((m) => m - 1)}
          >
            <ChevronLeft className="size-6" aria-hidden />
          </Button>
          <p className="text-lg font-bold">
            {cursor.toLocaleDateString(activeLocale(), { month: "long", year: "numeric" })}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="size-12"
            aria-label={t("reminders.nextMonth")}
            onClick={() => setMonthOffset((m) => m + 1)}
          >
            <ChevronRight className="size-6" aria-hidden />
          </Button>
        </div>

        <div className="text-muted-foreground grid grid-cols-7 gap-1 text-center text-xs font-bold">
          {t("reminders.weekdayInitials")
            .split(",")
            .map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <span key={`empty-${idx}`} />;
            const key = day.toDateString();
            const dayEvents = byDay.get(key) ?? [];
            const isToday = key === new Date().toDateString();
            const isSelected = key === selectedDay;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : key)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                      ? "bg-accent text-accent-foreground"
                      : dayEvents.length
                        ? "bg-muted"
                        : "",
                )}
              >
                {day.getDate()}
                <span className="mt-0.5 flex gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.reminder.id}
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: categoryMeta(e.reminder.category).colorVar }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 space-y-3 pb-6">
        <h2 className="text-muted-foreground text-sm font-bold tracking-widest uppercase">
          {selectedDay
            ? new Date(selectedDay).toLocaleDateString(activeLocale(), {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : t("reminders.upcoming")}
        </h2>
        {(selectedDay ? selectedEvents : events.slice(0, 20)).map(({ reminder, occurrence }) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            occurrence={occurrence}
            recipients={recipientsByReminder?.get(reminder.id)}
          />
        ))}
        {(selectedDay ? selectedEvents : events).length === 0 ? (
          <p className="text-muted-foreground bg-card shadow-card rounded-3xl px-6 py-10 text-center">
            {t("reminders.nothingScheduled")}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 shrink-0 rounded-full px-4 text-sm font-bold whitespace-nowrap",
        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-card",
      )}
    >
      {children}
    </button>
  );
}
