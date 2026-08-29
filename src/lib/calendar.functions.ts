import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the signed-in user's private calendar subscription token, creating
 * one lazily on first use. `rotate: true` issues a fresh token, which
 * immediately invalidates any previously shared feed URL.
 */
export const getCalendarToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown): { rotate: boolean } => {
    const rotate =
      typeof data === "object" && data !== null && (data as { rotate?: unknown }).rotate === true;
    return { rotate };
  })
  .handler(async ({ data, context }): Promise<{ token: string }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.rotate) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("calendar_token")
        .eq("id", userId)
        .maybeSingle();
      if (existing?.calendar_token) return { token: existing.calendar_token };
    }

    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ calendar_token: token })
      .eq("id", userId);
    if (error) throw new Error("Could not create your calendar link.");

    return { token };
  });
