import type { Database } from "@/integrations/supabase/types";

export type GreetingChannel = Database["public"]["Enums"]["greeting_channel"];
export type GreetingStatus = Database["public"]["Enums"]["greeting_status"];
export type Greeting = Database["public"]["Tables"]["greetings"]["Row"];

export const CARD_STYLES: { value: string; label: string; emoji: string; gradient: string }[] = [
  { value: "confetti", label: "Confetti", emoji: "🎉", gradient: "var(--gradient-warm)" },
  { value: "blossom", label: "Blossom", emoji: "🌸", gradient: "var(--gradient-cool)" },
  {
    value: "lamp",
    label: "Warm wishes",
    emoji: "🪔",
    gradient: "linear-gradient(135deg, oklch(0.86 0.14 88), oklch(0.7 0.17 44))",
  },
  {
    value: "stars",
    label: "Starry",
    emoji: "✨",
    gradient: "linear-gradient(135deg, oklch(0.4 0.12 277), oklch(0.63 0.115 196))",
  },
];

export const OCCASIONS: { value: string; label: string; emoji: string }[] = [
  { value: "birthday", label: "Birthday", emoji: "🎂" },
  { value: "anniversary", label: "Anniversary", emoji: "💞" },
  { value: "exam", label: "Exam / results", emoji: "📚" },
  { value: "festival", label: "Festival", emoji: "🪔" },
  { value: "milestone", label: "Milestone", emoji: "🌟" },
  { value: "thinking_of_you", label: "Just because", emoji: "💌" },
];

export const CHANNELS: { value: GreetingChannel; label: string; hint: string }[] = [
  { value: "whatsapp", label: "WhatsApp", hint: "Sent from the app to their WhatsApp number" },
  { value: "email", label: "Email", hint: "A branded greeting card in their inbox" },
  { value: "share", label: "Share myself", hint: "Copy or share the card from your own phone" },
];

/** One greeting per person, per occasion, per year. */
export function occasionKey(occasion: string, when: Date = new Date()): string {
  return `${occasion}-${when.getFullYear()}`;
}

export function defaultMessage(params: {
  name: string;
  occasion: string;
  senderName?: string | null | undefined;
  turning?: number | null;
  likes?: string[];
}): string {
  const first = params.name.split(" ")[0] ?? params.name;
  const from = params.senderName ? `\n\n— ${params.senderName}` : "";
  switch (params.occasion) {
    case "birthday":
      return `Happy birthday, ${first}! ${
        params.turning ? `${params.turning} looks wonderful on you. ` : ""
      }Wishing you a year full of good health, laughter and everything you love.${from}`;
    case "anniversary":
      return `Happy anniversary, ${first}! Here's to many more years of love, patience and shared cups of chai.${from}`;
    case "exam":
      return `All the very best, ${first}! Stay calm, trust your preparation — you've got this.${from}`;
    case "festival":
      return `Wishing you and your family light, sweets and joy this festive season, ${first}.${from}`;
    case "milestone":
      return `Congratulations, ${first}! So proud of you — enjoy every bit of this moment.${from}`;
    default:
      return `Thinking of you today, ${first}. Hope your day is as lovely as you are.${from}`;
  }
}

export function greetingShareUrl(params: {
  origin: string;
  name: string;
  message: string;
  style: string;
  occasion: string;
}): string {
  const q = new URLSearchParams({
    to: params.name,
    m: params.message,
    s: params.style,
    o: params.occasion,
  });
  return `${params.origin}/greeting?${q.toString()}`;
}

export function whatsappDeepLink(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export const PINCODE_RE = /^[1-9][0-9]{5}$/;

export function isValidPincode(value: string): boolean {
  return PINCODE_RE.test(value.trim());
}
