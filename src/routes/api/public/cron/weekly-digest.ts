import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Weekly digest — "here's what's coming up this week".
 *
 * Called by pg_cron every Monday 02:30 UTC (08:00 IST) with the
 * LOVABLE_CRON_SECRET bearer token. `profiles.last_digest_sent_at` keeps a
 * re-run inside the same week from double-sending.
 */
export const Route = createFileRoute("/api/public/cron/weekly-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { dispatchWeeklyDigests } = await import("@/lib/weekly-digest.server");

        const url = new URL(request.url);
        const dryRun = url.searchParams.get("dryRun") === "1";
        const force = url.searchParams.get("force") === "1";
        const userId = url.searchParams.get("userId") ?? undefined;

        try {
          const result = await dispatchWeeklyDigests(supabaseAdmin, { dryRun, force, userId });
          return Response.json({ ok: true, ranAt: new Date().toISOString(), ...result });
        } catch (err) {
          return Response.json({ error: "digest_failed", detail: String(err) }, { status: 500 });
        }
      },
    },
  },
});
