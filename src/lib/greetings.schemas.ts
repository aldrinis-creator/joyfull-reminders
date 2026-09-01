import { z } from "zod";

export const sendGreetingSchema = z.object({
  familyMemberId: z.string().uuid(),
  reminderId: z.string().uuid().nullable().optional(),
  occasion: z.string().trim().min(1).max(40),
  occasionKey: z.string().trim().min(1).max(60),
  channel: z.enum(["whatsapp", "email", "share"]),
  cardStyle: z.string().trim().min(1).max(30),
  message: z.string().trim().min(1).max(1200),
  /** ISO timestamp; when present the greeting is queued instead of sent now. */
  scheduledFor: z.string().datetime().nullable().optional(),
});

export const updateScheduledGreetingSchema = z.object({
  greetingId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
  message: z.string().trim().min(1).max(1200),
  cardStyle: z.string().trim().min(1).max(30).optional(),
});

export const cancelScheduledGreetingSchema = z.object({
  greetingId: z.string().uuid(),
});


export const recipientPincodeSchema = z.object({
  memberId: z.string().uuid(),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
});
