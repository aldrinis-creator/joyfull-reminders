import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ReminderForm } from "@/components/ReminderForm";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/hooks/useLanguage";
import type { Reminder } from "@/lib/ereminder";

export const Route = createFileRoute("/_authenticated/reminders/$reminderId/edit")({
  head: () => ({
    meta: [
      { title: "Edit reminder — e-Reminder" },
      { name: "description", content: "Change the date, recurrence, alerts or payment shortcut of a reminder." },
      { property: "og:title", content: "Edit reminder — e-Reminder" },
      { property: "og:description", content: "Update an existing reminder in one screen." },
    ],
  }),
  component: EditReminder,
});

function EditReminder() {
  const t = useT();
  const { reminderId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["reminder", reminderId],
    queryFn: async () => {
      const [{ data: reminder, error }, { data: alerts }] = await Promise.all([
        supabase.from("reminders").select("*").eq("id", reminderId).maybeSingle(),
        supabase.from("reminder_alerts").select("offset_minutes").eq("reminder_id", reminderId),
      ]);
      if (error) throw error;
      return {
        reminder: (reminder ?? null) as Reminder | null,
        alerts: (alerts ?? []).map((a) => a.offset_minutes),
      };
    },
  });

  return (
    <AppShell title={t("reminders.editTitle")} subtitle={t("reminders.editSubtitle")}>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : data?.reminder ? (
        <ReminderForm existing={data.reminder} existingAlerts={data.alerts} />
      ) : (
        <p className="text-muted-foreground bg-card shadow-card rounded-3xl px-6 py-10 text-center">
          {t("reminders.notFound")}
        </p>
      )}
    </AppShell>
  );
}
