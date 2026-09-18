import { createFileRoute } from "@tanstack/react-router";
import { verifyDismissToken } from "@/lib/dismiss-token.server";

/**
 * Called by the notification's "Dismiss" button in firebase-messaging-sw.js.
 * Public on purpose: the service worker has no session, so the signed token
 * carries (and proves) which reminder occurrence may be acknowledged.
 */
export const Route = createFileRoute("/api/public/reminders/dismiss")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let token = "";
        try {
          const body = (await request.json()) as { token?: unknown };
          token = typeof body.token === "string" ? body.token : "";
        } catch {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }
        if (!token) return Response.json({ error: "bad_request" }, { status: 400 });

        const claims = verifyDismissToken(token);
        if (!claims) return Response.json({ error: "unauthorized" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("reminder_occurrences").insert({
          user_id: claims.userId,
          reminder_id: claims.reminderId,
          occurrence_at: claims.occurrenceAt,
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
        });
        if (error) {
          console.error(`[dismiss] insert failed: ${error.message}`);
          return Response.json({ error: "insert_failed" }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
