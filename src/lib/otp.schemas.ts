import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Use international format, e.g. +919876543210");

export const otpChannelSchema = z.enum(["sms", "whatsapp"]);

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  channel: otpChannelSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "Enter the code we sent you"),
});

export type OtpChannel = z.infer<typeof otpChannelSchema>;
