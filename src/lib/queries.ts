import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FamilyMember, Order, Reminder, SpecialDate, Vendor, VendorProduct } from "./ereminder";

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .order("due_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Reminder[];
    },
  });
}

export function useFamilyMembers() {
  return useQuery({
    queryKey: ["family_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FamilyMember[];
    },
  });
}

export function useSpecialDates() {
  return useQuery({
    queryKey: ["special_dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("special_dates")
        .select("*")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecialDate[];
    },
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("is_active", true)
        .order("rating", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Vendor[];
    },
  });
}

export function useVendor(vendorId: string) {
  return useQuery({
    queryKey: ["vendor", vendorId],
    queryFn: async () => {
      const [{ data: vendor, error: vErr }, { data: products, error: pErr }] = await Promise.all([
        supabase.from("vendors").select("*").eq("id", vendorId).maybeSingle(),
        supabase
          .from("vendor_products")
          .select("*")
          .eq("vendor_id", vendorId)
          .eq("is_active", true)
          .order("price_paise", { ascending: true }),
      ]);
      if (vErr) throw vErr;
      if (pErr) throw pErr;
      return {
        vendor: vendor as Vendor | null,
        products: (products ?? []) as VendorProduct[],
      };
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, vendors(name, kind), vendor_products(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Order & {
        vendors: { name: string; kind: string } | null;
        vendor_products: { name: string } | null;
      })[];
    },
  });
}

export function useStreak() {
  return useQuery({
    queryKey: ["streak"],
    queryFn: async () => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("user_streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
