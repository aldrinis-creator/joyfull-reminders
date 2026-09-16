import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FamilyMember, Order, Reminder, SpecialDate, Vendor, VendorProduct } from "./ereminder";
import { sortDocuments, type DocumentRow } from "./documents";

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

/** Everyone each reminder is addressed to, keyed by reminder id. */
export function useReminderRecipients() {
  return useQuery({
    queryKey: ["reminder_recipients", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_recipients")
        .select("reminder_id, family_members(*)");
      if (error) throw error;
      const map = new Map<string, FamilyMember[]>();
      for (const row of data ?? []) {
        const member = row.family_members as FamilyMember | null;
        if (!member) continue;
        const list = map.get(row.reminder_id) ?? [];
        list.push(member);
        map.set(row.reminder_id, list);
      }
      return map;
    },
  });
}

/**
 * Greeting state for one person on one reminder.
 * Shares the `["greetings", reminderId]` cache with ReminderGreetingStatus, so
 * adding the colour hint does not add another network request.
 * Returns "scheduled", "sent" or null.
 */
export function useMemberGreetingState(reminderId: string, memberId: string) {
  return useQuery({
    queryKey: ["greetings", reminderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("greetings")
        .select("id, status, scheduled_for, sent_at, family_member_id")
        .eq("reminder_id", reminderId)
        .in("status", ["scheduled", "sent"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    select: (rows) => {
      const mine = rows.filter(
        (g) => g.family_member_id === memberId || g.family_member_id === null,
      );
      if (mine.some((g) => g.status === "scheduled" && g.scheduled_for)) return "scheduled" as const;
      if (mine.some((g) => g.status === "sent")) return "sent" as const;
      return null;
    },
  });
}

/**
 * Whether a member has ANY scheduled or sent greeting (most recent wins).
 * Used on the Family member detail page where the button is not tied to one reminder.
 */
export function useMemberAnyGreetingState(memberId: string) {
  return useQuery({
    queryKey: ["greetings_member", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("greetings")
        .select("id, status, scheduled_for, sent_at")
        .eq("family_member_id", memberId)
        .in("status", ["scheduled", "sent"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    select: (row) =>
      !row ? null : row.status === "scheduled" ? ("scheduled" as const) : ("sent" as const),
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

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*");
      if (error) throw error;
      return sortDocuments((data ?? []) as DocumentRow[]);
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
