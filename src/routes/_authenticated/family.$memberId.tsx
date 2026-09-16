import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gift, MessageCircleHeart, Phone, Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneField, isPhoneAcceptable, normalizePhone } from "@/components/PhoneField";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GreetingComposer } from "@/components/GreetingComposer";
import { dialNumber } from "@/components/RecipientActions";
import { supabase } from "@/integrations/supabase/client";
import { isValidPincode } from "@/lib/greetings";
import { useMemberAnyGreetingState, useVendors } from "@/lib/queries";
import { useT } from "@/hooks/useLanguage";
import {
  SPECIAL_DATE_KINDS,
  specialDateKindLabel,
  daysUntil,
  formatDate,
  nextAnniversary,
  relativeDay,
  rupees,
  turningAge,
  type FamilyMember,
  type SpecialDateKind,
} from "@/lib/ereminder";

export const Route = createFileRoute("/_authenticated/family/$memberId")({
  head: () => ({
    meta: [
      { title: "Family member — My-Mitr" },
      {
        name: "description",
        content:
          "Special dates, likes, music tastes, gift hints and wishlist for one member of your family circle.",
      },
      { property: "og:title", content: "Family member — My-Mitr" },
      { property: "og:description", content: "Dates, gift hints and wishlist in one place." },
    ],
  }),
  component: MemberPage,
});

function MemberPage() {
  const t = useT();
  const { memberId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: vendors } = useVendors();

  const { data } = useQuery({
    queryKey: ["family_member", memberId],
    queryFn: async () => {
      const [member, dates, wishes] = await Promise.all([
        supabase.from("family_members").select("*").eq("id", memberId).maybeSingle(),
        supabase.from("special_dates").select("*").eq("family_member_id", memberId).order("event_date"),
        supabase.from("wishlist_items").select("*").eq("family_member_id", memberId).order("created_at"),
      ]);
      return { member: member.data, dates: dates.data ?? [], wishes: wishes.data ?? [] };
    },
  });

  const member = data?.member;
  const greetingState = useMemberAnyGreetingState(memberId).data ?? null;
  const [composerOpen, setComposerOpen] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["family_member", memberId] });
  const phoneNumber = member ? dialNumber(member as FamilyMember) : null;
  const firstName = member?.full_name.split(" ")[0] ?? t("family.memberFallback");
  const initial = member?.full_name.slice(0, 1).toUpperCase() ?? "";
  const location = [member?.city, member?.pincode].filter(Boolean).join(" ");
  const relationship = member?.relationship ? t(`family.rel.${member.relationship}`) : "";
  const identityMeta = [relationship, location].filter(Boolean).join(" · ");

  const todayFact = useMemo(() => {
    const todayDate = new Date();
    const date = (data?.dates ?? []).find((item) => item.recurring && daysUntil(nextAnniversary(item.event_date), todayDate) === 0);
    if (!date) return null;
    const years = turningAge(date.event_date, todayDate);
    if (!years) return null;
    return date.kind === "birthday"
      ? t("family.ageToday", { age: years })
      : date.kind === "anniversary"
        ? t("family.yearsToday", { years })
        : null;
  }, [data?.dates, t]);

  const coverage = useMemo(() => {
    if (!member?.pincode) return [];
    return (vendors ?? []).filter((vendor) =>
      vendor.pincode === member.pincode || vendor.serviceable_pincodes.includes(member.pincode ?? ""),
    );
  }, [member?.pincode, vendors]);
  const coverageCounts = useMemo(() => ({
    bakery: coverage.filter((vendor) => vendor.kind === "bakery").length,
    florist: coverage.filter((vendor) => vendor.kind === "florist").length,
    gift: coverage.filter((vendor) => vendor.kind === "gift_shop" || vendor.kind === "other").length,
  }), [coverage]);

  return (
    <AppShell title={member?.full_name ?? t("family.memberFallback")} hideHeader>
      <div className="relative min-h-screen pb-10">
        <header className="bg-accent-200 relative h-[196px] overflow-hidden">
          {member?.photo_url ? (
            <img src={member.photo_url} alt={member.full_name} className="washed h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent-200 to-accent-300">
              <span className="font-display text-accent-800/70 text-[92px]">{initial}</span>
            </div>
          )}
          <Button asChild variant="secondary" size="icon" className="absolute top-5 left-[22px] size-10 rounded-full shadow-card">
            <Link to="/family" aria-label={t("back")}><ArrowLeft className="size-5" aria-hidden /></Link>
          </Button>
        </header>

        <div className="relative z-10 -mt-[30px] space-y-5 px-[22px]">
          <section className="bg-background shadow-lifted rounded-[30px] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[27px] leading-tight">{member?.full_name ?? t("family.memberFallback")}</h1>
                {identityMeta ? <p className="text-foreground/60 mt-1 text-[13.5px] font-semibold">{identityMeta}</p> : null}
              </div>
              {todayFact ? <span className="bg-accent-100 text-accent-800 shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold">{todayFact}</span> : null}
            </div>
            {member ? (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <Button asChild className="h-12 rounded-full text-[15px]">
                  <Link to="/market" search={{ pin: member.pincode ?? undefined, for: member.id }}>
                    <Gift className="size-5" aria-hidden />{t("family.sendGift")}
                  </Link>
                </Button>
                <Button asChild={Boolean(phoneNumber)} variant="outline" className="h-12 rounded-full bg-transparent text-[15px]" disabled={!phoneNumber}>
                  {phoneNumber ? <a href={`tel:+${phoneNumber}`}><Phone className="size-5" aria-hidden />{t("family.call")}</a> : <span><Phone className="size-5" aria-hidden />{t("family.call")}</span>}
                </Button>
              </div>
            ) : null}
          </section>

          <section>
            <p className="text-foreground/55 mb-3 text-[11px] font-semibold uppercase">{t("family.datesKeptFor", { name: firstName })}</p>
            <ul className="space-y-2.5">
              {(data?.dates ?? []).map((date) => {
                const when = date.recurring ? nextAnniversary(date.event_date) : new Date(date.event_date);
                const kind = SPECIAL_DATE_KINDS.find((item) => item.value === date.kind);
                const age = date.recurring ? turningAge(date.event_date, when) : null;
                return (
                  <li key={date.id} className={`${date.kind === "birthday" || date.kind === "anniversary" ? "bg-accent-100" : "bg-card shadow-card"} rounded-[26px] px-5 py-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15.5px] font-semibold">{kind?.emoji} {date.title}</p>
                        <p className="text-foreground/55 mt-1 text-[12.5px] font-semibold">
                          {formatDate(when)} · {age ? t("family.turning", { age }) : relativeDay(when)}
                        </p>
                      </div>
                      {age ? <span className="text-accent-800 text-[12px] font-semibold">{relativeDay(when)}</span> : null}
                    </div>
                  </li>
                );
              })}
              {(data?.dates.length ?? 0) === 0 ? <li className="text-muted-foreground text-sm">{t("family.noDatesYet")}</li> : null}
            </ul>
            <AddDateForm memberId={memberId} memberName={member?.full_name ?? ""} onSaved={refresh} />
          </section>

          {member ? <DeliveryPanel member={member as FamilyMember} coverage={coverageCounts} /> : null}

          {member ? (
            <section className="bg-card shadow-card rounded-[28px] p-5">
              <h2 className="text-xl">{t("family.happyTitle")}</h2>
              {member.likes.length === 0 && member.music_genres.length === 0 && !member.gift_hints ? <p className="text-muted-foreground mt-2 text-sm">{t("family.nothingNoted")}</p> : null}
              {member.likes.length > 0 ? <InfoChips label={t("family.likesLabel")} items={member.likes} accent /> : null}
              {member.music_genres.length > 0 ? <InfoChips label={t("family.musicLabel")} items={member.music_genres} /> : null}
              {member.gift_hints ? <p className="mt-4 text-[15px]"><span className="font-semibold">{t("family.giftHintsLabel")} </span>{member.gift_hints}</p> : null}
              <Button size="lg" variant={greetingState ? "default" : "secondary"} className="mt-5 h-12 w-full rounded-full text-[15px]" onClick={() => setComposerOpen(true)}>
                <MessageCircleHeart className="size-5" aria-hidden />{t("family.sendGreeting")}
              </Button>
            </section>
          ) : null}

          {member ? <ContactSection member={member as FamilyMember} onSaved={refresh} /> : null}

          <section className="bg-card shadow-card rounded-[28px] p-5">
            <h2 className="text-xl">{t("family.wishlist")}</h2>
            <ul className="mt-3 space-y-2.5">
              {(data?.wishes ?? []).map((wish) => (
                <li key={wish.id} className="bg-background flex items-center justify-between gap-3 rounded-[22px] px-4 py-3">
                  <span className="font-semibold">{wish.title}</span>
                  <span className="flex items-center gap-2">
                    {wish.price_paise ? <span className="text-sm">{rupees(wish.price_paise)}</span> : null}
                    <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" aria-label={t("family.removeWish", { title: wish.title })} onClick={async () => { await supabase.from("wishlist_items").delete().eq("id", wish.id); void refresh(); }}>
                      <Trash2 className="text-muted-foreground size-4" aria-hidden />
                    </Button>
                  </span>
                </li>
              ))}
              {(data?.wishes.length ?? 0) === 0 ? <li className="text-muted-foreground text-sm">{t("family.noWishes")}</li> : null}
            </ul>
            <AddWishForm memberId={memberId} onSaved={refresh} />
          </section>
        </div>
      </div>

      {member ? <GreetingComposer member={member as FamilyMember} open={composerOpen} onOpenChange={setComposerOpen} /> : null}
    </AppShell>
  );
}

function InfoChips({ label, items, accent = false }: { label: string; items: string[]; accent?: boolean }) {
  return (
    <div className="mt-4">
      <p className="text-foreground/55 text-[11px] font-semibold uppercase">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => <span key={item} className={`${accent ? "bg-accent-100 text-accent-800" : "bg-muted"} rounded-full px-3 py-1.5 text-[13px] font-semibold`}>{item}</span>)}
      </div>
    </div>
  );
}

function DeliveryPanel({ member, coverage }: { member: FamilyMember; coverage: { bakery: number; florist: number; gift: number } }) {
  const t = useT();
  const total = coverage.bakery + coverage.florist + coverage.gift;
  return (
    <section className="bg-accent-2-100 rounded-[28px] p-5">
      {member.pincode ? (
        <>
          <h2 className="text-accent-2-900 text-[15.5px] font-semibold">{t("family.deliveringTo", { pincode: member.pincode })}</h2>
          <p className="text-accent-2-800 mt-2 text-[13px] leading-relaxed">{t("family.shopCoverage", { count: total, bakery: coverage.bakery, florist: coverage.florist, gift: coverage.gift })}</p>
          <p className="text-accent-2-700 mt-3 text-[12.5px] font-semibold">{[member.city, member.pincode].filter(Boolean).join(" · ")}</p>
        </>
      ) : (
        <>
          <h2 className="text-accent-2-900 text-[15.5px] font-semibold">{t("family.deliveryNeedsPincode")}</h2>
          <p className="text-accent-2-700 mt-2 text-[12.5px]">{t("family.deliveryNeedsPincodeBody")}</p>
        </>
      )}
    </section>
  );
}

function ContactSection({ member, onSaved }: { member: FamilyMember; onSaved: () => void }) {
  const t = useT();
  const [email, setEmail] = useState(member.email ?? "");
  const [whatsapp, setWhatsapp] = useState(member.whatsapp_phone ?? "");
  const [pincode, setPincode] = useState(member.pincode ?? "");
  const [city, setCity] = useState(member.city ?? "");
  const [enabled, setEnabled] = useState(member.greetings_enabled);
  const [saving, setSaving] = useState(false);

  async function requestPincode() {
    const url = `${window.location.origin}/pincode/${member.id}`;
    const text = t("family.pincodeRequestText", {
      name: member.full_name.split(" ")[0] ?? member.full_name,
      url,
    });
    if (navigator.share) {
      try {
        await navigator.share({ title: t("family.pincodeShareTitle"), text });
        return;
      } catch {
        /* dismissed */
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success(t("family.pincodeCopied"));
  }

  return (
    <section className="bg-card shadow-card rounded-[28px] p-5">
      <h2 className="text-xl">{t("family.greetingsSection")}</h2>
      <p className="text-muted-foreground text-sm">{t("family.contactPrivacy")}</p>
      <form
        className="mt-4 space-y-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pincode && !isValidPincode(pincode)) {
            toast.error(t("family.errPincode"));
            return;
          }
          if (!isPhoneAcceptable(whatsapp)) {
            toast.error(t("phoneCountryError"));
            return;
          }
          setSaving(true);
          const { error } = await supabase
            .from("family_members")
            .update({
              email: email.trim() || null,
              whatsapp_phone: normalizePhone(whatsapp),
              pincode: pincode.trim() || null,
              city: city.trim() || null,
              greetings_enabled: enabled,
            })
            .eq("id", member.id);
          setSaving(false);
          if (error) {
            toast.error(t("family.errSaveDetails"));
            return;
          }
          toast.success(t("family.contactSaved"));
          onSaved();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="c-email" className="text-sm">
            {t("family.email")}
          </Label>
          <Input
            id="c-email"
            type="email"
            value={email}
            maxLength={200}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12"
          />
        </div>
        <PhoneField
          id="c-wa"
          label={t("family.whatsapp")}
          value={whatsapp}
          onChange={setWhatsapp}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex-1 space-y-1">
            <Label htmlFor="c-pin" className="text-sm">
              {t("family.pincode")}
            </Label>
            <Input
              id="c-pin"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              className="h-12"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="c-city" className="text-sm">
              {t("family.city")}
            </Label>
            <Input
              id="c-city"
              value={city}
              maxLength={80}
              onChange={(e) => setCity(e.target.value)}
              className="h-12"
            />
          </div>
        </div>
        <label className="flex min-h-11 items-center justify-between gap-3 text-base font-semibold">
          {t("family.allowGreetingsShort")}
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <Button type="submit" variant="secondary" className="h-12 rounded-full" disabled={saving}>
            {saving ? t("saving") : t("family.saveDetails")}
          </Button>
          <Button type="button" variant="outline" className="h-12 rounded-full bg-transparent" onClick={requestPincode}>
            <Share2 className="size-4" aria-hidden /> {t("family.askPincode")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function AddDateForm({
  memberId,
  memberName,
  onSaved,
}: {
  memberId: string;
  memberName: string;
  onSaved: () => void;
}) {
  const t = useT();
  const [kind, setKind] = useState<SpecialDateKind>("anniversary");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!date) {
          toast.error(t("reminders.errDate"));
          return;
        }
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;
        const finalTitle =
          title.trim().slice(0, 120) ||
          `${memberName}'s ${(SPECIAL_DATE_KINDS.find((k) => k.value === kind)?.label ?? "date").toLowerCase()}`;
        const { error } = await supabase.from("special_dates").insert({
          user_id: userId,
          family_member_id: memberId,
          kind,
          title: finalTitle,
          event_date: date,
          recurring: kind !== "exam",
        });
        if (error) {
          toast.error(t("family.errSaveDate"));
          return;
        }
        await supabase.from("reminders").insert({
          user_id: userId,
          family_member_id: memberId,
          title: finalTitle,
          category: kind === "exam" ? "academic_career" : "personal_family",
          due_at: (kind === "exam" ? new Date(date) : nextAnniversary(date)).toISOString(),
          recurrence: kind === "exam" ? "once" : "yearly",
          priority: "high",
        });
        setTitle("");
        setDate("");
        toast.success(t("family.dateAdded"));
        onSaved();
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-1">
          <Label htmlFor="sd-kind" className="text-sm">
            {t("family.occasion")}
          </Label>
          <Select value={kind} onValueChange={(v) => setKind(v as SpecialDateKind)}>
            <SelectTrigger id="sd-kind" className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPECIAL_DATE_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.emoji} {specialDateKindLabel(k.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sd-date" className="text-sm">
            {t("reminders.fieldDate")}
          </Label>
          <Input
            id="sd-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 w-full min-w-0"
          />

        </div>
      </div>
      <Input
        aria-label={t("family.titleLabel")}
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("family.titlePlaceholder")}
        className="h-12"
      />
      <Button type="submit" variant="outline" className="h-[50px] w-full rounded-full border-dashed bg-transparent">
        <Plus className="size-4" aria-hidden /> {t("family.addDate")}
      </Button>
    </form>
  );
}

function AddWishForm({ memberId, onSaved }: { memberId: string; onSaved: () => void }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");

  return (
    <form
      className="mt-4 flex gap-2 border-t border-border pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const clean = title.trim();
        if (!clean) return;
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;
        const { error } = await supabase.from("wishlist_items").insert({
          user_id: userId,
          family_member_id: memberId,
          title: clean.slice(0, 120),
          price_paise: price ? Math.round(Number(price) * 100) : null,
        });
        if (error) {
          toast.error(t("family.errAddWish"));
          return;
        }
        setTitle("");
        setPrice("");
        onSaved();
      }}
    >
      <Input
        aria-label={t("family.wishItem")}
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("family.wishPlaceholder")}
        className="h-12 flex-1"
      />
      <Input
        aria-label={t("family.priceAria")}
        value={price}
        inputMode="numeric"
        maxLength={7}
        onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
        placeholder="₹"
        className="h-12 w-24"
      />
      <Button type="submit" variant="secondary" className="h-12 rounded-full px-5">
        {t("nav.add")}
      </Button>
    </form>
  );
}
