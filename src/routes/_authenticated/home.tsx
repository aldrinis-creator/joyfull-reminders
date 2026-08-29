import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Flame, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AlarmOverlay } from "@/components/AlarmOverlay";
import { ReminderCard } from "@/components/ReminderCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyMembers, useProfile, useReminders, useStreak } from "@/lib/queries";
import {
  BUCKET_LABEL,
  bucketFor,
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
  const { data: profile } = useProfile();
  const { data: streak } = useStreak();
  const queryClient = useQueryClient();
  const [snoozedIds, setSnoozedIds] = useState<Record<string, number>>({});

  const complete = useMutation({
    mutationFn: async (reminder: Reminder) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      const completedOccurrence = nextOccurrence(reminder);
      const upcoming = advanceOccurrence(reminder);

      if (userId) {
        await supabase.from("reminder_occurrences").insert({
          user_id: userId,
          reminder_id: reminder.id,
          occurrence_at: completedOccurrence.toISOString(),
          status: "completed",
          acknowledged_at: new Date().toISOString(),
        });
      }

      if (upcoming) {
        // Recurring: roll forward to the next occurrence, keep it active.
        const { error } = await supabase
          .from("reminders")
          .update({ due_at: upcoming.toISOString(), completed: false, completed_at: null })
          .eq("id", reminder.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("reminders")
          .update({ completed: true, completed_at: new Date().toISOString() })
          .eq("id", reminder.id);
        if (error) throw error;
      }

      if (userId) {
        const today = localDayKey();
        const { data: current } = await supabase
          .from("user_streaks")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        const yesterday = localDayKey(new Date(Date.now() - 86_400_000));
        const next =
          current?.last_completed_on === today
            ? current.current_streak
            : current?.last_completed_on === yesterday
              ? current.current_streak + 1
              : 1;
        await supabase.from("user_streaks").upsert({
          user_id: userId,
          current_streak: next,
          longest_streak: Math.max(next, current?.longest_streak ?? 0),
          last_completed_on: today,
        });
      }
      return { recurring: Boolean(upcoming), upcoming };
    },
    onSuccess: (result) => {
      toast.success(
        result.recurring && result.upcoming
          ? `Done! Next one on ${formatDate(result.upcoming)}.`
          : "Nice! Marked as done.",
      );
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
      void queryClient.invalidateQueries({ queryKey: ["streak"] });
    },
    onError: () => toast.error("Could not update that reminder."),
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

  const grouped = useMemo(() => {
    const map: Record<UrgencyBucket, typeof active> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
    };
    active.forEach((item) => map[bucketFor(item.occurrence)].push(item));
    return map;
  }, [active]);

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
        title={firstName ? `Hello, ${firstName}` : "Your timeline"}
        subtitle={
          active.length
            ? `${active.length} thing${active.length === 1 ? "" : "s"} coming up`
            : "Nothing pending — enjoy the calm"
        }
        action={
          <Button asChild size="lg" className="bg-indigo text-indigo-foreground h-12 shadow-lifted">
            <Link to="/reminders/new">
              <Plus className="size-5" aria-hidden /> Add
            </Link>
          </Button>
        }
      >
        {streak && streak.current_streak > 0 ? (
          <div className="bg-accent text-accent-foreground mb-4 flex items-center gap-3 rounded-3xl px-5 py-4 font-semibold">
            <Flame className="size-6" aria-hidden />
            {streak.current_streak}-day on-time streak. Keep it going!
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-3xl" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-7 pb-6">
            {ORDER.filter((b) => grouped[b].length > 0).map((bucket) => (
              <section key={bucket}>
                <h2 className="text-muted-foreground mb-3 text-sm font-bold tracking-widest uppercase">
                  {BUCKET_LABEL[bucket]} · {grouped[bucket].length}
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
                      onComplete={(r) => complete.mutate(r)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </AppShell>

      {dueAlarm ? (
        <AlarmOverlay
          reminder={dueAlarm.reminder}
          onDismiss={() => complete.mutate(dueAlarm.reminder)}
          onSnooze={(minutes) =>
            setSnoozedIds((prev) => ({
              ...prev,
              [dueAlarm.reminder.id]: Date.now() + minutes * 60_000,
            }))
          }
        />
      ) : null}
    </>
  );
}

function EmptyState() {
  return (
    <div className="bg-card shadow-card rounded-3xl px-6 py-12 text-center">
      <PartyPopper className="text-primary mx-auto size-12" aria-hidden />
      <h2 className="mt-4 text-2xl">Nothing pending</h2>
      <p className="text-muted-foreground mt-2">
        Add your first reminder — a birthday, a bill, a PUC renewal or an exam form deadline.
      </p>
      <Button asChild size="lg" className="mt-6 h-14 px-8 text-base">
        <Link to="/reminders/new">Add a reminder</Link>
      </Button>
    </div>
  );
}
