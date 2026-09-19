import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.string().max(40).optional(),
  userAgent: z.string().max(300).optional(),
});

/** Save (or refresh) this device's notification address for the signed-in user. */
export const registerPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data, context }) => {
    const nowIso = new Date().toISOString();

    // One row per physical device: a re-registration replaces this device's
    // previous token instead of piling up dead ones that still pass FCM.
    if (data.userAgent) {
      await context.supabase
        .from("push_tokens")
        .delete()
        .eq("user_id", context.userId)
        .eq("user_agent", data.userAgent)
        .neq("token", data.token);
    }

    const { error } = await context.supabase.from("push_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: data.platform ?? null,
        user_agent: data.userAgent ?? null,
        last_seen_at: nowIso,
      },
      { onConflict: "token" },
    );
    if (error) throw new Error("Could not save this device");

    // Forget devices that haven't checked in for a month.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    await context.supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", context.userId)
      .lt("last_seen_at", cutoff);

    return { ok: true as const };
  });


/** Forget this device so it stops receiving notifications. */
export const removePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", context.userId)
      .eq("token", data.token);
    return { ok: true as const };
  });
