import { createServerFn } from "@tanstack/react-start";
import { recipientPincodeSchema } from "@/lib/greetings.schemas";

/**
 * Public endpoint used by the private "share your pincode" link.
 * It only writes a pincode/city onto one contact row and never returns any
 * stored details, so the unguessable contact id is the only thing needed.
 */
export const submitRecipientPincode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => recipientPincodeSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; city: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: place } = await supabaseAdmin
      .from("pincodes")
      .select("city")
      .eq("code", data.pincode)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("family_members")
      .update({ pincode: data.pincode, ...(place?.city ? { city: place.city } : {}) })
      .eq("id", data.memberId);

    if (error) return { ok: false, city: null };
    return { ok: true, city: place?.city ?? null };
  });
