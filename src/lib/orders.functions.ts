import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createOrderSchema } from "@/lib/orders.schemas";

/**
 * Creates a gift order. The price is ALWAYS read server-side from the vendor's
 * catalogue — any amount supplied by the browser is ignored.
 */
export const createGiftOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createOrderSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ orderId: string }> => {
    const { supabase, userId } = context;

    const { data: product, error: productError } = await supabase
      .from("vendor_products")
      .select("id, vendor_id, price_paise, is_active")
      .eq("id", data.productId)
      .maybeSingle();

    if (productError || !product) throw new Error("That gift is no longer available.");
    if (product.vendor_id !== data.vendorId) throw new Error("That gift is no longer available.");
    if (product.is_active === false) throw new Error("That gift is no longer available.");

    if (data.familyMemberId) {
      const { data: member } = await supabase
        .from("family_members")
        .select("id")
        .eq("id", data.familyMemberId)
        .maybeSingle();
      if (!member) throw new Error("Recipient not found.");
    }

    const quantity = data.quantity ?? 1;
    const amountPaise = product.price_paise * quantity;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        vendor_id: product.vendor_id,
        product_id: product.id,
        family_member_id: data.familyMemberId ?? null,
        reminder_id: data.reminderId ?? null,
        quantity,
        amount_paise: amountPaise,
        recipient_name: data.recipientName,
        delivery_address: data.deliveryAddress,
        delivery_date: data.deliveryDate,
        gift_message: data.giftMessage ?? null,
      })
      .select("id")
      .single();

    if (error || !order) throw new Error("Could not create that order.");
    return { orderId: order.id };
  });
