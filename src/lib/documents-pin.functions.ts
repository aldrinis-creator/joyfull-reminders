import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { phoneSchema } from "@/lib/otp.schemas";

const pinSchema = z.object({ pin: z.string().trim().regex(/^\d{4,6}$/, "PIN must be 4-6 digits") });

const resetSchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{4,8}$/, "Enter the code we sent you"),
  pin: z.string().trim().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

export type PinResult = { ok: true } | { ok: false; detail: string };

/** Whether the signed-in user has set a Document Shelf PIN yet. */
export const hasDocumentsPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ hasPin: boolean }> => {
    const { data } = await context.supabase
      .from("profiles")
      .select("documents_pin_hash")
      .eq("id", context.userId)
      .maybeSingle();
    return { hasPin: Boolean(data?.documents_pin_hash) };
  });

/** Stores a new PIN as a one-way hash, replacing any existing one. */
export const setDocumentsPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pinSchema.parse(input))
  .handler(async ({ data, context }): Promise<PinResult> => {
    const { hashPin } = await import("@/lib/documents-pin.server");
    let hash: string;
    try {
      hash = await hashPin(data.pin);
    } catch (err) {
      console.error("[documents-pin] hashPin failed", err);
      return { ok: false, detail: "We could not secure your PIN on this device. Please try again." };
    }
    const { error } = await context.supabase
      .from("profiles")
      .update({ documents_pin_hash: hash })
      .eq("id", context.userId);
    if (error) {
      console.error("[documents-pin] saving PIN failed", error);
      return { ok: false, detail: "We could not save your PIN. Please try again." };
    }
    return { ok: true };
  });

/** Checks a PIN against the stored hash. Returns only pass/fail. */
export const verifyDocumentsPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pinSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { verifyPinHash } = await import("@/lib/documents-pin.server");
    const { data: row } = await context.supabase
      .from("profiles")
      .select("documents_pin_hash")
      .eq("id", context.userId)
      .maybeSingle();
    const stored = row?.documents_pin_hash;
    if (!stored) return { ok: false };
    try {
      return { ok: await verifyPinHash(data.pin, stored) };
    } catch (err) {
      console.error("[documents-pin] verifyPinHash failed", err);
      return { ok: false };
    }
  });

/** Recovery path: a valid one-time code on the user's own number lets them set a new PIN. */
export const resetDocumentsPinWithOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data, context }): Promise<PinResult> => {
    const { consumeOtp } = await import("@/lib/otp.server");
    const check = await consumeOtp(data.phone, data.code, "verify");
    if (!check.ok) return { ok: false, detail: check.detail };

    const { hashPin } = await import("@/lib/documents-pin.server");
    const hash = await hashPin(data.pin);
    const { error } = await context.supabase
      .from("profiles")
      .update({ documents_pin_hash: hash })
      .eq("id", context.userId);
    if (error) return { ok: false, detail: "We could not save your PIN. Please try again." };
    return { ok: true };
  });
