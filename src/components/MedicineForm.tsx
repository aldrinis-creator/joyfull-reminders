import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/hooks/useLanguage";
import { slotKey, type Medicine, type MedicineFrequency, type MedicineGroup } from "@/lib/medicines";
import type { Reminder } from "@/lib/ereminder";
import { cn } from "@/lib/utils";

/** What the screen hands the form: a real record, or an older reminder-only medicine. */
export type MedicineEdit =
  | { kind: "record"; medicine: Medicine; reminders: Reminder[] }
  | { kind: "legacy"; group: MedicineGroup };

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

function atTime(dateKey: string, time: string): Date {
  const [y = 1970, m = 1, d = 1] = dateKey.split("-").map(Number);
  const [h = 0, min = 0] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

/** First moment this dose is due: from the start date, rolled forward if past. */
function firstDueAt(startDate: string, time: string, weekday: number | null): Date {
  const at = atTime(startDate, time);
  if (weekday === null) {
    while (at.getTime() < Date.now()) at.setDate(at.getDate() + 1);
    return at;
  }
  while (at.getDay() !== weekday || at.getTime() < Date.now()) at.setDate(at.getDate() + 1);
  return at;
}

type Draft = {
  name: string;
  dosage: string;
  instructions: string;
  frequency: MedicineFrequency;
  days: number[];
  intervalDays: number;
  times: string[];
  totalQty: string;
  remainingQty: string;
  threshold: string;
  startDate: string;
  endDate: string;
};

function draftFrom(existing: MedicineEdit | null | undefined): Draft {
  if (existing?.kind === "record") {
    const m = existing.medicine;
    return {
      name: m.name,
      dosage: m.dosage ?? "",
      instructions: m.instructions ?? "",
      frequency: m.frequency,
      days: m.days_of_week ?? [],
      intervalDays: m.interval_days ?? 1,
      times: m.times.length ? [...m.times].sort() : ["08:00"],
      totalQty: m.total_qty === null ? "" : String(m.total_qty),
      remainingQty: m.remaining_qty === null ? "" : String(m.remaining_qty),
      threshold: String(m.low_stock_threshold ?? 2),
      startDate: m.start_date,
      endDate: m.end_date ?? "",
    };
  }
  if (existing?.kind === "legacy") {
    const g = existing.group;
    return {
      name: g.name,
      dosage: g.amount ?? "",
      instructions: g.instruction ?? "",
      frequency: "daily",
      days: [],
      intervalDays: 1,
      times: g.times.length ? [...g.times] : ["08:00"],
      totalQty: "",
      remainingQty: "",
      threshold: "2",
      startDate: todayKey(),
      endDate: "",
    };
  }
  return {
    name: "",
    dosage: "",
    instructions: "",
    frequency: "daily",
    days: [],
    intervalDays: 1,
    times: ["08:00"],
    totalQty: "",
    remainingQty: "",
    threshold: "2",
    startDate: todayKey(),
    endDate: "",
  };
}

export function MedicineForm({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: MedicineEdit | null;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(existing));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(draftFrom(existing));
  }, [open, existing]);

  function patch(next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  async function save() {
    const name = draft.name.trim();
    if (!name) {
      toast.error(t("medicines.errName"));
      return;
    }
    const times = [...new Set(draft.times.filter(Boolean))].sort();
    if (times.length === 0) {
      toast.error(t("medicines.errTimes"));
      return;
    }
    if (draft.frequency === "weekly" && draft.days.length === 0) {
      toast.error(t("medicines.errDays"));
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      toast.error(t("medicines.errSave"));
      return;
    }

    const toInt = (value: string) => {
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) ? n : null;
    };

    const payload = {
      user_id: userId,
      name,
      dosage: draft.dosage.trim() || null,
      instructions: draft.instructions.trim() || null,
      frequency: draft.frequency,
      days_of_week: draft.frequency === "weekly" ? [...draft.days].sort() : [],
      interval_days: draft.frequency === "interval" ? Math.max(1, draft.intervalDays) : 1,
      times,
      total_qty: toInt(draft.totalQty),
      remaining_qty: toInt(draft.remainingQty) ?? toInt(draft.totalQty),
      low_stock_threshold: toInt(draft.threshold) ?? 2,
      start_date: draft.startDate || todayKey(),
      end_date: draft.endDate || null,
      active: true,
    };

    let medicineId = existing?.kind === "record" ? existing.medicine.id : null;
    if (medicineId) {
      const { error } = await supabase.from("medicines").update(payload).eq("id", medicineId);
      if (error) {
        setSaving(false);
        toast.error(t("medicines.errSave"));
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("medicines")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast.error(t("medicines.errSave"));
        return;
      }
      medicineId = data.id;
    }

    // One reminder per dose moment, so alarms, streaks and the late-dose
    // WhatsApp alert keep working exactly as before.
    const title = payload.dosage ? `${name} ${payload.dosage}` : name;
    const description = payload.instructions;
    const wanted: { time: string; weekday: number | null }[] =
      draft.frequency === "weekly"
        ? draft.days.flatMap((day) => times.map((time) => ({ time, weekday: day })))
        : times.map((time) => ({ time, weekday: null }));

    const currentReminders =
      existing?.kind === "record"
        ? existing.reminders
        : existing?.kind === "legacy"
          ? existing.group.reminders
          : [];
    const keyOf = (time: string, weekday: number | null) => `${weekday ?? "*"}|${time}`;
    const byKey = new Map(
      currentReminders.map((r) => {
        const due = new Date(r.due_at);
        return [keyOf(slotKey(due), draft.frequency === "weekly" ? due.getDay() : null), r] as const;
      }),
    );

    const shared = {
      title,
      description,
      medicine_id: medicineId,
      category: "health" as const,
      recurrence:
        draft.frequency === "daily"
          ? ("daily" as const)
          : draft.frequency === "weekly"
            ? ("weekly" as const)
            : ("custom" as const),
      recurrence_interval_days:
        draft.frequency === "interval" ? Math.max(1, draft.intervalDays) : null,
    };

    const wantedKeys = new Set(wanted.map((w) => keyOf(w.time, w.weekday)));
    const ops: Promise<{ error: unknown }>[] = [];
    const keptIds: string[] = [];

    for (const { time, weekday } of wanted) {
      const match = byKey.get(keyOf(time, weekday));
      if (match) {
        keptIds.push(match.id);
        ops.push(
          supabase.from("reminders").update(shared).eq("id", match.id) as unknown as Promise<{
            error: unknown;
          }>,
        );
      }
    }

    const inserts = wanted
      .filter(({ time, weekday }) => !byKey.has(keyOf(time, weekday)))
      .map(({ time, weekday }) => ({
        ...shared,
        user_id: userId,
        priority: "normal" as const,
        due_at: firstDueAt(payload.start_date, time, weekday).toISOString(),
      }));
    let createdIds: string[] = [];
    if (inserts.length) {
      const { data: created, error } = await supabase
        .from("reminders")
        .insert(inserts)
        .select("id");
      if (error) {
        setSaving(false);
        toast.error(t("medicines.errSave"));
        return;
      }
      createdIds = (created ?? []).map((r) => r.id);
    }

    const removed = [...byKey.entries()]
      .filter(([key]) => !wantedKeys.has(key))
      .map(([, reminder]) => reminder.id);
    if (removed.length) {
      // Alerts first: leaving them behind would keep the cron sending pushes
      // for a dose time the person just took off the schedule.
      ops.push(
        supabase.from("reminder_alerts").delete().in("reminder_id", removed) as unknown as Promise<{
          error: unknown;
        }>,
      );
      ops.push(
        supabase.from("reminders").delete().in("id", removed) as unknown as Promise<{
          error: unknown;
        }>,
      );
    }

    const results = await Promise.all(ops);
    if (results.some((r) => r.error)) {
      setSaving(false);
      toast.error(t("medicines.errSave"));
      return;
    }

    // Every dose reminder needs exactly one "at the time" alert row, otherwise
    // the delivery cron never sees it and the phone stays silent.
    const alertRows: { user_id: string; reminder_id: string; offset_minutes: number }[] =
      createdIds.map((id) => ({ user_id: userId, reminder_id: id, offset_minutes: 0 }));
    if (keptIds.length) {
      const { data: existingAlerts } = await supabase
        .from("reminder_alerts")
        .select("reminder_id")
        .in("reminder_id", keptIds);
      const haveAlerts = new Set((existingAlerts ?? []).map((a) => a.reminder_id));
      for (const id of keptIds) {
        if (!haveAlerts.has(id)) {
          alertRows.push({ user_id: userId, reminder_id: id, offset_minutes: 0 });
        }
      }
    }
    if (alertRows.length) {
      const { error: alertError } = await supabase.from("reminder_alerts").insert(alertRows);
      if (alertError) {
        setSaving(false);
        toast.error(t("medicines.errSave"));
        return;
      }
    }

    setSaving(false);
    toast.success(existing ? t("medicines.updated") : t("medicines.added"));
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    void queryClient.invalidateQueries({ queryKey: ["medicines"] });
    void queryClient.invalidateQueries({ queryKey: ["dose_occurrences"] });
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{existing ? t("medicines.editTitle") : t("medicines.addTitle")}</DrawerTitle>
          <DrawerDescription>{t("medicines.addHint")}</DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="medicine-name">{t("medicines.fieldName")}</Label>
            <Input
              id="medicine-name"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={t("medicines.fieldNamePlaceholder")}
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="medicine-strength">{t("medicines.fieldStrength")}</Label>
            <Input
              id="medicine-strength"
              value={draft.dosage}
              onChange={(e) => patch({ dosage: e.target.value })}
              placeholder={t("medicines.fieldStrengthPlaceholder")}
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="medicine-frequency">{t("medicines.fieldFrequency")}</Label>
            <Select
              value={draft.frequency}
              onValueChange={(value) => patch({ frequency: value as MedicineFrequency })}
            >
              <SelectTrigger id="medicine-frequency" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("medicines.freqDaily")}</SelectItem>
                <SelectItem value="weekly">{t("medicines.freqWeekly")}</SelectItem>
                <SelectItem value="interval">{t("medicines.freqInterval")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {draft.frequency === "weekly" ? (
            <div className="space-y-2">
              <Label>{t("medicines.fieldDays")}</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_KEYS.map((key, index) => {
                  const on = draft.days.includes(index);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        patch({
                          days: on
                            ? draft.days.filter((d) => d !== index)
                            : [...draft.days, index],
                        })
                      }
                      className={cn(
                        "size-12 rounded-full border-2 text-[13px] font-semibold transition-colors",
                        on
                          ? "border-[var(--accent-700)] bg-[var(--accent-100)] text-[var(--accent-900)]"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {t(`medicines.day_${key}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {draft.frequency === "interval" ? (
            <div className="space-y-1.5">
              <Label htmlFor="medicine-interval">{t("medicines.fieldInterval")}</Label>
              <Input
                id="medicine-interval"
                type="number"
                min={1}
                value={draft.intervalDays}
                onChange={(e) => patch({ intervalDays: Math.max(1, Number(e.target.value) || 1) })}
                className="h-12"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="medicine-instruction">{t("medicines.fieldInstruction")}</Label>
            <Input
              id="medicine-instruction"
              value={draft.instructions}
              onChange={(e) => patch({ instructions: e.target.value })}
              placeholder={t("medicines.fieldInstructionPlaceholder")}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("medicines.fieldTimes")}</Label>
            <div className="space-y-2">
              {draft.times.map((time, index) => (
                <div key={`${time}-${index}`} className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={time}
                    aria-label={t("medicines.timeNumber", { number: index + 1 })}
                    onChange={(e) =>
                      patch({
                        times: draft.times.map((value, i) =>
                          i === index ? e.target.value || value : value,
                        ),
                      })
                    }
                    className="h-12 flex-1"
                  />
                  {draft.times.length > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-12 shrink-0 rounded-full"
                      aria-label={t("medicines.removeTime")}
                      onClick={() => patch({ times: draft.times.filter((_, i) => i !== index) })}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => patch({ times: [...draft.times, "20:00"] })}
            >
              <Plus className="mr-1 size-4" aria-hidden />
              {t("medicines.addTime")}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="medicine-total">{t("medicines.fieldTotalQty")}</Label>
              <Input
                id="medicine-total"
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.totalQty}
                onChange={(e) => patch({ totalQty: e.target.value })}
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="medicine-remaining">{t("medicines.fieldRemainingQty")}</Label>
              <Input
                id="medicine-remaining"
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.remainingQty}
                onChange={(e) => patch({ remainingQty: e.target.value })}
                className="h-12"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="medicine-threshold">{t("medicines.fieldThreshold")}</Label>
            <Input
              id="medicine-threshold"
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.threshold}
              onChange={(e) => patch({ threshold: e.target.value })}
              className="h-12"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="medicine-start">{t("medicines.fieldStart")}</Label>
              <Input
                id="medicine-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => patch({ startDate: e.target.value || todayKey() })}
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="medicine-end">{t("medicines.fieldEnd")}</Label>
              <Input
                id="medicine-end"
                type="date"
                value={draft.endDate}
                onChange={(e) => patch({ endDate: e.target.value })}
                className="h-12"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            onClick={() => onOpenChange(false)}
          >
            {t("medicines.cancel")}
          </Button>
          <Button
            type="button"
            className="h-12 flex-1"
            disabled={saving}
            onClick={() => void save()}
          >
            {t("medicines.save")}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
