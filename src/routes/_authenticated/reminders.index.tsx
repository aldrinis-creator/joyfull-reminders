import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ReminderCard } from "@/components/ReminderCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyMembers, useReminderRecipients, useReminders } from "@/lib/queries";
import { useT } from "@/hooks/useLanguage";
import { activeLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { completeReminder } from "@/lib/complete-reminder";
import {
  bucketFor,
  categoryShortLabel,
  formatDate,
  nextOccurrence,
  recurrenceLabel,
  rupees,
  type FamilyMember,
  type Reminder,
  type ReminderCategory,
} from "@/lib/ereminder";

export const Route = createFileRoute("/_authenticated/reminders/")({
  head: () => ({
    meta: [
      { title: "All reminders — My-Mitr" },
      {
        name: "description",
        content:
          "Search and filter every upcoming reminder — family dates, bills, vehicle renewals and more.",
      },
      { property: "og:title", content: "All reminders — My-Mitr" },
      {
        property: "og:description",
        content: "Everything ahead in one searchable, filterable list.",
      },
    ],
  }),
  component: AllRemindersPage,
});

type FilterKey = "all" | "family" | "bills" | "vehicle" | "other";

const FILTERS: FilterKey[] = ["all", "family", "bills", "vehicle", "other"];

function groupOf(category: ReminderCategory): Exclude<FilterKey, "all"> {
  switch (category) {
    case "personal_family":
      return "family";
    case "finance_tax":
    case "subscription":
    case "household":
      return "bills";
    case "automotive":
      return "vehicle";
    default:
      return "other";
  }
}

type Item = { reminder: Reminder; occurrence: Date };

function AllRemindersPage() {
  const { data: reminders, isLoading } = useReminders();
  const { data: members } = useFamilyMembers();
  const { data: recipientsByReminder } = useReminderRecipients();
  const t = useT();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(false);

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
    onError: () => {
      toast.error(t("home.updateFailed"));
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const memberById = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    (members ?? []).forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  /** Every name attached to a reminder — direct member plus linked recipients. */
  function peopleText(reminder: Reminder): string {
    const names: string[] = [];
    if (reminder.family_member_id) {
      const m = memberById.get(reminder.family_member_id);
      if (m) names.push(m.full_name);
    }
    (recipientsByReminder?.get(reminder.id) ?? []).forEach((m) => names.push(m.full_name));
    return names.join(" ").toLowerCase();
  }

  const active = useMemo<Item[]>(
    () =>
      (reminders ?? [])
        .filter((r) => !r.completed)
        .map((r) => ({ reminder: r, occurrence: nextOccurrence(r) }))
        .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime()),
    [reminders],
  );

  const counts = useMemo(() => {
    const base: Record<FilterKey, number> = { all: 0, family: 0, bills: 0, vehicle: 0, other: 0 };
    active.forEach(({ reminder }) => {
      base.all += 1;
      base[groupOf(reminder.category)] += 1;
    });
    return base;
  }, [active]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active.filter(({ reminder }) => {
      if (filter !== "all" && groupOf(reminder.category) !== filter) return false;
      if (!q) return true;
      return (
        reminder.title.toLowerCase().includes(q) ||
        (reminder.description ?? "").toLowerCase().includes(q) ||
        peopleText(reminder).includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, filter, query, memberById, recipientsByReminder]);

  const overdue = useMemo(
    () => visible.filter(({ occurrence }) => bucketFor(occurrence) === "overdue"),
    [visible],
  );
  const upcoming = useMemo(
    () => visible.filter(({ occurrence }) => bucketFor(occurrence) !== "overdue"),
    [visible],
  );

  const monthGroups = useMemo(() => {
    const map = new Map<string, Item[]>();
    upcoming.forEach((item) => {
      const key = `${item.occurrence.getFullYear()}-${item.occurrence.getMonth()}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return [...map.entries()];
  }, [upcoming]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const doneThisMonth = useMemo(
    () =>
      (reminders ?? []).filter(
        (r) => r.completed && r.completed_at && new Date(r.completed_at).getTime() >= monthStart,
      ),
    [reminders, monthStart],
  );

  const subtitle = t("reminders.allSubtitle", {
    count: visible.length,
    overdue: overdue.length,
  });

  return (
    <AppShell title={t("reminders.allTitle")} hideHeader>
      <div className="px-[22px] pt-5 pb-4">
        <h2 className="text-[28px] leading-tight">{t("reminders.allTitle")}</h2>
        <p className="text-muted-foreground mt-1.5 text-[13.5px] font-semibold">{subtitle}</p>

        <div className="bg-card shadow-card mt-4 flex h-12 items-center gap-2 rounded-full px-[18px]">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("reminders.allSearch")}
            aria-label={t("reminders.allSearch")}
            className="h-full border-0 bg-transparent p-0 text-[14.5px] shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="-mx-[22px] mt-4 overflow-x-auto px-[22px]">
          <div className="flex w-max gap-2">
            {FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cn(
                  "h-10 shrink-0 rounded-full border px-4 text-[13px] font-semibold",
                  filter === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground",
                )}
              >
                {t(`reminders.filter_${key}`)} {counts[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-accent-100 text-accent-800 mt-3 rounded-full px-4 py-2 text-[12.5px] font-semibold">
          {t(`reminders.band_${filter}`)}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-[22px]">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="px-[22px] pb-8">
          {overdue.length ? (
            <section className="mb-6">
              <p className="text-accent-700 mb-2 text-[11px] font-semibold uppercase">
                {t("home.overdueCount", { count: overdue.length })}
              </p>
              <div className="space-y-3">
                {overdue.map(({ reminder, occurrence }) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    occurrence={occurrence}
                    tone="overdue"
                    memberName={
                      reminder.family_member_id
                        ? memberById.get(reminder.family_member_id)?.full_name
                        : undefined
                    }
                    member={
                      reminder.family_member_id
                        ? memberById.get(reminder.family_member_id)
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

          {monthGroups.map(([key, items]) => (
            <section key={key} className="mb-6">
              <p className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase">
                {items[0]!.occurrence.toLocaleDateString(activeLocale(), {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <div className="space-y-2.5">
                {items.map((item) => (
                  <ReminderRow
                    key={item.reminder.id}
                    item={item}
                    memberName={
                      item.reminder.family_member_id
                        ? memberById.get(item.reminder.family_member_id)?.full_name
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))}

          {!overdue.length && !upcoming.length ? (
            <p className="text-muted-foreground py-10 text-center text-sm font-semibold">
              {t("reminders.allEmpty")}
            </p>
          ) : null}

          {filter === "all" ? (
            <div>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="border-border text-foreground flex min-h-13 w-full items-center justify-between rounded-[26px] border border-dashed px-5 py-4 text-left text-[13.5px] font-semibold"
              >
                {t("reminders.doneThisMonth", { count: doneThisMonth.length })}
                <ChevronRight
                  className={cn("size-5 transition-transform", showDone && "rotate-90")}
                  aria-hidden
                />
              </button>
              {showDone ? (
                <ul className="mt-3 space-y-2">
                  {doneThisMonth.length ? (
                    doneThisMonth.map((r) => (
                      <li
                        key={r.id}
                        className="bg-card shadow-card flex items-center justify-between gap-3 rounded-[22px] px-5 py-3"
                      >
                        <span className="text-[14.5px] font-semibold line-through opacity-70">
                          {r.title}
                        </span>
                        <span className="text-muted-foreground text-[12px]">
                          {r.completed_at ? formatDate(r.completed_at) : null}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground px-5 py-3 text-[13px]">
                      {t("reminders.doneNone")}
                    </li>
                  )}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function ReminderRow({ item, memberName }: { item: Item; memberName?: string | undefined }) {
  const { reminder, occurrence } = item;
  const isFamily = reminder.category === "personal_family";
  const amount = reminder.amount_paise ?? null;
  const meta = [
    recurrenceLabel(reminder.recurrence),
    amount ? rupees(amount) : null,
    memberName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      to="/reminders/$reminderId/edit"
      params={{ reminderId: reminder.id }}
      className={cn(
        "shadow-card flex items-center gap-3 rounded-[22px] px-4 py-3",
        isFamily ? "bg-accent-100" : "bg-card",
      )}
    >
      <div className="w-8 shrink-0 text-center">
        <p className="text-[16px] font-semibold leading-none">{occurrence.getDate()}</p>
        <p className="text-muted-foreground mt-1 text-[9.5px] font-semibold uppercase">
          {occurrence.toLocaleDateString(activeLocale(), { weekday: "short" })}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15.5px] font-semibold">{reminder.title}</p>
        {meta ? <p className="text-foreground/55 truncate text-[12.5px]">{meta}</p> : null}
      </div>
      <span className="text-muted-foreground shrink-0 text-[11px] font-semibold uppercase">
        {categoryShortLabel(reminder.category)}
      </span>
    </Link>
  );
}
