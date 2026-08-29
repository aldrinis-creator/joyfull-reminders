import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gift, MessageCircleHeart, Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/integrations/supabase/client";
import { isValidPincode } from "@/lib/greetings";
import { useT } from "@/hooks/useLanguage";
import {
  SPECIAL_DATE_KINDS,
  specialDateKindLabel,
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
      { title: "Family member — e-Reminder" },
      {
        name: "description",
        content:
          "Special dates, likes, music tastes, gift hints and wishlist for one member of your family circle.",
      },
      { property: "og:title", content: "Family member — e-Reminder" },
      { property: "og:description", content: "Dates, gift hints and wishlist in one place." },
    ],
  }),
  component: MemberPage,
});

function MemberPage() {
  const t = useT();
  const { memberId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["family_member", memberId],
    queryFn: async () => {
      const [member, dates, wishes] = await Promise.all([
        supabase.from("family_members").select("*").eq("id", memberId).maybeSingle(),
        supabase
          .from("special_dates")
          .select("*")
          .eq("family_member_id", memberId)
          .order("event_date"),
        supabase
          .from("wishlist_items")
          .select("*")
          .eq("family_member_id", memberId)
          .order("created_at"),
      ]);
      return {
        member: member.data,
        dates: dates.data ?? [],
        wishes: wishes.data ?? [],
      };
    },
  });

  const member = data?.member;
  const [composerOpen, setComposerOpen] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["family_member", memberId] });

  return (
    <AppShell
      title={member?.full_name ?? t("family.memberFallback")}
      subtitle={member?.relationship ? t(`family.rel.${member.relationship}`) : undefined}
      action={
        <Button asChild variant="secondary" size="lg" className="h-12">
          <Link to="/family">
            <ArrowLeft className="size-5" aria-hidden /> {t("back")}
          </Link>
        </Button>
      }
    >
      <div className="space-y-4 pb-8">
        <section className="bg-card shadow-card rounded-3xl p-5">
          <h2 className="text-xl">{t("family.specialDates")}</h2>
          <ul className="mt-3 space-y-2">
            {(data?.dates ?? []).map((d) => {
              const when = d.recurring ? nextAnniversary(d.event_date) : new Date(d.event_date);
              const kind = SPECIAL_DATE_KINDS.find((k) => k.value === d.kind);
              const age = d.recurring ? turningAge(d.event_date, when) : null;
              return (
                <li
                  key={d.id}
                  className="bg-muted flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">
                      {kind?.emoji} {d.title}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatDate(when)}
                      {age ? ` · ${t("family.turning", { age })}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold">{relativeDay(when)}</span>
                </li>
              );
            })}
            {(data?.dates.length ?? 0) === 0 ? (
              <li className="text-muted-foreground text-sm">{t("family.noDatesYet")}</li>
            ) : null}
          </ul>
          <AddDateForm memberId={memberId} memberName={member?.full_name ?? ""} onSaved={refresh} />
        </section>

        {member ? (
          <section className="bg-card shadow-card rounded-3xl p-5">
            <h2 className="text-xl">{t("family.happyTitle")}</h2>
            {member.likes.length === 0 && member.music_genres.length === 0 && !member.gift_hints ? (
              <p className="text-muted-foreground mt-2 text-sm">{t("family.nothingNoted")}</p>
            ) : null}
            {member.likes.length > 0 ? (
              <div className="mt-3">
                <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                  {t("family.likesLabel")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {member.likes.map((l) => (
                    <span key={l} className="bg-accent text-accent-foreground rounded-full px-3 py-1.5 text-sm font-semibold">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {member.music_genres.length > 0 ? (
              <div className="mt-4">
                <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                  {t("family.musicLabel")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {member.music_genres.map((g) => (
                    <span key={g} className="bg-muted rounded-full px-3 py-1.5 text-sm font-semibold">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {member.gift_hints ? (
              <p className="mt-4 text-base">
                <span className="font-semibold">{t("family.giftHintsLabel")} </span>
                {member.gift_hints}
              </p>
            ) : null}
            <div className="mt-5 grid gap-2">
              <Button asChild size="lg" className="h-13 w-full text-base">
                <Link
                  to="/market"
                  search={{ pin: member.pincode ?? undefined, for: member.id }}
                >
                  <Gift className="size-5" aria-hidden />
                  {member.pincode ? t("family.findGiftNear", { pincode: member.pincode }) : t("family.findGift")}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-13 w-full text-base"
                onClick={() => setComposerOpen(true)}
              >
                <MessageCircleHeart className="size-5" aria-hidden /> {t("family.sendGreeting")}
              </Button>
            </div>
          </section>
        ) : null}

        {member ? (
          <ContactSection member={member as FamilyMember} onSaved={refresh} />
        ) : null}

        <section className="bg-card shadow-card rounded-3xl p-5">
          <h2 className="text-xl">{t("family.wishlist")}</h2>
          <ul className="mt-3 space-y-2">
            {(data?.wishes ?? []).map((w) => (
              <li
                key={w.id}
                className="bg-muted flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
              >
                <span className="font-semibold">{w.title}</span>
                <span className="flex items-center gap-3">
                  {w.price_paise ? <span className="text-sm">{rupees(w.price_paise)}</span> : null}
                  <button
                    type="button"
                    aria-label={t("family.removeWish", { title: w.title })}
                    onClick={async () => {
                      await supabase.from("wishlist_items").delete().eq("id", w.id);
                      void refresh();
                    }}
                  >
                    <Trash2 className="text-muted-foreground size-5" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
            {(data?.wishes.length ?? 0) === 0 ? (
              <li className="text-muted-foreground text-sm">{t("family.noWishes")}</li>
            ) : null}
          </ul>
          <AddWishForm memberId={memberId} onSaved={refresh} />
        </section>
      </div>

      {member ? (
        <GreetingComposer
          member={member as FamilyMember}
          open={composerOpen}
          onOpenChange={setComposerOpen}
        />
      ) : null}
    </AppShell>
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
    <section className="bg-card shadow-card rounded-3xl p-5">
      <h2 className="text-xl">{t("family.greetingsSection")}</h2>
      <p className="text-muted-foreground text-sm">{t("family.contactPrivacy")}</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pincode && !isValidPincode(pincode)) {
            toast.error(t("family.errPincode"));
            return;
          }
          setSaving(true);
          const { error } = await supabase
            .from("family_members")
            .update({
              email: email.trim() || null,
              whatsapp_phone: whatsapp.trim() || null,
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
        <div className="space-y-1">
          <Label htmlFor="c-wa" className="text-sm">
            {t("family.whatsapp")}
          </Label>
          <Input
            id="c-wa"
            inputMode="tel"
            value={whatsapp}
            maxLength={20}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+91 98765 43210"
            className="h-12"
          />
        </div>
        <div className="flex gap-2">
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
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="h-12 flex-1" disabled={saving}>
            {saving ? t("saving") : t("family.saveDetails")}
          </Button>
          <Button type="button" variant="outline" className="h-12" onClick={requestPincode}>
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
      className="mt-4 space-y-3 border-t pt-4"
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
      <Button type="submit" variant="secondary" className="h-12 w-full">
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
      className="mt-4 flex gap-2 border-t pt-4"
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
      <Button type="submit" variant="secondary" className="h-12">
        {t("nav.add")}
      </Button>
    </form>
  );
}
