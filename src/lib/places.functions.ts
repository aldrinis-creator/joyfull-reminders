import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addressResolveSchema,
  addressSearchSchema,
  type AddressSuggestion,
  type ResolvedAddress,
} from "@/lib/places.schemas";

/** Simple in-worker throttle so one signed-in user cannot burn through the quota. */
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

function allow(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return false;
  }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}

type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      text?: { text?: string };
    };
  }[];
};

type DetailsResponse = {
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
};

export const searchAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addressSearchSchema.parse(data))
  .handler(
    async ({ data, context }): Promise<{ suggestions: AddressSuggestion[]; unavailable?: boolean }> => {
    const key = process.env["GOOGLE_PLACES_SERVER_KEY"] ?? process.env["GOOGLE_API_KEY"];
    if (!key) return { suggestions: [], unavailable: true };
    if (!allow(context.userId)) return { suggestions: [] };

    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({
          input: data.query,
          regionCode: "IN",
          includedRegionCodes: ["in"],
          sessionToken: data.sessionToken,
        }),
      });
      if (!res.ok) {
        console.error("[places] autocomplete failed", res.status, (await res.text()).slice(0, 300));
        return { suggestions: [], unavailable: true };
      }
      const json = (await res.json()) as AutocompleteResponse;
      const suggestions = (json.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
        .slice(0, 6)
        .map((p) => ({
          placeId: p.placeId!,
          primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          secondary: p.structuredFormat?.secondaryText?.text ?? "",
        }));
      return { suggestions };
    } catch (err) {
      console.error("[places] autocomplete error", err);
      return { suggestions: [], unavailable: true };
    }
  },
  );

export const resolveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addressResolveSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ address: ResolvedAddress | null }> => {
    const key = process.env["GOOGLE_PLACES_SERVER_KEY"] ?? process.env["GOOGLE_API_KEY"];
    if (!key) return { address: null };
    if (!allow(context.userId)) return { address: null };

    try {
      const url = new URL(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(data.placeId)}`,
      );
      url.searchParams.set("sessionToken", data.sessionToken);
      const res = await fetch(url, {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "formattedAddress,addressComponents,location",
        },
      });
      if (!res.ok) {
        console.error("[places] details failed", res.status, (await res.text()).slice(0, 300));
        return { address: null };
      }
      const json = (await res.json()) as DetailsResponse;
      const parts = json.addressComponents ?? [];
      const pick = (...types: string[]) =>
        parts.find((c) => (c.types ?? []).some((t) => types.includes(t)))?.longText ?? "";

      const pincode = pick("postal_code");
      const city = pick("locality", "postal_town", "administrative_area_level_3");
      const state = pick("administrative_area_level_1");

      let line = json.formattedAddress ?? "";
      // Strip the trailing "City, State PIN, India" tail so the street line stays clean.
      line = line
        .replace(/,\s*India$/i, "")
        .replace(new RegExp(`,?\\s*${state}\\s*${pincode}$`, "i"), "")
        .replace(new RegExp(`,?\\s*${city}$`, "i"), "")
        .trim()
        .replace(/,$/, "");

      return {
        address: {
          line: line || (json.formattedAddress ?? ""),
          city,
          state,
          pincode,
          lat: json.location?.latitude ?? null,
          lng: json.location?.longitude ?? null,
        },
      };
    } catch (err) {
      console.error("[places] details error", err);
      return { address: null };
    }
  });
