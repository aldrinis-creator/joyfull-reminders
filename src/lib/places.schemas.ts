import { z } from "zod";

export const addressSearchSchema = z.object({
  query: z.string().trim().min(3).max(120),
  sessionToken: z.string().trim().min(8).max(64),
});

export const addressResolveSchema = z.object({
  placeId: z.string().trim().min(3).max(300),
  sessionToken: z.string().trim().min(8).max(64),
});

export type AddressSuggestion = {
  placeId: string;
  primary: string;
  secondary: string;
};

export type ResolvedAddress = {
  line: string;
  city: string;
  state: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
};

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode");
