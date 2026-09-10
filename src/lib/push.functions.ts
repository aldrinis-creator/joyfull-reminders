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
    const { error } = await context.supabase.from("push_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: data.platform ?? null,
        user_agent: data.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error("Could not save this device");
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
