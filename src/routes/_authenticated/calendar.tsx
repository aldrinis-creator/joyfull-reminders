import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { categoryMeta, formatDate, nextOccurrence, type Reminder } from "@/lib/ereminder";
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [view, setView] = useState<"reminders" | "scheduled">("reminders");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
        .map((r) => ({ reminder: r, occurrence: nextOccurrence(r) }))
        .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime()),
    [reminders],
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
  const visibleMonthEvents = events.filter(
    ({ occurrence }) =>
      occurrence.getFullYear() === cursor.getFullYear() && occurrence.getMonth() === cursor.getMonth(),
  );
  const panelEvents = selectedDay ? selectedEvents : events.slice(0, 20);
  const selectedDate = selectedDay ? new Date(selectedDay) : null;
  const selectedDateParam = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : null;
  const monthName = cursor.toLocaleDateString(activeLocale(), { month: "long" });
  const panelHeading = selectedDate
    ? t("reminders.dayPanelTitle", {
        date: selectedDate.toLocaleDateString(activeLocale(), {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        count: selectedEvents.length,
      })
    : t("reminders.upcoming");

  return (
    <AppShell title={t("nav.calendar")} hideHeader>
      <div className="mb-6 flex gap-2">
        <Chip active={view === "reminders"} onClick={() => setView("reminders")}>
          {t("reminders.viewReminders")}
        </Chip>
        <Chip active={view === "scheduled"} onClick={() => setView("scheduled")}>
          {t("reminders.viewScheduled")}
        </Chip>
      </div>

      {view === "scheduled" ? (
        <section className="space-y-3 pb-6">
          <h2 className="font-display text-[28px] leading-tight">
            {t("reminders.scheduledGreetings")}
          </h2>
          <ScheduledGreetingsList />
        </section>
      ) : (
        <>
      <section>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-[28px] leading-tight">{monthName}</h2>
            <p className="text-foreground/55 mt-1 text-[13.5px]">
              {t("reminders.monthSubtitle", {
                year: cursor.getFullYear(),
                count: visibleMonthEvents.length,
              })}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full bg-transparent shadow-none"
              aria-label={t("reminders.prevMonth")}
              onClick={() => {
                setMonthOffset((m) => m - 1);
                setSelectedDay(null);
              }}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full bg-transparent shadow-none"
              aria-label={t("reminders.nextMonth")}
              onClick={() => {
                setMonthOffset((m) => m + 1);
                setSelectedDay(null);
              }}
            >
              <ChevronRight className="size-5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="text-foreground/45 grid grid-cols-7 gap-0.5 text-center text-[10.5px] font-semibold">
          {t("reminders.weekdayInitials")
            .split(",")
            .map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-0.5">
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
                onClick={() => setSelectedDay(key)}
                aria-pressed={isSelected}
                aria-label={t("reminders.calendarDayLabel", {
                  date: day.toLocaleDateString(activeLocale(), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }),
                  count: dayEvents.length,
                })}
                className={cn(
                  "hover:bg-accent focus-visible:ring-ring relative flex aspect-square items-center justify-center rounded-full text-[14.5px] font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  isToday && "bg-primary text-primary-foreground hover:bg-primary-hover",
                  isSelected && !isToday && "ring-primary ring-2",
                )}
              >
                <span>{day.getDate()}</span>
                <span className="absolute bottom-[3px] flex gap-[2px]">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.reminder.id}
                      className="size-[5px] rounded-full"
                      style={{ backgroundColor: categoryMeta(e.reminder.category).colorVar }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-foreground/55 mt-5 flex items-center justify-center gap-5 text-[11.5px]">
          <LegendItem color="bg-cat-personal_family" label={t("reminders.legendFamily")} />
          <LegendItem color="bg-cat-finance_tax" label={t("reminders.legendBills")} />
          <LegendItem color="bg-cat-automotive" label={t("reminders.legendVehicle")} />
        </div>
      </section>

      <section className="mt-7 space-y-3 pb-6">
        <h2 className="text-foreground/55 text-[11px] font-bold uppercase">
          {panelHeading}
        </h2>
        {panelEvents.map(({ reminder, occurrence }) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            occurrence={occurrence}
            recipients={recipientsByReminder?.get(reminder.id)}
            onComplete={(r) => complete.mutate(r)}
            onDelete={(r) => remove.mutate(r)}
          />
        ))}
        {selectedDay && selectedEvents.length === 0 ? (
          <div className="bg-accent-2-100 rounded-[26px] px-6 py-8 text-center">
            <p className="text-sage-900 text-base font-semibold">{t("reminders.emptyDayTitle")}</p>
            <p className="text-sage-800 mt-1 text-[13px]">{t("reminders.emptyDayBody")}</p>
            <Button
              className="bg-sage-700 text-primary-foreground hover:bg-sage-800 mt-5 h-[46px] rounded-full px-6 shadow-none"
              onClick={() => {
                if (!selectedDateParam) return;
                void navigate({ to: "/reminders/new", search: { date: selectedDateParam } });
              }}
            >
              {t("reminders.emptyDayCta")}
            </Button>
          </div>
        ) : !selectedDay && events.length === 0 ? (
          <p className="bg-card shadow-card text-foreground/55 rounded-[26px] px-6 py-10 text-center">
            {t("reminders.nothingScheduled")}
          </p>
        ) : null}
      </section>
        </>
      )}
    </AppShell>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-[5px] rounded-full", color)} aria-hidden />
      {label}
    </span>
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
        "min-h-10 shrink-0 rounded-full border px-4 text-[13px] font-semibold whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground shadow-sm",
      )}
    >
      {children}
    </button>
  );
}
