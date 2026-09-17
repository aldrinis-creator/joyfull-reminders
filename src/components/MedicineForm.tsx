import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/hooks/useLanguage";
import { slotKey, type MedicineGroup } from "@/lib/medicines";
import { cn } from "@/lib/utils";

type SlotName = "morning" | "afternoon" | "evening" | "night";

const SLOTS: { name: SlotName; defaultTime: string }[] = [
  { name: "morning", defaultTime: "08:00" },
  { name: "afternoon", defaultTime: "13:00" },
  { name: "evening", defaultTime: "19:00" },
  { name: "night", defaultTime: "21:30" },
];

function slotOf(time: string): SlotName {
  const hour = Number(time.split(":")[0] ?? 0);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

/** Start date + "HH:MM" → a Date, rolled to tomorrow when it is already past. */
function firstDueAt(startDate: string, time: string): Date {
  const [y = 1970, m = 1, d = 1] = startDate.split("-").map(Number);
  const [h = 0, min = 0] = time.split(":").map(Number);
  const at = new Date(y, m - 1, d, h, min, 0, 0);
  if (at.getTime() < Date.now()) at.setDate(at.getDate() + 1);
  return at;
}

type State = Record<SlotName, { on: boolean; time: string }>;

function initialState(existing?: MedicineGroup | null): State {
  const state = Object.fromEntries(
    SLOTS.map((s) => [s.name, { on: false, time: s.defaultTime }]),
  ) as State;
  for (const time of existing?.times ?? []) {
    const slot = slotOf(time);
    state[slot] = { on: true, time };
  }
  return state;
}

export function MedicineForm({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: MedicineGroup | null;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [instruction, setInstruction] = useState("");
  const [startDate, setStartDate] = useState(todayKey());
  const [slots, setSlots] = useState<State>(() => initialState(existing));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "");
    setStrength(existing?.amount ?? "");
    setInstruction(existing?.instruction ?? "");
    setStartDate(todayKey());
    setSlots(initialState(existing));
  }, [open, existing]);

  const chosen = useMemo(
    () =>
      SLOTS.filter((s) => slots[s.name].on)
        .map((s) => slots[s.name].time)
        .sort(),
    [slots],
  );

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t("medicines.errName"));
      return;
    }
    if (chosen.length === 0) {
      toast.error(t("medicines.errTimes"));
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

    const title = strength.trim() ? `${trimmedName} ${strength.trim()}` : trimmedName;
    const description = instruction.trim() || null;

    // Keep a reminder per dose time: reuse the rows that already match a time,
    // add the new times, drop the ones the user switched off.
    const current = existing?.reminders ?? [];
    const byTime = new Map(current.map((r) => [slotKey(new Date(r.due_at)), r]));
    const keep = new Set(chosen);

    const updates = chosen
      .filter((time) => byTime.has(time))
      .map((time) => {
        const reminder = byTime.get(time)!;
        return supabase
          .from("reminders")
          .update({ title, description })
          .eq("id", reminder.id);
      });

    const inserts = chosen
      .filter((time) => !byTime.has(time))
      .map((time) => ({
        user_id: userId,
        title,
        description,
        category: "health" as const,
        recurrence: "daily" as const,
        due_at: firstDueAt(startDate, time).toISOString(),
        priority: "normal" as const,
      }));

    const removedIds = current
      .filter((r) => !keep.has(slotKey(new Date(r.due_at))))
      .map((r) => r.id);

    const results = await Promise.all([
      ...updates,
      inserts.length ? supabase.from("reminders").insert(inserts) : Promise.resolve({ error: null }),
      removedIds.length
        ? supabase.from("reminders").delete().in("id", removedIds)
        : Promise.resolve({ error: null }),
    ]);

    setSaving(false);
    if (results.some((r) => r.error)) {
      toast.error(t("medicines.errSave"));
      return;
    }
    toast.success(existing ? t("medicines.updated") : t("medicines.added"));
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("medicines.fieldNamePlaceholder")}
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="medicine-strength">{t("medicines.fieldStrength")}</Label>
            <Input
              id="medicine-strength"
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              placeholder={t("medicines.fieldStrengthPlaceholder")}
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="medicine-instruction">{t("medicines.fieldInstruction")}</Label>
            <Input
              id="medicine-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t("medicines.fieldInstructionPlaceholder")}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("medicines.fieldTimes")}</Label>
            <div className="space-y-2">
              {SLOTS.map((slot) => {
                const state = slots[slot.name];
                return (
                  <div key={slot.name} className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-pressed={state.on}
                      onClick={() =>
                        setSlots((prev) => ({
                          ...prev,
                          [slot.name]: { ...prev[slot.name], on: !prev[slot.name].on },
                        }))
                      }
                      className={cn(
                        "h-12 flex-1 rounded-2xl border-2 px-4 text-left text-[15px] font-semibold transition-colors",
                        state.on
                          ? "border-[var(--accent-700)] bg-[var(--accent-100)] text-[var(--accent-900)]"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {t(
                        `medicines.block${slot.name.charAt(0).toUpperCase()}${slot.name.slice(1)}`,
                      )}
                    </button>
                    <Input
                      type="time"
                      value={state.time}
                      disabled={!state.on}
                      aria-label={t("medicines.timeFor", {
                        part: t(
                          `medicines.block${slot.name.charAt(0).toUpperCase()}${slot.name.slice(1)}`,
                        ),
                      })}
                      onChange={(e) =>
                        setSlots((prev) => ({
                          ...prev,
                          [slot.name]: { ...prev[slot.name], time: e.target.value || slot.defaultTime },
                        }))
                      }
                      className="h-12 w-[130px]"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {existing ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="medicine-start">{t("medicines.fieldStart")}</Label>
              <Input
                id="medicine-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value || todayKey())}
                className="h-12"
              />
            </div>
          )}
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
          <Button type="button" className="h-12 flex-1" disabled={saving} onClick={() => void save()}>
            {t("medicines.save")}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
