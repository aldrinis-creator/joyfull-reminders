import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay server-to-server webhook.
 * Verifies the HMAC SHA256 signature over the raw body before touching the DB.
 * This is the ONLY place an order becomes "paid".
 */
export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const body = await request.text();

        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          event?: string;
          payload?: {
            payment?: { entity?: { id?: string; order_id?: string } };
            order?: { entity?: { id?: string } };
          };
        };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const event = payload.event ?? "";
        if (event !== "order.paid" && event !== "payment.captured") {
          return new Response("ignored");
        }

        const providerOrderId =
          payload.payload?.payment?.entity?.order_id ?? payload.payload?.order?.entity?.id;
        const providerPaymentId = payload.payload?.payment?.entity?.id ?? null;
        if (!providerOrderId) return new Response("Missing order reference", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("id, order_id, status")
          .eq("provider_order_id", providerOrderId)
          .maybeSingle();

        if (!payment) return new Response("Unknown order", { status: 404 });
        if (payment.status === "captured") return new Response("ok");

        await supabaseAdmin
          .from("payments")
          .update({
            status: "captured",
            provider_payment_id: providerPaymentId,
            signature_verified: true,
          })
          .eq("id", payment.id);

        await supabaseAdmin.from("orders").update({ status: "paid" }).eq("id", payment.order_id);
        await supabaseAdmin.from("order_events").insert({
          order_id: payment.order_id,
          status: "paid",
          note: "Payment captured by Razorpay",
        });

        return new Response("ok");
      },
    },
  },
});
