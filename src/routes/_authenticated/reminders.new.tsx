import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ReminderForm } from "@/components/ReminderForm";
import { useT } from "@/hooks/useLanguage";

export const Route = createFileRoute("/_authenticated/reminders/new")({
  head: () => ({
    meta: [
      { title: "Add a reminder — e-Reminder" },
      {
        name: "description",
        content:
          "Create a reminder with a category, due date, recurrence and as many advance alerts as you need.",
      },
      { property: "og:title", content: "Add a reminder — e-Reminder" },
      { property: "og:description", content: "Set the date, recurrence and alerts in one screen." },
    ],
  }),
  component: NewReminder,
});

function NewReminder() {
  const t = useT();
  return (
    <AppShell title={t("reminders.title")} subtitle={t("reminders.subtitle")}>
      <ReminderForm />
    </AppShell>
  );
}
