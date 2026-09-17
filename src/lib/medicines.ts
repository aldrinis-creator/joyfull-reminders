import type { Reminder } from "@/lib/ereminder";
import { localDayKey } from "@/lib/ereminder";

/**
 * Medicines view helpers.
 *
 * A dose is an existing `health` reminder with `recurrence: "daily"`. The time
 * of day already lives in `reminders.due_at`, so no new column is needed.
 * The dose amount and instruction are read out of the title/description —
 * the schema has no dedicated dosage field, and inventing one would strand
 * every dose that already exists.
 */

export type DosePart = "morning" | "afternoon" | "evening" | "night";

export type Dose = {
  reminder: Reminder;
  /** Today, at this dose's time of day. */
  at: Date;
  /** "08:00" — used to group doses into time blocks. */
  slot: string;
  part: DosePart;
  /** "500mg", "10ml", "1" … or null when nothing parseable is present. */
  amount: string | null;
  /** Drug name with the dose amount stripped off. */
  name: string;
  /** "1 tablet · after food" — the reminder's own notes. */
  instruction: string | null;
  taken: boolean;
};

export function isDose(reminder: Reminder): boolean {
  if (reminder.category !== "health") return false;
  return reminder.recurrence === "daily" || Boolean(reminder.medicine_id);
}


/** Today at the same clock time as the reminder's due moment. */
export function doseTimeToday(reminder: Reminder, today: Date = new Date()): Date {
  const due = new Date(reminder.due_at);
  const at = new Date(today);
  at.setHours(due.getHours(), due.getMinutes(), 0, 0);
  return at;
}

export function slotKey(at: Date): string {
  return `${`${at.getHours()}`.padStart(2, "0")}:${`${at.getMinutes()}`.padStart(2, "0")}`;
}

export function partOfDay(at: Date): DosePart {
  const h = at.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

const AMOUNT_RE = /(\d+(?:\.\d+)?)\s?(mg|ml|mcg|g|iu|tablets?|tabs?|caps?|drops?|units?)?/i;

/** Pulls "500mg" out of "Metformin 500mg", falling back to the description. */
export function parseDoseAmount(reminder: Reminder): string | null {
  for (const source of [reminder.title, reminder.description ?? ""]) {
    const match = AMOUNT_RE.exec(source);
    if (!match) continue;
    const unit = (match[2] ?? "").toLowerCase();
    const short = unit.startsWith("tab")
      ? "tab"
      : unit.startsWith("cap")
        ? "cap"
        : unit.startsWith("drop")
          ? "drop"
          : unit.startsWith("unit")
            ? "u"
            : unit;
    return `${match[1]}${short}`;
  }
  return null;
}

/** The drug name with its dose amount removed, so the tile is not repeated. */
export function doseName(reminder: Reminder): string {
  const stripped = reminder.title
    .replace(/\s*\d+(?:\.\d+)?\s?(mg|ml|mcg|g|iu|tablets?|tabs?|caps?|drops?|units?)\b/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped.length > 0 ? stripped : reminder.title;
}

/**
 * Builds today's dose list from the day's occurrences rather than from the
 * open-reminder list, so a dose that has been taken stays on screen.
 */
export function buildTodayDoses(
  reminders: Reminder[],
  takenReminderIds: Set<string>,
  today: Date = new Date(),
): Dose[] {
  const todayKey = localDayKey(today);
  return reminders
    .filter(isDose)
    // A non-daily medicine (certain weekdays, or every N days) only has a dose
    // today when its next due day is today — or when it was already taken.
    .filter(
      (reminder) =>
        reminder.recurrence === "daily" ||
        localDayKey(new Date(reminder.due_at)) === todayKey ||
        takenReminderIds.has(reminder.id),
    )
    .map((reminder) => {

      const at = doseTimeToday(reminder, today);
      // Completing a dose rolls `due_at` past today, which is itself proof the
      // day is handled even when the occurrence row is still being written.
      const rolledPast = localDayKey(new Date(reminder.due_at)) > todayKey;
      return {
        reminder,
        at,
        slot: slotKey(at),
        part: partOfDay(at),
        amount: parseDoseAmount(reminder),
        name: doseName(reminder),
        instruction: reminder.description?.trim() || null,
        taken: takenReminderIds.has(reminder.id) || rolledPast,
      } satisfies Dose;
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function groupDosesBySlot(doses: Dose[]): { slot: string; part: DosePart; doses: Dose[] }[] {
  const blocks: { slot: string; part: DosePart; doses: Dose[] }[] = [];
  for (const dose of doses) {
    const last = blocks[blocks.length - 1];
    if (last && last.slot === dose.slot) last.doses.push(dose);
    else blocks.push({ slot: dose.slot, part: dose.part, doses: [dose] });
  }
  return blocks;
}

/** One medicine, with every daily reminder that makes up its schedule. */
export type MedicineGroup = {
  key: string;
  name: string;
  amount: string | null;
  instruction: string | null;
  /** "08:00", "19:00" … sorted. */
  times: string[];
  reminders: Reminder[];
};

/** Collapses the daily health reminders into one entry per medicine name. */
export function groupMedicines(reminders: Reminder[]): MedicineGroup[] {
  const groups = new Map<string, MedicineGroup>();
  for (const reminder of reminders.filter(isDose)) {
    const name = doseName(reminder);
    const key = name.toLowerCase();
    const slot = slotKey(new Date(reminder.due_at));
    const existing = groups.get(key);
    if (existing) {
      existing.reminders.push(reminder);
      if (!existing.times.includes(slot)) existing.times.push(slot);
      existing.instruction ??= reminder.description?.trim() || null;
      existing.amount ??= parseDoseAmount(reminder);
    } else {
      groups.set(key, {
        key,
        name,
        amount: parseDoseAmount(reminder),
        instruction: reminder.description?.trim() || null,
        times: [slot],
        reminders: [reminder],
      });
    }
  }
  const list = [...groups.values()];
  for (const group of list) group.times.sort();
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function formatSlot(slot: string, locale: string): string {
  const [h = "0", m = "0"] = slot.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}
