import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Pill, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MedicineForm, type MedicineEdit } from "@/components/MedicineForm";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage, useT } from "@/hooks/useLanguage";
import { useFamilyMembers, useProfile, useReminders, useStreak } from "@/lib/queries";
import { completeReminder } from "@/lib/complete-reminder";
import { localDayKey } from "@/lib/ereminder";
import {
  buildTodayDoses,
  formatSlot,
  groupDosesBySlot,
  groupMedicines,
  isFinished,
  isLowStock,
  type Dose,
  type Medicine,
  type MedicineGroup,
} from "@/lib/medicines";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/medicines")({
  head: () => ({
    meta: [
      { title: "Medicines — My-Mitr" },
      {
        name: "description",
        content: "Your whole day of medicines in one glance, one tap per dose.",
      },
      { property: "og:title", content: "Medicines — My-Mitr" },
      {
        property: "og:description",
        content: "Your whole day of medicines in one glance, one tap per dose.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MedicinesPage,
});

/** Doses already recorded today, so a taken dose stays on the list. */
function useTodayDoseOccurrences() {
  return useQuery({
    queryKey: ["dose_occurrences", localDayKey()],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from("reminder_occurrences")
        .select("reminder_id, status, occurrence_at")
        .gte("occurrence_at", start.toISOString())
        .lt("occurrence_at", end.toISOString());
      if (error) throw error;
      return new Set(
        (data ?? [])
          .filter((row) => row.status === "completed" || row.status === "acknowledged")
          .map((row) => row.reminder_id),
      );
    },
  });
}

/** The medicine records themselves: schedule, stock and course dates. */
function useMedicines() {
  return useQuery({
    queryKey: ["medicines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicines")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}


function MedicinesPage() {
  const t = useT();
  const { language } = useLanguage();
  const locale = language === "hi" ? "hi-IN" : "en-IN";
  const queryClient = useQueryClient();

  const { data: reminders } = useReminders();
  const { data: takenIds } = useTodayDoseOccurrences();
  const { data: streak } = useStreak();

  const doses = useMemo(
    () => buildTodayDoses(reminders ?? [], takenIds ?? new Set<string>()),
    [reminders, takenIds],
  );
  const blocks = useMemo(() => groupDosesBySlot(doses), [doses]);

  const total = doses.length;
  const takenCount = doses.filter((d) => d.taken).length;
  const left = total - takenCount;

  const subtitle =
    total === 0
      ? t("medicines.subtitleEmpty")
      : left === 0
        ? total === 1
          ? t("medicines.subtitleAllOne")
          : t("medicines.subtitleAll", { count: total })
        : takenCount === 0
          ? total === 1
            ? t("medicines.subtitleNoneOne")
            : t("medicines.subtitleNone", { count: total })
          : t("medicines.subtitleSome", { left, count: total });

  const take = useMutation({
    mutationFn: async (dose: Dose) => completeReminder(dose.reminder),
    onSuccess: () => {
      toast.success(t("medicines.takenToast"));
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
      void queryClient.invalidateQueries({ queryKey: ["dose_occurrences"] });
      void queryClient.invalidateQueries({ queryKey: ["streak"] });
    },
    onError: () => toast.error(t("medicines.takenFailed")),
  });

  const { data: records } = useMedicines();
  const legacy = useMemo(
    () => groupMedicines((reminders ?? []).filter((r) => !r.medicine_id)),
    [reminders],
  );
  const lowStock = useMemo(
    () => (records ?? []).filter((m) => isLowStock(m) && !isFinished(m)),
    [records],
  );
  const finishedRecords = useMemo(() => (records ?? []).filter(isFinished), [records]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MedicineEdit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Medicine | null>(null);

  const remindersByMedicine = useMemo(() => {
    const map = new Map<string, typeof reminders extends undefined ? never : NonNullable<typeof reminders>>();
    for (const reminder of reminders ?? []) {
      if (!reminder.medicine_id) continue;
      const list = map.get(reminder.medicine_id) ?? [];
      list.push(reminder);
      map.set(reminder.medicine_id, list);
    }
    return map;
  }, [reminders]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEditRecord(medicine: Medicine) {
    setEditing({
      kind: "record",
      medicine,
      reminders: remindersByMedicine.get(medicine.id) ?? [],
    });
    setFormOpen(true);
  }

  function openEditLegacy(group: MedicineGroup) {
    setEditing({ kind: "legacy", group });
    setFormOpen(true);
  }

  /** Deletes the medicine record and every reminder (and its alerts/occurrences) linked to it. */
  async function removeRecord(medicine: Medicine) {
    const linked = (remindersByMedicine.get(medicine.id) ?? []).map((r) => r.id);
    if (linked.length > 0) {
      await supabase.from("reminder_alerts").delete().in("reminder_id", linked);
      await supabase.from("reminder_occurrences").delete().in("reminder_id", linked);
      const { error: remErr } = await supabase.from("reminders").delete().in("id", linked);
      if (remErr) {
        toast.error(t("medicines.errRemove"));
        return;
      }
    }
    const { error } = await supabase.from("medicines").delete().eq("id", medicine.id);
    if (error) {
      toast.error(t("medicines.errRemove"));
      return;
    }
    toast.success(t("medicines.removed"));
    void queryClient.invalidateQueries({ queryKey: ["medicines"] });
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    void queryClient.invalidateQueries({ queryKey: ["dose_occurrences"] });
  }

  /** Clears the end date, so the course simply carries on. */
  async function continueCourse(medicine: Medicine) {
    const { error } = await supabase
      .from("medicines")
      .update({ end_date: null })
      .eq("id", medicine.id);
    if (error) {
      toast.error(t("medicines.errContinue"));
      return;
    }
    toast.success(t("medicines.continued", { name: medicine.name }));
    void queryClient.invalidateQueries({ queryKey: ["medicines"] });
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
  }


  async function removeMedicine(group: MedicineGroup) {
    if (!window.confirm(t("medicines.removeConfirm", { name: group.name }))) return;
    const { error } = await supabase
      .from("reminders")
      .delete()
      .in("id", group.reminders.map((r) => r.id));
    if (error) {
      toast.error(t("medicines.errRemove"));
      return;
    }
    toast.success(t("medicines.removed"));
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    void queryClient.invalidateQueries({ queryKey: ["dose_occurrences"] });
  }

  async function refill(medicine: Medicine) {
    const answer = window.prompt(
      t("medicines.refillPrompt", { name: medicine.name }),
      medicine.total_qty === null ? "" : String(medicine.total_qty),
    );
    if (answer === null) return;
    const qty = Number.parseInt(answer, 10);
    if (!Number.isFinite(qty) || qty < 0) return;
    const { error } = await supabase
      .from("medicines")
      .update({ remaining_qty: qty, total_qty: Math.max(qty, medicine.total_qty ?? qty) })
      .eq("id", medicine.id);
    if (error) {
      toast.error(t("medicines.errSave"));
      return;
    }
    toast.success(t("medicines.refilled"));
    void queryClient.invalidateQueries({ queryKey: ["medicines"] });
  }

  function scheduleLine(medicine: Medicine): string {
    const times = [...medicine.times].sort().map((time) => formatSlot(time, locale)).join(" · ");
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const when =
      medicine.frequency === "weekly"
        ? [...(medicine.days_of_week ?? [])]
            .sort((a, b) => a - b)
            .map((d) => t(`medicines.day_${dayKeys[d] ?? "sun"}`))
            .join(" · ")
        : medicine.frequency === "interval"
          ? t("medicines.everyDays", { count: medicine.interval_days })
          : t("medicines.everyDay");
    return times ? `${when} · ${times}` : when;
  }


  return (
    <AppShell title={t("medicines.title")} subtitle={undefined} hideHeader>
      <div className="flex items-start justify-between gap-3 px-[22px] pt-6 pb-4">
        <div className="min-w-0">
          <h2 className="text-foreground text-[29px] leading-tight">{t("medicines.title")}</h2>
          <p className="text-muted-foreground mt-1.5 text-[14.5px] font-semibold">{subtitle}</p>
        </div>
        <Button
          type="button"
          size="icon"
          onClick={openAdd}
          aria-label={t("medicines.add")}
          className="size-12 shrink-0 rounded-full"
        >
          <Plus className="size-6" aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-[10px] px-[22px] pb-[18px]">
        {[
          { label: t("medicines.statDoses"), value: total, tone: "bg-[var(--accent-100)] text-[var(--accent-800)]" },
          {
            label: t("medicines.statTaken"),
            value: takenCount,
            tone: "bg-[var(--accent-2-100)] text-[var(--accent-2-800)]",
          },
          {
            label: t("medicines.statStreak"),
            value: streak?.current_streak ?? 0,
            tone: "bg-card shadow-card text-foreground",
          },
        ].map((tile) => (
          <div key={tile.label} className={cn("rounded-[24px] p-4 text-center", tile.tone)}>
            <p className="text-[26px] leading-none">{tile.value}</p>
            <p className="mt-1.5 text-[11.5px] font-semibold">{tile.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-[18px] px-[22px]">
        {lowStock.length > 0 ? (
          <section className="space-y-3 rounded-[28px] bg-[#FDF0DC] p-5">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--accent-800)] uppercase">
              {t("medicines.lowTitle")}
            </p>
            {lowStock.map((medicine) => (
              <div key={medicine.id} className="flex items-center gap-3">
                <p className="min-w-0 flex-1 text-[14.5px] font-semibold text-[var(--accent-900)]">
                  {t("medicines.lowBody", {
                    name: medicine.name,
                    count: medicine.remaining_qty ?? 0,
                  })}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 rounded-full px-5"
                  onClick={() => void refill(medicine)}
                >
                  {t("medicines.refill")}
                </Button>
              </div>
            ))}
          </section>
        ) : null}


        {total === 0 ? (
          <section className="bg-card shadow-card rounded-[28px] p-6 text-center">
            <Pill className="text-primary mx-auto size-8" aria-hidden />
            <h3 className="mt-3 text-xl">{t("medicines.emptyTitle")}</h3>
            <p className="text-muted-foreground mt-2 text-sm">{t("medicines.emptyBody")}</p>
            <Button type="button" className="mt-4 h-12 w-full" onClick={openAdd}>
              {t("medicines.emptyCta")}
            </Button>
          </section>
        ) : null}

        {blocks.map((block) => (
          <section key={block.slot} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-[11px] font-semibold tracking-[0.1em] whitespace-nowrap text-[var(--accent-700)] uppercase">
                {t("medicines.blockHeader", {
                  part: t(
                    `medicines.block${block.part.charAt(0).toUpperCase()}${block.part.slice(1)}`,
                  ),
                  time: formatSlot(block.slot, locale),
                })}
              </h3>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>

            <ul className="space-y-3">
              {block.doses.map((dose) => (
                <li
                  key={dose.reminder.id}
                  className="bg-card shadow-card flex items-center gap-[15px] rounded-[28px] p-[18px]"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-[52px] shrink-0 items-center justify-center rounded-[18px] px-1 text-center text-[13px] font-semibold",
                      dose.taken
                        ? "bg-[var(--accent-2-200)] text-[var(--accent-2-800)]"
                        : "bg-[var(--accent-200)] text-[var(--accent-800)]",
                    )}
                  >
                    {dose.amount ?? <Pill className="size-5" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-[18px] leading-tight font-semibold">
                      {dose.name}
                    </p>
                    {dose.instruction ? (
                      <p className="text-foreground/60 mt-1 truncate text-[14px]">
                        {dose.instruction}
                      </p>
                    ) : null}
                  </div>

                  {dose.taken ? (
                    <span
                      className="animate-mm-pop flex size-[54px] shrink-0 items-center justify-center rounded-full bg-[var(--accent-2-700)]"
                      aria-label={t("medicines.taken", { name: dose.name })}
                    >
                      <Check className="size-7 text-[var(--background)]" strokeWidth={3} aria-hidden />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => take.mutate(dose)}
                      disabled={take.isPending}
                      aria-label={t("medicines.markTaken", { name: dose.name })}
                      className="flex size-[54px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent-400)] text-[var(--accent-700)] transition-colors hover:bg-[var(--accent-100)]"
                    >
                      <Check className="size-7" strokeWidth={2.5} aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {total > 0 && left === 0 ? (
          <section className="animate-mm-rise rounded-[28px] bg-[var(--accent-2-100)] p-6 text-center">
            <p className="text-[17px] font-semibold text-[var(--accent-2-900)]">
              {t("medicines.allTakenTitle")}
            </p>
            <p className="mt-1.5 text-[14px] text-[var(--accent-2-800)]">
              {streak?.current_streak
                ? t("medicines.allTakenStreak", { count: streak.current_streak })
                : t("medicines.allTakenStreakNone")}
            </p>
          </section>
        ) : null}

        {(records ?? []).length > 0 || legacy.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-[11px] font-semibold tracking-[0.1em] whitespace-nowrap text-[var(--accent-700)] uppercase">
                {t("medicines.listTitle")}
              </h3>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <ul className="space-y-3">
              {(records ?? []).map((medicine) => {
                const low = isLowStock(medicine);
                const done = isFinished(medicine);
                return (
                  <li
                    key={medicine.id}
                    className={cn(
                      "shadow-card flex items-center gap-3 rounded-[28px] p-[18px]",
                      low && !done ? "bg-[#FDF0DC]" : "bg-card",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-[16.5px] font-semibold">
                        {medicine.dosage ? `${medicine.name} · ${medicine.dosage}` : medicine.name}
                      </p>
                      <p className="text-foreground/55 mt-1 truncate text-[13px]">
                        {scheduleLine(medicine)}
                      </p>
                      {done ? (
                        <p className="mt-1 text-[13px] font-semibold text-[var(--accent-2-800)]">
                          {t("medicines.finished")}
                        </p>
                      ) : medicine.remaining_qty !== null ? (
                        <p
                          className={cn(
                            "mt-1 text-[13px] font-semibold",
                            low ? "text-[var(--accent-800)]" : "text-foreground/55",
                          )}
                        >
                          {t("medicines.remaining", { count: medicine.remaining_qty })}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11 shrink-0 rounded-full"
                      aria-label={t("medicines.edit", { name: medicine.name })}
                      onClick={() => openEditRecord(medicine)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-destructive size-11 shrink-0 rounded-full"
                      aria-label={t("medicines.remove", { name: medicine.name })}
                      onClick={() => void removeRecord(medicine)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                );
              })}

              {legacy.map((group) => (
                <li
                  key={group.key}
                  className="bg-card shadow-card flex items-center gap-3 rounded-[28px] p-[18px]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-[16.5px] font-semibold">
                      {group.amount ? `${group.name} · ${group.amount}` : group.name}
                    </p>
                    <p className="text-foreground/55 mt-1 truncate text-[13px]">
                      {t("medicines.listTimes", {
                        times: group.times.map((time) => formatSlot(time, locale)).join(" · "),
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0 rounded-full"
                    aria-label={t("medicines.edit", { name: group.name })}
                    onClick={() => openEditLegacy(group)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="text-destructive size-11 shrink-0 rounded-full"
                    aria-label={t("medicines.remove", { name: group.name })}
                    onClick={() => void removeMedicine(group)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}


        <EscalationPanel />
      </div>

      <MedicineForm open={formOpen} onOpenChange={setFormOpen} existing={editing} />
    </AppShell>
  );
}

function EscalationPanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: members } = useFamilyMembers();
  const [saving, setSaving] = useState(false);

  const memberId = profile?.medicine_alert_member_id ?? null;
  const enabled = profile?.medicine_alert_enabled ?? false;
  const member = (members ?? []).find((m) => m.id === memberId) ?? null;

  async function save(next: { enabled?: boolean; memberId?: string | null }) {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        medicine_alert_enabled: next.enabled ?? enabled,
        medicine_alert_member_id:
          next.memberId === undefined ? memberId : next.memberId,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(t("medicines.escalationFailed"));
      return;
    }
    toast.success(t("medicines.escalationSaved"));
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <section className="space-y-3 rounded-[28px] bg-[var(--accent-100)] p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-[var(--accent-900)]">
            {member
              ? t("medicines.escalationTitle", { name: member.full_name })
              : t("medicines.escalationTitleNone")}
          </p>
          <p className="mt-1 text-[13.5px] text-[var(--accent-700)]">
            {t("medicines.escalationHint")}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={saving || !memberId}
          aria-label={t("medicines.escalationToggle")}
          onCheckedChange={(checked) => void save({ enabled: checked })}
          className="h-8 w-14 data-[state=checked]:bg-primary [&>span]:size-7 [&>span]:data-[state=checked]:translate-x-6"
        />
      </div>

      <div>
        <label
          className="text-[12px] font-semibold text-[var(--accent-700)]"
          htmlFor="medicine-alert-member"
        >
          {t("medicines.escalationPicker")}
        </label>
        {(members ?? []).length === 0 ? (
          <p className="mt-1 text-[13.5px] text-[var(--accent-700)]">
            {t("medicines.escalationNoFamily")}
          </p>
        ) : (
          <Select
            value={memberId ?? "none"}
            onValueChange={(value) =>
              void save({ memberId: value === "none" ? null : value, enabled: value !== "none" && enabled })
            }
          >
            <SelectTrigger id="medicine-alert-member" className="bg-card mt-1.5 h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("medicines.escalationPickerNone")}</SelectItem>
              {(members ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {member && !member.whatsapp_phone ? (
          <p className="mt-1.5 text-[13.5px] text-[var(--accent-700)]">
            {t("medicines.escalationNoPhone", { name: member.full_name })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
