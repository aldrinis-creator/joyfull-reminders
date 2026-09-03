/**
 * Payment shortcut helpers.
 *
 * This is a pure hand-off: we never process money. We either open the biller's
 * own page or build a standard UPI deep link so the user's installed UPI app
 * opens with the details pre-filled.
 */
import type { Reminder } from "@/lib/ereminder";

export type PaymentShortcut = Pick<
  Reminder,
  "payment_url" | "upi_id" | "upi_payee_name" | "payment_amount"
> & { title?: string | null; recurrence?: Reminder["recurrence"] | null };

/**
 * Recurring bills (monthly electricity, yearly insurance) change every cycle,
 * so we never carry a saved amount into the payment app for them.
 */
export function amountIsVariable(shortcut: PaymentShortcut): boolean {
  return Boolean(shortcut.recurrence) && shortcut.recurrence !== "once";
}

/** Only http(s) links are ever opened. */
export function safePaymentUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isValidUpiId(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /^[a-z0-9.\-_]{2,64}@[a-z][a-z0-9.\-_]{1,64}$/i.test(raw.trim());
}

function upiQuery(shortcut: PaymentShortcut): string | null {
  const pa = shortcut.upi_id?.trim();
  if (!pa) return null;
  const params = new URLSearchParams({ pa });
  const pn = shortcut.upi_payee_name?.trim() || shortcut.title?.trim();
  if (pn) params.set("pn", pn);
  const amount = amountIsVariable(shortcut) ? null : shortcut.payment_amount;
  if (amount !== null && amount !== undefined && Number(amount) > 0) {
    params.set("am", Number(amount).toFixed(2));
  }
  params.set("cu", "INR");
  const tn = shortcut.title?.trim();
  if (tn) params.set("tn", tn.slice(0, 50));
  return params.toString().replace(/\+/g, "%20");
}

/** upi://pay?pa=…&pn=…&am=…&cu=INR&tn=… */
export function buildUpiLink(shortcut: PaymentShortcut): string | null {
  const query = upiQuery(shortcut);
  return query ? `upi://pay?${query}` : null;
}

/** Google Pay's own UPI deep link — same parameters, GPay-specific scheme. */
export function buildGpayLink(shortcut: PaymentShortcut): string | null {
  const query = upiQuery(shortcut);
  return query ? `tez://upi/pay?${query}` : null;
}


/** The link the "Pay now" button should open, link first then UPI. */
export function paymentTarget(
  shortcut: PaymentShortcut,
): { kind: "link"; href: string } | { kind: "upi"; href: string } | null {
  const link = safePaymentUrl(shortcut.payment_url);
  if (link) return { kind: "link", href: link };
  const upi = buildUpiLink(shortcut);
  if (upi) return { kind: "upi", href: upi };
  return null;
}

export function hasPaymentShortcut(shortcut: PaymentShortcut): boolean {
  return paymentTarget(shortcut) !== null;
}
