import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
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
import { useT } from "@/hooks/useLanguage";
import { isValidUpiId, safePaymentUrl } from "@/lib/pay-link";
import { VoiceReminderButton } from "@/components/VoiceReminderButton";
import type { ParsedReminder } from "@/lib/voice-reminder.schemas";

import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";

import {
  ALERT_PRESETS,
  SELECTABLE_CATEGORIES,
  normalizeCategory,
  RECURRENCES,
  SPECIAL_DATE_KINDS,
  alertPresetLabel,
  categoryFields,
  categoryLabel,
  recurrenceLabel,
  specialDateKindLabel,
  type RecurrenceKind,
  type Reminder,
  type ReminderCategory,
  type SpecialDateKind,
} from "@/lib/ereminder";

const schema = z.object({
  title: z.string().trim().min(1, "reminders.errTitle").max(120),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.string().min(1, "reminders.errDate"),
  dueTime: z.string().min(1, "reminders.errTime"),
  birthYear: z.string().trim().max(4).optional(),
});

/** Local date/time parts for the two inputs (never UTC — see the streak fix). */
function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * One form for both creating and editing a reminder. When `existing` is set we
 * update that row (and replace its alert rows) instead of inserting.
 */
export function ReminderForm({
  existing,
  existingAlerts,
}: {
  existing?: Reminder | undefined;
  existingAlerts?: number[] | undefined;
}) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: members } = useFamilyMembers();

  const initial = existing ? localParts(existing.due_at) : null;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState<ReminderCategory>(
    normalizeCategory(existing?.category ?? "personal_family"),
  );
  const [description, setDescription] = useState(existing?.description ?? "");
  const [dueDate, setDueDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState(initial?.time ?? "09:00");
  const [recurrence, setRecurrence] = useState<RecurrenceKind>(existing?.recurrence ?? "once");
  const [intervalDays, setIntervalDays] = useState(
    existing?.recurrence_interval_days ? String(existing.recurrence_interval_days) : "30",
  );
  const [birthYear, setBirthYear] = useState(existing?.birth_year ? String(existing.birth_year) : "");
  const [memberId, setMemberId] = useState<string>(existing?.family_member_id ?? "none");
  const [highPriority, setHighPriority] = useState((existing?.priority ?? "high") === "high");
  const [alerts, setAlerts] = useState<number[]>(existingAlerts ?? [1440, 0]);
  const [paymentUrl, setPaymentUrl] = useState(existing?.payment_url ?? "");
  const [upiId, setUpiId] = useState(existing?.upi_id ?? "");
  const [upiPayee, setUpiPayee] = useState(existing?.upi_payee_name ?? "");
  const [payAmount, setPayAmount] = useState(
    existing?.payment_amount != null ? String(existing.payment_amount) : "",
  );
  const [occasionKind, setOccasionKind] = useState<SpecialDateKind>(
    existing?.occasion_kind ?? "birthday",
  );
  const [location, setLocation] = useState(existing?.location ?? "");
  const [participants, setParticipants] = useState(existing?.participants ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(existing?.vehicle_number ?? "");
  const [institution, setInstitution] = useState(existing?.institution ?? "");
  const [saving, setSaving] = useState(false);

  const fields = categoryFields(category);

  const toggleAlert = (minutes: number) =>
    setAlerts((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes],
    );

  /** Fills only what the voice step was confident about — never clears the rest. */
  function applyParsed(parsed: ParsedReminder) {
    if (parsed.title) setTitle(parsed.title.slice(0, 120));
    if (parsed.category) setCategory(parsed.category);
    if (parsed.date) setDueDate(parsed.date);
    if (parsed.time) setDueTime(parsed.time);
    if (parsed.recurrence) setRecurrence(parsed.recurrence);
    if (parsed.description) setDescription(parsed.description.slice(0, 1000));
    if (parsed.location) setLocation(parsed.location);
    if (parsed.participants) setParticipants(parsed.participants);
    if (parsed.vehicleNumber) setVehicleNumber(parsed.vehicleNumber);
    if (parsed.institution) setInstitution(parsed.institution);
  }


  return (
    <form
      className="space-y-5 pb-8"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = schema.safeParse({ title, description, dueDate, dueTime, birthYear });
        if (!parsed.success) {
          toast.error(t(parsed.error.issues[0]?.message ?? "reminders.errForm"));
          return;
        }
        const dueAt = new Date(`${dueDate}T${dueTime}`);
        if (Number.isNaN(dueAt.getTime())) {
          toast.error(t("reminders.errInvalidDate"));
          return;
        }
        const trimmedUrl = fields.payment ? paymentUrl.trim() : "";
        const normalizedUrl = trimmedUrl ? safePaymentUrl(trimmedUrl) : null;
        if (trimmedUrl && !normalizedUrl) {
          toast.error(t("reminders.errPaymentUrl"));
          return;
        }
        const trimmedUpi = fields.payment ? upiId.trim() : "";
        if (trimmedUpi && !isValidUpiId(trimmedUpi)) {
          toast.error(t("reminders.errUpiId"));
          return;
        }
        setSaving(true);
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          setSaving(false);
          toast.error(t("reminders.errSignIn"));
          return;
        }

        // Only persist what the chosen category actually asks for.
        const payload = {
          title: parsed.data.title,
          category,
          description: parsed.data.description || null,
          due_at: dueAt.toISOString(),
          recurrence,
          recurrence_interval_days:
            recurrence === "custom" ? Math.max(1, Number(intervalDays) || 30) : null,
          birth_year: fields.occasion && occasionKind === "birthday" && birthYear ? Number(birthYear) : null,
          family_member_id: fields.familyMember && memberId !== "none" ? memberId : null,
          occasion_kind: fields.occasion ? occasionKind : null,
          location: fields.location ? location.trim() || null : null,
          participants: fields.participants ? participants.trim() || null : null,
          vehicle_number: fields.vehicle ? vehicleNumber.trim() || null : null,
          institution: fields.institution ? institution.trim() || null : null,
          priority: highPriority ? ("high" as const) : ("normal" as const),
          payment_url: fields.payment ? normalizedUrl : null,
          upi_id: fields.payment ? trimmedUpi || null : null,
          upi_payee_name: fields.payment ? upiPayee.trim() || null : null,
          // Recurring bills change every cycle, so no amount is ever stored for them.
          payment_amount:
            fields.payment && recurrence === "once" && payAmount.trim()
              ? Number(payAmount) || null
              : null,
        };


        let reminderId = existing?.id ?? "";

        if (existing) {
          const { error } = await supabase.from("reminders").update(payload).eq("id", existing.id);
          if (error) {
            setSaving(false);
            toast.error(t("reminders.errSave"));
            return;
          }
          await supabase.from("reminder_alerts").delete().eq("reminder_id", existing.id);
        } else {
          const { data: created, error } = await supabase
            .from("reminders")
            .insert({ user_id: userId, ...payload })
            .select("id")
            .single();
          if (error || !created) {
            setSaving(false);
            toast.error(t("reminders.errSave"));
            return;
          }
          reminderId = created.id;
        }

        if (alerts.length) {
          await supabase.from("reminder_alerts").insert(
            alerts.map((offset) => ({
              user_id: userId,
              reminder_id: reminderId,
              offset_minutes: offset,
              label: ALERT_PRESETS.find((a) => a.minutes === offset)?.label ?? null,
            })),
          );
        }

        setSaving(false);
        void queryClient.invalidateQueries({ queryKey: ["reminders"] });
        void queryClient.invalidateQueries({ queryKey: ["reminder", reminderId] });
        toast.success(existing ? t("reminders.updated") : t("reminders.saved"));
        navigate({ to: "/home" });
      }}
    >
      {existing ? null : <VoiceReminderButton onParsed={applyParsed} />}

      <Field label={t("reminders.fieldTitle")} htmlFor="title">
        <Input
          id="title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          className="h-13 text-lg"
        />
      </Field>

      <Field label={t("reminders.fieldCategory")} htmlFor="category">
        <Select value={category} onValueChange={(v) => setCategory(v as ReminderCategory)}>
          <SelectTrigger id="category" className="h-13 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SELECTABLE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.emoji} {categoryLabel(c.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field label={t("reminders.fieldDate")} htmlFor="date">
          <Input
            id="date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-13 w-full min-w-0 text-base"
          />
        </Field>
        <Field label={t("reminders.fieldTime")} htmlFor="time">
          <Input
            id="time"
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            className="h-13 w-full min-w-0 text-base"
          />
        </Field>
      </div>

      <Field label={t("reminders.fieldRepeats")} htmlFor="recurrence">
        <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceKind)}>
          <SelectTrigger id="recurrence" className="h-13 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECURRENCES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {recurrenceLabel(r.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {recurrence === "custom" ? (
        <Field label={t("reminders.fieldInterval")} htmlFor="interval">
          <Input
            id="interval"
            inputMode="numeric"
            value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value)}
            className="h-13 text-base"
          />
        </Field>
      ) : null}

      {fields.occasion ? (
        <Field label={t("reminders.fieldOccasion")} htmlFor="occasion">
          <Select value={occasionKind} onValueChange={(v) => setOccasionKind(v as SpecialDateKind)}>
            <SelectTrigger id="occasion" className="h-13 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPECIAL_DATE_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.emoji} {specialDateKindLabel(k.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {fields.occasion && occasionKind === "birthday" ? (
        <Field label={t("reminders.fieldBirthYear")} htmlFor="birthYear" hint={t("reminders.hintBirthYear")}>
          <Input
            id="birthYear"
            inputMode="numeric"
            maxLength={4}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
            className="h-13 text-base"
          />
        </Field>
      ) : null}

      {fields.location ? (
        <Field
          label={category === "meeting" ? t("reminders.fieldMeetingLocation") : t("reminders.fieldLocation")}
          htmlFor="location"
          hint={category === "meeting" ? t("reminders.hintMeetingLocation") : t("reminders.hintLocation")}
        >
          <Input
            id="location"
            value={location}
            maxLength={200}
            onChange={(e) => setLocation(e.target.value)}
            className="h-13 text-base"
          />
        </Field>
      ) : null}

      {fields.participants ? (
        <Field
          label={category === "meeting" ? t("reminders.fieldAttendees") : t("reminders.fieldWithWhom")}
          htmlFor="participants"
          hint={category === "meeting" ? t("reminders.hintAttendees") : t("reminders.hintWithWhom")}
        >
          <Input
            id="participants"
            value={participants}
            maxLength={200}
            onChange={(e) => setParticipants(e.target.value)}
            className="h-13 text-base"
          />
        </Field>
      ) : null}

      {fields.vehicle ? (
        <Field label={t("reminders.fieldVehicle")} htmlFor="vehicle" hint={t("reminders.hintVehicle")}>
          <Input
            id="vehicle"
            value={vehicleNumber}
            maxLength={40}
            onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            className="h-13 text-base"
          />
        </Field>
      ) : null}

      {fields.institution ? (
        <Field
          label={t("reminders.fieldInstitution")}
          htmlFor="institution"
          hint={t("reminders.hintInstitution")}
        >
          <Input
            id="institution"
            value={institution}
            maxLength={120}
            onChange={(e) => setInstitution(e.target.value)}
            className="h-13 text-base"
          />
        </Field>
      ) : null}

      {fields.familyMember && members && members.length > 0 ? (
        <Field label={t("reminders.fieldFor")} htmlFor="member">
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger id="member" className="h-13 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("reminders.justMe")}</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name} · {m.relationship}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <Field label={t("reminders.fieldNotes")} htmlFor="notes" hint={t("reminders.hintNotes")}>
        <Textarea
          id="notes"
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="text-base"
        />
      </Field>

      {fields.payment ? (
        <details className="bg-card shadow-card rounded-3xl p-5" open={Boolean(paymentUrl || upiId)}>
          <summary className="cursor-pointer text-base font-semibold">
            {t("reminders.paymentSection")}
          </summary>
          <p className="text-muted-foreground mt-1 text-sm">{t("reminders.paymentHint")}</p>
          <div className="mt-4 space-y-4">
            <Field
              label={t("reminders.fieldPaymentUrl")}
              htmlFor="paymentUrl"
              hint={t("reminders.hintPaymentUrl")}
            >
              <Input
                id="paymentUrl"
                inputMode="url"
                value={paymentUrl}
                onChange={(e) => setPaymentUrl(e.target.value)}
                className="h-13 text-base"
              />
            </Field>
            <Field label={t("reminders.fieldUpiId")} htmlFor="upiId" hint={t("reminders.hintUpiId")}>
              <Input
                id="upiId"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="h-13 text-base"
              />
            </Field>
            <Field label={t("reminders.fieldPayee")} htmlFor="upiPayee" hint={t("reminders.hintPayee")}>
              <Input
                id="upiPayee"
                value={upiPayee}
                onChange={(e) => setUpiPayee(e.target.value)}
                className="h-13 text-base"
              />
            </Field>
            {recurrence === "once" ? (
              <Field
                label={t("reminders.fieldAmount")}
                htmlFor="payAmount"
                hint={t("reminders.hintAmount")}
              >
                <Input
                  id="payAmount"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  className="h-13 text-base"
                />
              </Field>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("reminders.amountVariesNote")}
              </p>
            )}
          </div>
        </details>
      ) : null}


      <fieldset className="bg-card shadow-card rounded-3xl p-5">
        <legend className="px-2 text-sm font-bold tracking-widest uppercase">
          {t("reminders.alertMe")}
        </legend>
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
                {alertPresetLabel(preset.minutes)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="bg-card shadow-card flex items-center justify-between gap-4 rounded-3xl p-5">
        <div>
          <p className="font-semibold">{t("reminders.alarmTitle")}</p>
          <p className="text-muted-foreground text-sm">{t("reminders.alarmBody")}</p>
        </div>
        <Switch checked={highPriority} onCheckedChange={setHighPriority} />
      </div>

      <Button type="submit" size="lg" className="h-15 w-full text-lg" disabled={saving}>
        {saving ? t("saving") : existing ? t("reminders.updateCta") : t("reminders.saveCta")}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-base">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
    </div>
  );
}
