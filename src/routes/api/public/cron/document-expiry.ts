import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Daily document-expiry sweep.
 *
 * Called by pg_cron each night with the LOVABLE_CRON_SECRET bearer token.
 * Creates the missing expiry reminder for every document that has an expiry
 * date, and nudges an existing one if the date changed. Never duplicates.
 */
export const Route = createFileRoute("/api/public/cron/document-expiry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncDocumentExpiryReminders } = await import("@/lib/document-expiry.server");

        const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

        try {
          const result = await syncDocumentExpiryReminders(supabaseAdmin, { dryRun });
          return Response.json({ ok: true, ranAt: new Date().toISOString(), ...result });
        } catch (err) {
          return Response.json(
            { error: "document_expiry_failed", detail: String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});
