import type { Database } from "@/integrations/supabase/types";
import { activeLocale, translate } from "@/lib/i18n";


export type ReminderCategory = Database["public"]["Enums"]["reminder_category"];
export type RecurrenceKind = Database["public"]["Enums"]["recurrence_kind"];
export type ReminderPriority = Database["public"]["Enums"]["reminder_priority"];
export type SpecialDateKind = Database["public"]["Enums"]["special_date_kind"];
export type VendorKind = Database["public"]["Enums"]["vendor_kind"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
export type FamilyMember = Database["public"]["Tables"]["family_members"]["Row"];
export type SpecialDate = Database["public"]["Tables"]["special_dates"]["Row"];
export type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
export type VendorProduct = Database["public"]["Tables"]["vendor_products"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];

export const CATEGORIES: {
  value: ReminderCategory;
  label: string;
  short: string;
  colorVar: string;
  emoji: string;
  /** Retired category kept only so older rows still render. */
  hidden?: boolean;
}[] = [
  {
    value: "personal_family",
    label: "Personal & Family",
    short: "Family",
    colorVar: "var(--cat-personal-family)",
    emoji: "🎂",
  },
  {
    value: "finance_tax",
    label: "Bills, Subscriptions & Trials",
    short: "Bills",
    colorVar: "var(--cat-finance-tax)",
    emoji: "₹",
  },
  {
    value: "automotive",
    label: "Vehicle (PUC, Insurance)",
    short: "Vehicle",
    colorVar: "var(--cat-automotive)",
    emoji: "🚗",
  },
  {
    value: "academic_career",
    label: "Academic & Career",
    short: "Exams",
    colorVar: "var(--cat-academic-career)",
    emoji: "🎓",
  },
  {
    value: "subscription",
    label: "Subscriptions & Trials",
    short: "Subs",
    colorVar: "var(--cat-subscription)",
    emoji: "📺",
    hidden: true,
  },
  { value: "health", label: "Health", short: "Health", colorVar: "var(--cat-health)", emoji: "🩺" },
  {
    value: "household",
    label: "Household & Utilities",
    short: "Home",
    colorVar: "var(--cat-household)",
    emoji: "🏠",
  },
  { value: "custom", label: "Custom", short: "Custom", colorVar: "var(--cat-custom)", emoji: "✨" },
  {
    value: "appointment",
    label: "Appointments",
    short: "Appt",
    colorVar: "var(--cat-appointment)",
    emoji: "📅",
  },
  {
    value: "meeting",
    label: "Meetings",
    short: "Meeting",
    colorVar: "var(--cat-meeting)",
    emoji: "🤝",
  },
];

export function categoryMeta(value: ReminderCategory) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES.find((c) => c.value === "custom")!;
}

/** Categories a user can actually pick (retired ones stay out of the pickers). */
export const SELECTABLE_CATEGORIES = CATEGORIES.filter((c) => !c.hidden);

/** Subscriptions now live inside "Bills, Subscriptions & Trials". */
export function normalizeCategory(value: ReminderCategory): ReminderCategory {
  return value === "subscription" ? "finance_tax" : value;
}

/**
 * Which optional fields each category actually needs. Anything not listed here
 * stays hidden so the form only asks what matters for the chosen category.
 */
export type CategoryFieldSet = {
  occasion: boolean;
  familyMember: boolean;
  location: boolean;
  participants: boolean;
  vehicle: boolean;
  institution: boolean;
  payment: boolean;
};

const NO_FIELDS: CategoryFieldSet = {
  occasion: false,
  familyMember: false,
  location: false,
  participants: false,
  vehicle: false,
  institution: false,
  payment: false,
};

export function categoryFields(value: ReminderCategory): CategoryFieldSet {
  switch (value) {
    case "personal_family":
      return { ...NO_FIELDS, occasion: true, familyMember: true };
    case "appointment":
      return { ...NO_FIELDS, location: true, participants: true };
    case "meeting":
      return { ...NO_FIELDS, location: true, participants: true };
    case "automotive":
      return { ...NO_FIELDS, vehicle: true, payment: true };
    case "academic_career":
      return { ...NO_FIELDS, institution: true };
    case "finance_tax":
    case "household":
    case "subscription":
      return { ...NO_FIELDS, payment: true };
    case "health":
      return { ...NO_FIELDS, location: true };
    default:
      return NO_FIELDS;
  }
}

export const RECURRENCES: { value: RecurrenceKind; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Every year" },
  { value: "custom", label: "Custom interval" },
];

export const ALERT_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 10080, label: "7 days before" },
  { minutes: 2880, label: "2 days before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 120, label: "2 hours before" },
  { minutes: 0, label: "At the time" },
];

export const SPECIAL_DATE_KINDS: { value: SpecialDateKind; label: string; emoji: string }[] = [
  { value: "birthday", label: "Birthday", emoji: "🎂" },
  { value: "anniversary", label: "Anniversary", emoji: "💞" },
  { value: "memorial", label: "Memorial", emoji: "🕯️" },
  { value: "exam", label: "Exam", emoji: "📚" },
  { value: "milestone", label: "Milestone", emoji: "🌟" },
  { value: "other", label: "Other", emoji: "📌" },
];

export const VENDOR_KINDS: { value: VendorKind; label: string; emoji: string }[] = [
  { value: "florist", label: "Florists", emoji: "💐" },
  { value: "bakery", label: "Cake shops", emoji: "🎂" },
  { value: "gift_shop", label: "Gift shops", emoji: "🎁" },
  { value: "other", label: "Other", emoji: "🛍️" },
];

export const ORDER_STEPS: OrderStatus[] = [
  "paid",
  "confirmed",
  "out_for_delivery",
  "delivered",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Payment received",
  confirmed: "Confirmed by shop",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Payment failed",
};

export function rupees(paise: number | null | undefined): string {
  const value = (paise ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysUntil(iso: string | Date, from: Date = new Date()): number {
  const target = startOfDay(typeof iso === "string" ? new Date(iso) : iso).getTime();
  return Math.round((target - startOfDay(from).getTime()) / 86_400_000);
}

export function relativeDay(iso: string | Date, from: Date = new Date()): string {
  const diff = daysUntil(iso, from);
  if (diff === 0) return translate("day.today");
  if (diff === 1) return translate("day.tomorrow");
  if (diff === -1) return translate("day.yesterday");
  if (diff < 0) return translate("day.daysAgo", { count: Math.abs(diff) });
  if (diff < 7) return translate("day.inDays", { count: diff });
  if (diff < 30) {
    const weeks = Math.round(diff / 7);
    return weeks <= 1 ? translate("day.inWeek") : translate("day.inWeeks", { count: weeks });
  }
  const months = Math.round(diff / 30);
  return months <= 1 ? translate("day.inMonth") : translate("day.inMonths", { count: months });
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(activeLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(activeLocale(), { day: "numeric", month: "short", year: "numeric" });
}

/** Localised label helpers — use these in UI instead of the English constants. */
export function categoryLabel(value: ReminderCategory): string {
  return translate(`cat.${value}`);
}

export function categoryShortLabel(value: ReminderCategory): string {
  return translate(`cat.short.${value}`);
}

export function recurrenceLabel(value: RecurrenceKind): string {
  return translate(`recurrence.${value}`);
}

export function alertPresetLabel(minutes: number): string {
  return translate(`alert.${minutes}`);
}

export function specialDateKindLabel(value: SpecialDateKind): string {
  return translate(`special.${value}`);
}

export function vendorKindLabel(value: VendorKind): string {
  return translate(`vendorKind.${value}`);
}

export function orderStatusLabel(value: OrderStatus): string {
  return translate(`order.${value}`);
}

export function bucketLabel(value: UrgencyBucket): string {
  return translate(`bucket.${value}`);
}


/** Next occurrence of a month/day, this year or next. */
export function nextAnniversary(eventDate: string, from: Date = new Date()): Date {
  const base = new Date(eventDate);
  const next = new Date(from.getFullYear(), base.getMonth(), base.getDate());
  if (startOfDay(next) < startOfDay(from)) next.setFullYear(next.getFullYear() + 1);
  return next;
}

export function turningAge(eventDate: string, at: Date): number | null {
  const base = new Date(eventDate);
  const age = at.getFullYear() - base.getFullYear();
  return age > 0 && age < 130 ? age : null;
}

export function nextOccurrence(reminder: Reminder, from: Date = new Date()): Date {
  const due = new Date(reminder.due_at);
  if (due >= from || reminder.recurrence === "once") return due;
  const next = new Date(due);
  const guard = 400;
  for (let i = 0; i < guard && next < from; i += 1) {
    switch (reminder.recurrence) {
      case "daily":
        next.setDate(next.getDate() + 1);
        break;
      case "weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        break;
      case "yearly":
        next.setFullYear(next.getFullYear() + 1);
        break;
      case "custom":
        next.setDate(next.getDate() + Math.max(1, reminder.recurrence_interval_days ?? 30));
        break;
      default:
        return next;
    }
  }
  return next;
}

export type UrgencyBucket = "overdue" | "today" | "week" | "later";

export function bucketFor(date: Date, from: Date = new Date()): UrgencyBucket {
  const diff = daysUntil(date, from);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

export const BUCKET_LABEL: Record<UrgencyBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
};

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Local (device timezone) calendar day as YYYY-MM-DD — never UTC. */
export function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The occurrence strictly after the given reminder's current due date. */
export function advanceOccurrence(reminder: Reminder): Date | null {
  if (reminder.recurrence === "once") return null;
  const from = new Date(Math.max(new Date(reminder.due_at).getTime() + 1000, Date.now()));
  return nextOccurrence(reminder, from);
}
