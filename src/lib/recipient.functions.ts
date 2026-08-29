import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  memberId: z.string().uuid(),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
});

/**
 * Public endpoint used by the private "share your pincode" link.
 * It only writes a pincode/city onto one contact row and never returns any
 * stored details, so the unguessable contact id is the only thing needed.
 */
export const submitRecipientPincode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
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
