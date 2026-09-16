import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ReminderForm } from "@/components/ReminderForm";
import { useT } from "@/hooks/useLanguage";

export const Route = createFileRoute("/_authenticated/reminders/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Add a reminder — My-Mitr" },
      {
        name: "description",
        content:
          "Create a reminder with a category, due date, recurrence and as many advance alerts as you need.",
      },
      { property: "og:title", content: "Add a reminder — My-Mitr" },
      { property: "og:description", content: "Set the date, recurrence and alerts in one screen." },
    ],
  }),
  component: NewReminder,
});

function NewReminder() {
  const t = useT();
  const { date } = Route.useSearch();
  return (
    <AppShell title={t("reminders.title")} subtitle={t("reminders.subtitle")}>
      <ReminderForm defaultDate={date} />
    </AppShell>
  );
}
