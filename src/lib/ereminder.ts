import type { Database } from "@/integrations/supabase/types";

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
    label: "Finance & Tax",
    short: "Finance",
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
];

export function categoryMeta(value: ReminderCategory) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1]!;
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
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  if (diff < 7) return `In ${diff} days`;
  if (diff < 30) return `In ${Math.round(diff / 7)} week${diff >= 14 ? "s" : ""}`;
  return `In ${Math.round(diff / 30)} month${diff >= 60 ? "s" : ""}`;
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
