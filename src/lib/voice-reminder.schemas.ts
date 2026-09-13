import { z } from "zod";

export const REMINDER_CATEGORY_VALUES = [
  "personal_family",
  "finance_tax",
  "automotive",
  "academic_career",
  "subscription",
  "health",
  "household",
  "custom",
  "appointment",
  "meeting",
] as const;

export const RECURRENCE_VALUES = [
  "once",
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;

export const parseVoiceReminderInput = z.object({
  transcript: z.string().trim().min(2).max(1000),
  /** Caller's local "now" as YYYY-MM-DDTHH:mm so relative phrases resolve. */
  localNow: z.string().trim().min(10).max(40),
  language: z.enum(["en", "hi"]).default("en"),
});

export type ParseVoiceReminderInput = z.infer<typeof parseVoiceReminderInput>;

/** Everything is optional — we only fill what the model is confident about. */
export const parsedReminderSchema = z.object({
  title: z.string().trim().min(1).max(120).nullish(),
  category: z.enum(REMINDER_CATEGORY_VALUES).nullish(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullish(),
  recurrence: z.enum(RECURRENCE_VALUES).nullish(),
  description: z.string().trim().max(1000).nullish(),
  location: z.string().trim().max(200).nullish(),
  participants: z.string().trim().max(200).nullish(),
  vehicleNumber: z.string().trim().max(40).nullish(),
  institution: z.string().trim().max(120).nullish(),
  /** Only when clearly printed on a scanned document. */
  paymentAmount: z.coerce.number().positive().max(10_000_000).nullish(),
  upiPayeeName: z.string().trim().max(120).nullish(),
});

export const scanImageSchema = z.object({
  /** Raw base64 (no data: prefix). */
  imageBase64: z.string().min(100),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const parseDocumentScanInput = z.object({
  /** One entry per photographed page / side, up to 10. */
  images: z.array(scanImageSchema).min(1).max(10),
  localNow: z.string().trim().min(10).max(40),
  language: z.enum(["en", "hi"]).default("en"),
});

export type ParseDocumentScanInput = z.infer<typeof parseDocumentScanInput>;

export type ParsedReminder = z.infer<typeof parsedReminderSchema>;
