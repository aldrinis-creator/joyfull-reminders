import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, Languages, LogOut, MapPin, Monitor, Moon, Store, Sun } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { CalendarSyncCard } from "@/components/CalendarSyncCard";

import { PhoneVerifyDialog } from "@/components/PhoneVerifyDialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { LANGUAGES } from "@/lib/i18n";
import { useOrders, useProfile, useStreak } from "@/lib/queries";
import { formatDate, orderStatusLabel, rupees } from "@/lib/ereminder";

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
  pincode: z.union([z.literal(""), z.string().regex(/^[1-9]\d{5}$/, "family.errPincode")]),
});


function ProfilePage() {
  const { data: profile } = useProfile();
  const { data: orders } = useOrders();
  const { data: streak } = useStreak();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [push, setPush] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setCity(profile.city ?? "");
    setAddress(profile.address ?? "");
    setPincode(profile.pincode ?? "");
    setPush(profile.push_enabled);
  }, [profile]);

  const save = async (extra: Record<string, unknown> = {}) => {
    const parsed = profileSchema.safeParse({
      full_name: fullName,
      phone,
      city,
      address,
      pincode,
    });
    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0]?.message ?? "profile.errDetails"));
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
      pincode: parsed.data.pincode || null,

      push_enabled: push,
      onboarded: true,
      ...extra,
    });
    setSaving(false);
    if (error) {
      toast.error(t("profile.errSave"));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success(t("saved"));
  };

  return (
    <AppShell title={t("nav.profile")} subtitle={t("profile.subtitle")}>
      <div className="space-y-4 pb-8">
        {streak ? (
          <div className="bg-card shadow-card flex items-center gap-4 rounded-3xl px-5 py-4">
            <Flame className="text-primary size-8" aria-hidden />
            <div>
              <p className="text-lg font-bold">{t("profile.streak", { count: streak.current_streak })}</p>
              <p className="text-muted-foreground text-sm">
                {t("profile.longest", { count: streak.longest_streak })}
              </p>
            </div>
          </div>
        ) : null}

        <section className="bg-card shadow-card space-y-4 rounded-3xl p-5">
          <h2 className="text-xl">{t("profile.yourDetails")}</h2>
          <div className="space-y-2">
            <Label htmlFor="p-name">{t("profile.name")}</Label>
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
              <Label htmlFor="p-phone">{t("profile.phone")}</Label>
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
              <p className="text-muted-foreground text-xs">{t("profile.verifiedNumber")}</p>
            ) : (
              <p className="text-muted-foreground text-xs">{t("profile.verifyHint")}</p>
            )}
          </div>
          <AddressAutocomplete
            id="p-address"
            label={t("profile.defaultAddress")}
            value={address}
            onChange={setAddress}
            onResolved={(a) => {
              if (a.city) setCity(a.city);
              if (a.pincode) setPincode(a.pincode);
            }}
            placeholder={t("profile.addressPlaceholder")}
            hint={t("profile.addressHint")}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="p-city">{t("family.city")}</Label>
              <Input
                id="p-city"
                value={city}
                maxLength={80}
                onChange={(e) => setCity(e.target.value)}
                className="h-12 w-full min-w-0"
                placeholder={t("family.cityPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-pin">{t("family.pincode")}</Label>
              <Input
                id="p-pin"
                value={pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                className="h-12 w-full min-w-0"
                placeholder="400069"
              />
            </div>
          </div>

          <Button
            variant="outline"
            className="h-12 w-full"
            onClick={() => {
              if (!navigator.geolocation) {
                toast.error(t("profile.errNoGeo"));
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (pos) =>
                  void save({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  }).then(() => toast.success(t("profile.locationSaved"))),
                () => toast.error(t("profile.errGeo")),
              );
            }}
          >
            <MapPin className="size-5" aria-hidden /> {t("profile.useLocation")}
          </Button>
          <div className="space-y-3 border-t pt-4">
            <div>
              <p className="font-semibold">{t("profile.appearance")}</p>
              <p className="text-muted-foreground text-sm">{t("profile.appearanceHint")}</p>
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("profile.appearance")}>
              {(
                [
                  { value: "light", label: t("profile.light"), Icon: Sun },
                  { value: "dark", label: t("profile.dark"), Icon: Moon },
                  { value: "system", label: t("profile.system"), Icon: Monitor },
                ] as const
              ).map(({ value, label, Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant={theme === value ? "default" : "outline"}
                  className="h-12"
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                >
                  <Icon className="size-4" aria-hidden /> {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-3 border-t pt-4">
            <div>
              <p className="font-semibold">{t("profile.language")}</p>
              <p className="text-muted-foreground text-sm">{t("profile.languageHint")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("profile.language")}>
              {LANGUAGES.map((l) => (
                <Button
                  key={l.code}
                  type="button"
                  variant={language === l.code ? "default" : "outline"}
                  className="h-12"
                  aria-pressed={language === l.code}
                  onClick={() => setLanguage(l.code)}
                >
                  <Languages className="size-4" aria-hidden /> {l.nativeLabel}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <p className="font-semibold">{t("profile.push")}</p>
              <p className="text-muted-foreground text-sm">{t("profile.pushHint")}</p>
            </div>
            <Switch checked={push} onCheckedChange={setPush} />
          </div>
          <Button
            size="lg"
            className="h-13 w-full text-base"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? t("saving") : t("profile.saveChanges")}
          </Button>
        </section>

        <CalendarSyncCard />

        <section className="bg-card shadow-card rounded-3xl p-5">

          <h2 className="text-xl">{t("profile.orders")}</h2>
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
                      {o.vendor_products?.name ?? t("market.gift")} · {o.vendors?.name}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {o.delivery_date ? formatDate(o.delivery_date) : "—"} ·{" "}
                      {orderStatusLabel(o.status)}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold">{rupees(o.amount_paise)}</span>
                </Link>
              </li>
            ))}
            {(orders?.length ?? 0) === 0 ? (
              <li className="text-muted-foreground text-sm">{t("profile.noOrders")}</li>
            ) : null}
          </ul>
        </section>

        <Button asChild variant="outline" size="lg" className="h-13 w-full text-base">
          <Link to="/vendor">
            <Store className="size-5" aria-hidden /> {t("profile.runShop")}
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
          <LogOut className="size-5" aria-hidden /> {t("profile.signOut")}
        </Button>
      </div>
    </AppShell>
  );
}
