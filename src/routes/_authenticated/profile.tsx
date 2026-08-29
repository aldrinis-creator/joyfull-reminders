import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, LogOut, MapPin, Store } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { PhoneVerifyDialog } from "@/components/PhoneVerifyDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useOrders, useProfile, useStreak } from "@/lib/queries";
import { ORDER_STATUS_LABEL, formatDate, rupees } from "@/lib/ereminder";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile & settings — e-Reminder" },
      {
        name: "description",
        content:
          "Manage your name, saved location, alarm sound, notification preferences and past gift orders.",
      },
      { property: "og:title", content: "Profile & settings — e-Reminder" },
      { property: "og:description", content: "Your account, alerts and payment history." },
    ],
  }),
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().trim().max(100),
  phone: z.string().trim().max(20),
  city: z.string().trim().max(80),
  address: z.string().trim().max(300),
});

function ProfilePage() {
  const { data: profile } = useProfile();
  const { data: orders } = useOrders();
  const { data: streak } = useStreak();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [push, setPush] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setCity(profile.city ?? "");
    setAddress(profile.address ?? "");
    setPush(profile.push_enabled);
  }, [profile]);

  const save = async (extra: Record<string, unknown> = {}) => {
    const parsed = profileSchema.safeParse({ full_name: fullName, phone, city, address });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: parsed.data.full_name || null,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      address: parsed.data.address || null,
      push_enabled: push,
      onboarded: true,
      ...extra,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save your profile.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Saved");
  };

  return (
    <AppShell title="Profile" subtitle="Your account and preferences">
      <div className="space-y-4 pb-8">
        {streak ? (
          <div className="bg-card shadow-card flex items-center gap-4 rounded-3xl px-5 py-4">
            <Flame className="text-primary size-8" aria-hidden />
            <div>
              <p className="text-lg font-bold">{streak.current_streak}-day streak</p>
              <p className="text-muted-foreground text-sm">
                Longest ever: {streak.longest_streak} days
              </p>
            </div>
          </div>
        ) : null}

        <section className="bg-card shadow-card space-y-4 rounded-3xl p-5">
          <h2 className="text-xl">Your details</h2>
          <div className="space-y-2">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={fullName}
              maxLength={100}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="p-phone">Phone</Label>
              <PhoneVerifyDialog
                phone={phone}
                verified={Boolean(profile?.phone_verified_at) && phone === (profile?.phone ?? "")}
                onVerified={() => {
                  void queryClient.invalidateQueries({ queryKey: ["profile"] });
                }}
              />
            </div>
            <Input
              id="p-phone"
              value={phone}
              maxLength={20}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12"
              placeholder="+919876543210"
            />
            {profile?.phone_verified_at && phone === (profile.phone ?? "") ? (
              <p className="text-muted-foreground text-xs">Verified number.</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Save your number, then verify it by SMS or WhatsApp.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-city">City</Label>
            <Input
              id="p-city"
              value={city}
              maxLength={80}
              onChange={(e) => setCity(e.target.value)}
              className="h-12"
              placeholder="Mumbai"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-address">Default delivery address</Label>
            <Input
              id="p-address"
              value={address}
              maxLength={300}
              onChange={(e) => setAddress(e.target.value)}
              className="h-12"
            />
          </div>
          <Button
            variant="outline"
            className="h-12 w-full"
            onClick={() => {
              if (!navigator.geolocation) {
                toast.error("Location isn't available on this device.");
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (pos) =>
                  void save({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  }).then(() => toast.success("Location saved — nearby shops will show first")),
                () => toast.error("We couldn't get your location."),
              );
            }}
          >
            <MapPin className="size-5" aria-hidden /> Use my current location
          </Button>
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <p className="font-semibold">Push notifications</p>
              <p className="text-muted-foreground text-sm">Alerts before each reminder is due.</p>
            </div>
            <Switch checked={push} onCheckedChange={setPush} />
          </div>
          <Button
            size="lg"
            className="h-13 w-full text-base"
            disabled={saving}
            onClick={() => void save()}
          >
            Save changes
          </Button>
        </section>

        <section className="bg-card shadow-card rounded-3xl p-5">
          <h2 className="text-xl">Orders & payments</h2>
          <ul className="mt-3 space-y-2">
            {(orders ?? []).map((o) => (
              <li key={o.id}>
                <Link
                  to="/orders/$orderId"
                  params={{ orderId: o.id }}
                  className="bg-muted flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {o.vendor_products?.name ?? "Gift"} · {o.vendors?.name}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {o.delivery_date ? formatDate(o.delivery_date) : "—"} ·{" "}
                      {ORDER_STATUS_LABEL[o.status]}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold">{rupees(o.amount_paise)}</span>
                </Link>
              </li>
            ))}
            {(orders?.length ?? 0) === 0 ? (
              <li className="text-muted-foreground text-sm">No orders yet.</li>
            ) : null}
          </ul>
        </section>

        <Button asChild variant="outline" size="lg" className="h-13 w-full text-base">
          <Link to="/vendor">
            <Store className="size-5" aria-hidden /> I run a shop — list it here
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className="text-destructive h-13 w-full text-base"
          onClick={async () => {
            await supabase.auth.signOut();
            queryClient.clear();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="size-5" aria-hidden /> Sign out
        </Button>
      </div>
    </AppShell>
  );
}
