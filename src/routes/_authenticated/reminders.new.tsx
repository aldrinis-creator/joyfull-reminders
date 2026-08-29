import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyMembers } from "@/lib/queries";
import {
  ALERT_PRESETS,
  CATEGORIES,
  RECURRENCES,
  type RecurrenceKind,
  type ReminderCategory,
} from "@/lib/ereminder";

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

const schema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(120),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.string().min(1, "Pick a date"),
  dueTime: z.string().min(1, "Pick a time"),
  birthYear: z.string().trim().max(4).optional(),
});

function NewReminder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: members } = useFamilyMembers();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ReminderCategory>("personal_family");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState("09:00");
  const [recurrence, setRecurrence] = useState<RecurrenceKind>("once");
  const [intervalDays, setIntervalDays] = useState("30");
  const [birthYear, setBirthYear] = useState("");
  const [memberId, setMemberId] = useState<string>("none");
  const [highPriority, setHighPriority] = useState(true);
  const [alerts, setAlerts] = useState<number[]>([1440, 0]);
  const [saving, setSaving] = useState(false);

  const toggleAlert = (minutes: number) =>
    setAlerts((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes],
    );

  return (
    <AppShell title="New reminder" subtitle="It only takes a few seconds">
      <form
        className="space-y-5 pb-8"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = schema.safeParse({ title, description, dueDate, dueTime, birthYear });
          if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
            return;
          }
          const dueAt = new Date(`${dueDate}T${dueTime}`);
          if (Number.isNaN(dueAt.getTime())) {
            toast.error("That date and time isn't valid");
            return;
          }
          setSaving(true);
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;
          if (!userId) {
            setSaving(false);
            toast.error("Please sign in again");
            return;
          }
          const { data: created, error } = await supabase
            .from("reminders")
            .insert({
              user_id: userId,
              title: parsed.data.title,
              category,
              description: parsed.data.description || null,
              due_at: dueAt.toISOString(),
              recurrence,
              recurrence_interval_days:
                recurrence === "custom" ? Math.max(1, Number(intervalDays) || 30) : null,
              birth_year: birthYear ? Number(birthYear) : null,
              family_member_id: memberId === "none" ? null : memberId,
              priority: highPriority ? "high" : "normal",
            })
            .select("id")
            .single();

          if (error || !created) {
            setSaving(false);
            toast.error("Could not save that reminder.");
            return;
          }

          if (alerts.length) {
            await supabase.from("reminder_alerts").insert(
              alerts.map((offset) => ({
                user_id: userId,
                reminder_id: created.id,
                offset_minutes: offset,
                label: ALERT_PRESETS.find((a) => a.minutes === offset)?.label ?? null,
              })),
            );
          }

          setSaving(false);
          void queryClient.invalidateQueries({ queryKey: ["reminders"] });
          toast.success("Reminder saved");
          navigate({ to: "/home" });
        }}
      >
        <Field label="What should we remind you about?" htmlFor="title">
          <Input
            id="title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Amma's birthday"
            className="h-13 text-lg"
          />
        </Field>

        <Field label="Category" htmlFor="category">
          <Select value={category} onValueChange={(v) => setCategory(v as ReminderCategory)}>
            <SelectTrigger id="category" className="h-13 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-3 xs:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Date" htmlFor="date">
            <Input
              id="date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-13 w-full min-w-0 text-base"
            />
          </Field>
          <Field label="Time" htmlFor="time">
            <Input
              id="time"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="h-13 w-full min-w-0 text-base"
            />
          </Field>
        </div>


        <Field label="Repeats" htmlFor="recurrence">
          <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceKind)}>
            <SelectTrigger id="recurrence" className="h-13 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRENCES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {recurrence === "custom" ? (
          <Field label="Every how many days?" htmlFor="interval">
            <Input
              id="interval"
              type="number"
              min={1}
              max={3650}
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              className="h-13 text-base"
            />
          </Field>
        ) : null}

        <Field label="Birth year (optional — we'll show the age)" htmlFor="birthYear">
          <Input
            id="birthYear"
            inputMode="numeric"
            maxLength={4}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
            placeholder="1968"
            className="h-13 text-base"
          />
        </Field>

        {members && members.length > 0 ? (
          <Field label="Who is this for?" htmlFor="member">
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger id="member" className="h-13 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Just me</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name} · {m.relationship}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field label="Notes" htmlFor="notes">
          <Textarea
            id="notes"
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Book the cake a day early this time."
            rows={3}
            className="text-base"
          />
        </Field>

        <fieldset className="bg-card shadow-card rounded-3xl p-5">
          <legend className="px-2 text-sm font-bold tracking-widest uppercase">Alert me</legend>
          <div className="mt-2 space-y-2">
            {ALERT_PRESETS.map((preset) => {
              const on = alerts.includes(preset.minutes);
              return (
                <button
                  key={preset.minutes}
                  type="button"
                  onClick={() => toggleAlert(preset.minutes)}
                  aria-pressed={on}
                  className={
                    on
                      ? "bg-primary text-primary-foreground min-h-13 w-full rounded-2xl px-4 text-left text-base font-semibold"
                      : "bg-muted text-foreground min-h-13 w-full rounded-2xl px-4 text-left text-base font-semibold"
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="bg-card shadow-card flex items-center justify-between gap-4 rounded-3xl p-5">
          <div>
            <p className="font-semibold">Ring a full-screen alarm</p>
            <p className="text-muted-foreground text-sm">
              Plays a chime for up to 60 seconds when it's due.
            </p>
          </div>
          <Switch checked={highPriority} onCheckedChange={setHighPriority} />
        </div>

        <Button type="submit" size="lg" className="h-15 w-full text-lg" disabled={saving}>
          Save reminder
        </Button>
      </form>
    </AppShell>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-base">
        {label}
      </Label>
      {children}
    </div>
  );
}
