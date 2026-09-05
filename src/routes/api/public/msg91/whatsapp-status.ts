import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const statusSchema = z
  .object({
    request_id: z.string().optional(),
    requestId: z.string().optional(),
    message_id: z.string().optional(),
    messageId: z.string().optional(),
    status: z.string().optional(),
    event: z.string().optional(),
    reason: z.union([z.string(), z.record(z.unknown())]).optional(),
    error: z.union([z.string(), z.record(z.unknown())]).optional(),
  })
  .passthrough();

function secureEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export const Route = createFileRoute("/api/public/msg91/whatsapp-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["MSG91_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const body = await request.text();

        // Two accepted proofs, because the provider console can only add a
        // static header or URL token — HMAC is used when it is available.
        const signature = (request.headers.get("x-msg91-signature") ?? "").replace(/^sha256=/, "");
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const token =
          request.headers.get("x-msg91-secret") ??
          new URL(request.url).searchParams.get("token") ??
          "";
        const authorised =
          (signature.length > 0 && secureEqual(signature, expected)) ||
          (token.length > 0 && secureEqual(token, secret));
        if (!authorised) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: z.infer<typeof statusSchema>;
        try {
          parsed = statusSchema.parse(JSON.parse(body));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const providerMessageId =
          parsed.request_id ?? parsed.requestId ?? parsed.message_id ?? parsed.messageId;
        if (!providerMessageId) return new Response("ok");

        const rawStatus = (parsed.status ?? parsed.event ?? "").toLowerCase();
        const providerStatus =
          rawStatus === "sent" ||
          rawStatus === "delivered" ||
          rawStatus === "read" ||
          rawStatus === "failed" ||
          rawStatus === "rejected"
            ? rawStatus
            : null;
        if (!providerStatus) return new Response("ok");

        const detail = parsed.reason ?? parsed.error;
        const providerError = detail
          ? (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 500)
          : null;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const patch = { provider_status: providerStatus, provider_error: providerError };
        // The same report shape covers sign-in codes and greetings; only one
        // of these tables will hold a row for this provider message id.
        await Promise.all([
          supabaseAdmin
            .from("phone_otp_challenges")
            .update(patch)
            .eq("provider_message_id", providerMessageId),
          supabaseAdmin
            .from("greetings")
            .update(patch)
            .eq("provider_message_id", providerMessageId),
        ]);


        return new Response("ok");
      },
    },
  },
});