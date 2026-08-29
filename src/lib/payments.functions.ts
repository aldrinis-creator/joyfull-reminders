import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ orderId: z.string().uuid() });

export type CheckoutSession =
  | { configured: false; reason: string }
  | {
      configured: true;
      keyId: string;
      providerOrderId: string;
      amountPaise: number;
      currency: "INR";
      description: string;
      customerName: string | null;
      customerEmail: string | null;
    };

/**
 * Creates (or reuses) a Razorpay order for one of the caller's own orders and
 * returns everything the hosted checkout page needs. The order is only marked
 * paid by the verified webhook — never by the browser.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<CheckoutSession> => {
    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];

    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, amount_paise, quantity, product_id, status, recipient_name, vendor_id, vendor_products(name, price_paise), vendors(name)",
      )
      .eq("id", data.orderId)
      .maybeSingle();

    if (error || !order) throw new Error("Order not found");
    if (order.status !== "pending_payment") throw new Error("This order is already paid");

    // Never trust a stored amount that disagrees with the vendor's listed price.
    const listedPaise = order.vendor_products?.price_paise;
    const authoritativePaise =
      typeof listedPaise === "number" ? listedPaise * (order.quantity ?? 1) : order.amount_paise;
    if (authoritativePaise !== order.amount_paise) {
      console.error("Order amount mismatch", order.id);
      throw new Error("This order needs to be re-created before payment.");
    }

    if (!keyId || !keySecret) {
      return {
        configured: false,
        reason: "Razorpay keys are not configured yet.",
      };
    }

    const description = `${order.vendor_products?.name ?? "Gift"} from ${order.vendors?.name ?? "shop"}`;

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      },
      body: JSON.stringify({
        amount: order.amount_paise,
        currency: "INR",
        receipt: order.id,
        notes: { order_id: order.id, user_id: userId },
      }),
    });

    if (!response.ok) {
      console.error("Razorpay order creation failed", response.status, await response.text());
      throw new Error("Payment provider is unavailable right now.");
    }

    const rzOrder = (await response.json()) as { id: string };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      user_id: userId,
      provider: "razorpay",
      provider_order_id: rzOrder.id,
      amount_paise: order.amount_paise,
      status: "created",
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    return {
      configured: true,
      keyId,
      providerOrderId: rzOrder.id,
      amountPaise: order.amount_paise,
      currency: "INR",
      description,
      customerName: profile?.full_name ?? null,
      customerEmail: (context.claims["email"] as string | undefined) ?? null,
    };
  });
