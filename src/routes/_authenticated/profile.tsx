import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { AlarmSoundCard } from "@/components/AlarmSoundCard";
import { AppShell } from "@/components/AppShell";
import { CalendarSyncCard } from "@/components/CalendarSyncCard";
import { DocumentsPinCard } from "@/components/DocumentsPinCard";
import { PhoneField, isPhoneAcceptable, normalizePhone } from "@/components/PhoneField";
import { PhoneVerifyDialog } from "@/components/PhoneVerifyDialog";
import { PushDeviceCard } from "@/components/PushDeviceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useLanguage, useT } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { setCalendarSync } from "@/lib/calendar.functions";
import { LANGUAGES } from "@/lib/i18n";
import {
  useDocuments,
  useOrders,
  useProfile,
  useReminders,
  useSpecialDates,
  useStreak,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile & settings — My-Mitr" },
      {
        name: "description",
        content: "Manage your My-Mitr identity, notifications, calendar, documents and orders.",
      },
      { property: "og:title", content: "Profile & settings — My-Mitr" },
      { property: "og:description", content: "Your account, alerts, documents and gift history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().trim().max(100),
  phone: z.string().trim().max(20).refine((value) => isPhoneAcceptable(value), "phoneCountryError"),
  city: z.string().trim().max(80),
  address: z.string().trim().max(300),
  pincode: z.union([z.literal(""), z.string().regex(/^[1-9]\d{5}$/, "family.errPincode")]),
});

type ProfileSheet = "identity" | "alarm" | "language" | "reach" | "calendar" | "pin" | "address" | null;

function ProfilePage() {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const { data: profile } = useProfile();
  const { data: orders } = useOrders();
  const { data: streak } = useStreak();
  const { data: reminders } = useReminders();
  const { data: specialDates } = useSpecialDates();
  const { data: documents } = useDocuments();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const updateCalendar = useServerFn(setCalendarSync);

  const [openSheet, setOpenSheet] = useState<ProfileSheet>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [saving, setSaving] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [thisDevice, setThisDevice] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setCity(profile.city ?? "");
    setAddress(profile.address ?? "");
    setPincode(profile.pincode ?? "");
  }, [profile]);

  useEffect(() => {
    try {
      setThisDevice(Boolean(localStorage.getItem("ereminder.push.token")) && Notification.permission === "granted");
    } catch {
      setThisDevice(false);
    }
  }, [openSheet]);

  const verified = Boolean(profile?.phone_verified_at) && phone === (profile?.phone ?? "");
  const datesKept = (reminders?.length ?? 0) + (specialDates?.length ?? 0);
  const sentOrders = (orders ?? []).filter((order) => order.status === "delivered");
  const paidOrders = (orders ?? []).filter((order) =>
    ["paid", "confirmed", "out_for_delivery", "delivered"].includes(order.status),
  );
  const totalSpent = paidOrders.reduce((total, order) => total + order.amount_paise, 0);
  const hasPin = Boolean(profile?.documents_pin_hash);
  const calendarOn = Boolean(profile?.calendar_token);
  const alarmVolume = Number(profile?.alarm_volume ?? 1);
  const alarmSummary = t("profile.alarmValue", {
    sound: t(`profile.tone_${profile?.alarm_sound ?? "siren"}`),
    volume: t(alarmVolume >= 0.75 ? "profile.volumeLoud" : alarmVolume >= 0.4 ? "profile.volumeMedium" : "profile.volumeSoft"),
  });
  const channelSummary = useMemo(() => {
    const channels: string[] = [];
    if (thisDevice) channels.push(t("profile.reachThisPhone"));
    if (verified) channels.push(t("profile.reachWhatsapp"));
    if (profile?.email_enabled) channels.push(t("profile.reachEmail"));
    return channels.length ? channels.join(", ") : t("profile.reachNone");
  }, [profile?.email_enabled, t, thisDevice, verified]);

  const save = async (extra: { latitude?: number; longitude?: number } = {}) => {
    const parsed = profileSchema.safeParse({ full_name: fullName, phone, city, address, pincode });
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
      phone: normalizePhone(parsed.data.phone),
      city: parsed.data.city || null,
      address: parsed.data.address || null,
      pincode: parsed.data.pincode || null,
      onboarded: true,
      ...extra,
    });
    setSaving(false);
    if (error) {
      toast.error(t("profile.errSave"));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success(t("saved"));
    setOpenSheet(null);
  };

  const toggleCalendar = async (enabled: boolean) => {
    setCalendarBusy(true);
    try {
      await updateCalendar({ data: { enabled } });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (enabled) setOpenSheet("calendar");
    } catch {
      toast.error(t("profile.calendarToggleError"));
    } finally {
      setCalendarBusy(false);
    }
  };

  const personName = profile?.full_name?.trim() || t("profile.yourDetails");
  const personInitial = personName.slice(0, 1).toUpperCase();

  return (
    <AppShell title={t("profile.pageTitle")} hideHeader>
      <div className="px-[22px] pt-6 pb-10">
        <section className="flex flex-col items-center text-center">
          <button
            type="button"
            className="bg-card shadow-card flex size-[82px] items-center justify-center overflow-hidden rounded-full text-[30px] font-semibold"
            onClick={() => setOpenSheet("identity")}
            aria-label={t("profile.settingsOpen", { name: t("profile.editIdentity") })}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="washed size-full object-cover" />
            ) : (
              <span className="text-accent-800 font-display">{personInitial}</span>
            )}
          </button>
          <h1 className="mt-3 text-[25px]">{personName}</h1>
          <p className="text-foreground/60 mt-1 text-[13.5px] font-semibold">{profile?.phone ?? t("profile.notSet")}</p>
          {verified ? (
            <span className="bg-sage-100 text-sage-800 mt-2 rounded-full px-3 py-1 text-[11.5px] font-semibold">
              {t("profile.verifiedWhatsapp")}
            </span>
          ) : null}
        </section>

        <section className="mt-6 grid grid-cols-3 gap-[10px]" aria-label={t("profile.subtitle")}>
          <StatTile value={datesKept} label={t("profile.datesKept")} className="bg-terracotta-100 text-terracotta-800" />
          <StatTile value={streak?.current_streak ?? 0} label={t("profile.dayStreak")} className="bg-sage-100 text-sage-800" />
          <StatTile value={sentOrders.length} label={t("profile.giftsSent")} className="bg-card text-foreground shadow-card" />
        </section>

        <SettingsPanel title={t("profile.reachesTitle")}>
          <SettingsRow title={t("profile.alarmTitle")} value={alarmSummary} onClick={() => setOpenSheet("alarm")} />
          <SettingsRow
            title={t("profile.language")}
            value={t(language === "en" ? "profile.languageValueEnglish" : "profile.languageValueHindi")}
            onClick={() => setOpenSheet("language")}
          />
          <SettingsRow title={t("profile.reachMe")} value={channelSummary} onClick={() => setOpenSheet("reach")} />
          <SettingsRow
            title={t("profile.calendarSync")}
            value={t(calendarOn ? "profile.calendarValueOn" : "profile.calendarValueOff")}
            onClick={() => calendarOn && setOpenSheet("calendar")}
            control={
              <Switch
                checked={calendarOn}
                disabled={calendarBusy}
                onCheckedChange={(checked) => void toggleCalendar(checked)}
                className="h-[30px] w-[52px] data-[state=checked]:bg-sage-700 [&>span]:size-[26px] [&>span]:data-[state=checked]:translate-x-[22px]"
                aria-label={t("profile.calendarSync")}
              />
            }
          />
        </SettingsPanel>

        <SettingsPanel title={t("profile.thingsTitle")}>
          <SettingsRow
            title={t("profile.documentShelf")}
            value={t(hasPin ? "profile.filesPinLocked" : "profile.filesNoPin", { count: documents?.length ?? 0 })}
            onClick={() => setOpenSheet("pin")}
          />
          <SettingsRow
            title={t("profile.deliveryAddress")}
            value={profile?.address || t("profile.notSet")}
            onClick={() => setOpenSheet("address")}
          />
          <SettingsRow
            title={t("profile.pastOrders")}
            value={t("profile.orderSpend", {
              count: paidOrders.length,
              total: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(totalSpent / 100),
            })}
            to="/orders"
          />
        </SettingsPanel>

        <Button
          variant="outline"
          className="text-accent-700 mt-7 h-[52px] w-full rounded-full border-accent-700 bg-transparent text-[15.5px]"
          onClick={async () => {
            await supabase.auth.signOut();
            queryClient.clear();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="size-5" aria-hidden /> {t("profile.signOut")}
        </Button>
      </div>

      <ProfileBottomSheet open={openSheet === "identity"} onOpenChange={(open) => !open && setOpenSheet(null)} title={t("profile.detailsSheet")} description={t("profile.identityHint")}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t("profile.name")}</Label>
            <Input id="profile-name" value={fullName} maxLength={100} onChange={(event) => setFullName(event.target.value)} className="h-12" />
          </div>
          <PhoneField id="profile-phone" label={t("profile.phone")} value={phone} onChange={setPhone} />
          <PhoneVerifyDialog phone={phone} verified={verified} onVerified={() => void queryClient.invalidateQueries({ queryKey: ["profile"] })} />
          <Button className="h-12 w-full" disabled={saving} onClick={() => void save()}>{saving ? t("saving") : t("profile.saveChanges")}</Button>
        </div>
      </ProfileBottomSheet>

      <ProfileBottomSheet open={openSheet === "alarm"} onOpenChange={(open) => !open && setOpenSheet(null)} title={t("profile.alarmSheet")}>
        <AlarmSoundCard embedded />
      </ProfileBottomSheet>

      <ProfileBottomSheet open={openSheet === "language"} onOpenChange={(open) => !open && setOpenSheet(null)} title={t("profile.languageSheet")} description={t("profile.languageHint")}>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((item) => (
            <Button key={item.code} variant={language === item.code ? "default" : "outline"} className="h-12" aria-pressed={language === item.code} onClick={() => setLanguage(item.code)}>
              {item.nativeLabel}
            </Button>
          ))}
        </div>
      </ProfileBottomSheet>

      <ProfileBottomSheet open={openSheet === "reach"} onOpenChange={(open) => !open && setOpenSheet(null)} title={t("profile.reachSheet")}>
        <PushDeviceCard embedded />
      </ProfileBottomSheet>

      <ProfileBottomSheet open={openSheet === "calendar"} onOpenChange={(open) => !open && setOpenSheet(null)} title={t("profile.calendarSheet")}>
        {calendarOn ? <CalendarSyncCard embedded /> : null}
      </ProfileBottomSheet>

      <ProfileBottomSheet open={openSheet === "pin"} onOpenChange={(open) => !open && setOpenSheet(null)} title={t("profile.documentsPinSheet")}>
        <DocumentsPinCard embedded />
        <Button asChild variant="outline" className="mt-4 h-12 w-full"><Link to="/documents">{t("documents.open")}</Link></Button>
      </ProfileBottomSheet>

      <ProfileBottomSheet open={openSheet === "address"} onOpenChange={(open) => !open && setOpenSheet(null)} title={t("profile.addressSheet")}>
        <div className="space-y-4">
          <AddressAutocomplete id="profile-address" label={t("profile.defaultAddress")} value={address} onChange={setAddress} onResolved={(resolved) => { if (resolved.city) setCity(resolved.city); if (resolved.pincode) setPincode(resolved.pincode); }} placeholder={t("profile.addressPlaceholder")} hint={t("profile.addressHint")} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="profile-city">{t("family.city")}</Label><Input id="profile-city" value={city} maxLength={80} onChange={(event) => setCity(event.target.value)} className="h-12" /></div>
            <div className="space-y-2"><Label htmlFor="profile-pincode">{t("family.pincode")}</Label><Input id="profile-pincode" value={pincode} inputMode="numeric" maxLength={6} onChange={(event) => setPincode(event.target.value.replace(/\D/g, ""))} className="h-12" /></div>
          </div>
          <Button variant="outline" className="h-12 w-full" onClick={() => {
            if (!navigator.geolocation) {
              toast.error(t("profile.errNoGeo"));
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (position) => void save({ latitude: position.coords.latitude, longitude: position.coords.longitude }).then(() => toast.success(t("profile.locationSaved"))),
              () => toast.error(t("profile.errGeo")),
            );
          }}><MapPin className="size-5" aria-hidden />{t("profile.useLocation")}</Button>
          <Button className="h-12 w-full" disabled={saving} onClick={() => void save()}>{saving ? t("saving") : t("profile.saveAddress")}</Button>
        </div>
      </ProfileBottomSheet>
    </AppShell>
  );
}

function StatTile({ value, label, className }: { value: number; label: string; className: string }) {
  return <div className={`flex min-h-[94px] min-w-0 flex-col items-center justify-center rounded-[24px] p-4 text-center ${className}`}><strong className="font-display text-[26px] leading-none font-normal">{value}</strong><span className="mt-2 text-[11.5px] leading-tight font-semibold">{label}</span></div>;
}

function SettingsPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-7"><h2 className="mb-2 px-1 text-[19px]">{title}</h2><div className="bg-card shadow-card divide-border overflow-hidden rounded-[28px] px-[18px] py-[6px] divide-y">{children}</div></section>;
}

function SettingsRow({ title, value, onClick, to, control }: { title: string; value: string; onClick?: () => void; to?: "/orders"; control?: ReactNode }) {
  const label = <span className="min-w-0 flex-1 py-4"><span className="block text-[15.5px] leading-5 font-semibold">{title}</span><span className="text-foreground/55 mt-0.5 block truncate text-[12.5px] leading-4 font-semibold">{value}</span></span>;
  const content = <>{label}{control ?? <ChevronRight className="size-5 shrink-0 opacity-45" aria-hidden />}</>;
  if (to) return <Link to={to} className="flex min-h-[68px] items-center gap-3">{content}</Link>;
  if (control && onClick) return <div className="flex min-h-[68px] items-center gap-3"><button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">{label}</button>{control}</div>;
  if (onClick) return <button type="button" onClick={onClick} className="flex min-h-[68px] w-full items-center gap-3 text-left">{content}</button>;
  return <div className="flex min-h-[68px] items-center gap-3">{content}</div>;
}

function ProfileBottomSheet({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" className="mx-auto max-h-[88dvh] max-w-2xl overflow-y-auto rounded-t-[28px] border-border bg-background px-[22px] pt-7 pb-8"><SheetHeader className="mb-5 pr-8 text-left"><SheetTitle className="text-[24px]">{title}</SheetTitle>{description ? <SheetDescription>{description}</SheetDescription> : null}</SheetHeader>{children}</SheetContent></Sheet>;
}