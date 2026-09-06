import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Heart, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyMembers, useSpecialDates } from "@/lib/queries";
import { useT } from "@/hooks/useLanguage";
import {
  SPECIAL_DATE_KINDS,
  formatDate,
  nextAnniversary,
  relativeDay,
  turningAge,
  type SpecialDateKind,
} from "@/lib/ereminder";

export const Route = createFileRoute("/_authenticated/family/")({
  head: () => ({
    meta: [
      { title: "Family milestones â€” e-Reminder" },
      {
        name: "description",
        content:
          "Everyone in your family circle with their upcoming birthdays, anniversaries, exams and the age they're turning.",
      },
      { property: "og:title", content: "Family milestones â€” e-Reminder" },
      {
        property: "og:description",
        content: "Birthdays, anniversaries and milestones for the people you love.",
      },
    ],
  }),
  component: FamilyPage,
});

const RELATIONSHIPS = [
  "Mother",
  "Father",
  "Spouse",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandparent",
  "Friend",
  "Other",
];

const memberSchema = z.object({
  full_name: z.string().trim().min(1, "family.errName").max(100),
  relationship: z.string().trim().min(1).max(40),
  gift_hints: z.string().trim().max(500).optional(),
});

function FamilyPage() {
  const t = useT();
  const { data: members, isLoading } = useFamilyMembers();
  const { data: dates } = useSpecialDates();

  const upcomingFor = useMemo(() => {
    const map = new Map<string, { title: string; when: Date; kind: SpecialDateKind; age: number | null }>();
    (dates ?? []).forEach((d) => {
      const when = d.recurring ? nextAnniversary(d.event_date) : new Date(d.event_date);
      const existing = map.get(d.family_member_id);
      if (!existing || when < existing.when) {
        map.set(d.family_member_id, {
          title: d.title,
          when,
          kind: d.kind,
          age: d.recurring ? turningAge(d.event_date, when) : null,
        });
      }
    });
    return map;
  }, [dates]);

  const sorted = useMemo(
    () =>
      [...(members ?? [])].sort((a, b) => {
        const aw = upcomingFor.get(a.id)?.when.getTime() ?? Infinity;
        const bw = upcomingFor.get(b.id)?.when.getTime() ?? Infinity;
        return aw - bw;
      }),
    [members, upcomingFor],
  );

  return (
    <AppShell
      title={t("nav.family")}
      subtitle={t("family.subtitle")}
      action={<AddMemberDialog />}
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-card shadow-card rounded-3xl px-6 py-12 text-center">
          <Heart className="text-primary mx-auto size-12" aria-hidden />
          <h2 className="mt-4 text-2xl">{t("family.emptyTitle")}</h2>
          <p className="text-muted-foreground mt-2">{t("family.emptyBody")}</p>
          <div className="mt-6 flex justify-center">
            <AddMemberDialog />
          </div>
        </div>
      ) : (
        <div className="space-y-3 pb-6">
          {sorted.map((m) => {
            const next = upcomingFor.get(m.id);
            const kindMeta = next
              ? SPECIAL_DATE_KINDS.find((k) => k.value === next.kind)
              : undefined;
            return (
              <Link
                key={m.id}
                to="/family/$memberId"
                params={{ memberId: m.id }}
                className="bg-card shadow-card block rounded-3xl p-5 transition-transform active:scale-[0.99]"
              >
                <div className="flex items-start gap-4">
                  <span className="gradient-cool text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold">
                    {m.full_name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl">{m.full_name}</h2>
                    <p className="text-muted-foreground text-sm font-semibold">
                      {t(`family.rel.${m.relationship}`)}
                      {m.whatsapp_phone ? ` · ${m.whatsapp_phone}` : ""}
                    </p>
                    {next ? (
                      <p className="mt-2 text-base">
                        {kindMeta?.emoji} {next.title} · {formatDate(next.when)}
                        {next.age ? ` · ${t("family.turning", { age: next.age })}` : ""}
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-sm">{t("family.noDates")}</p>
                    )}
                    {m.likes.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.likes.slice(0, 4).map((like) => (
                          <span
                            key={like}
                            className="bg-muted rounded-full px-2.5 py-1 text-xs font-semibold"
                          >
                            {like}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                      <EditMemberDialog member={m} />
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          if (!confirm(t("family.confirmDelete") || "Delete this member?")) return;
                          await supabase.from("family_members").delete().eq("id", m.id);
                          queryClient.invalidateQueries({ queryKey: ["family_members"] });
                          toast.success(t("family.deletedToast") || "Deleted successfully");
                        }}
                        className="text-muted-foreground hover:text-destructive bg-muted rounded-full p-2 transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {next ? (
                      <span className="bg-accent text-accent-foreground shrink-0 rounded-2xl px-3 py-2 text-xs font-bold">
                        {relativeDay(next.when)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function AddMemberDialog() {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("Mother");
  const [birthDate, setBirthDate] = useState("");
  const [likes, setLikes] = useState("");
  const [music, setMusic] = useState("");
  const [giftHints, setGiftHints] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [greetingsEnabled, setGreetingsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="bg-indigo text-indigo-foreground h-12 shadow-lifted">
          <Plus className="size-5" aria-hidden /> {t("nav.add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">{t("family.addTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-name">{t("family.fullName")}</Label>
            <Input
              id="m-name"
              value={fullName}
              maxLength={100}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12"
              placeholder={t("family.namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-rel">{t("family.relationship")}</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger id="m-rel" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`family.rel.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-dob">{t("family.dob")}</Label>
            <Input
              id="m-dob"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="h-12 w-full min-w-0"
            />

          </div>
          <div className="space-y-2">
            <Label htmlFor="m-likes">{t("family.likes")}</Label>
            <Input
              id="m-likes"
              value={likes}
              maxLength={300}
              onChange={(e) => setLikes(e.target.value)}
              placeholder={t("family.likesPlaceholder")}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-music">{t("family.music")}</Label>
            <Input
              id="m-music"
              value={music}
              maxLength={200}
              onChange={(e) => setMusic(e.target.value)}
              placeholder={t("family.musicPlaceholder")}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-gift">{t("family.giftHints")}</Label>
            <Textarea
              id="m-gift"
              value={giftHints}
              maxLength={500}
              onChange={(e) => setGiftHints(e.target.value)}
              placeholder={t("family.giftHintsPlaceholder")}
              rows={2}
            />
          </div>

          <div className="bg-muted/60 space-y-4 rounded-2xl p-4">
            <div>
              <h3 className="text-lg">{t("family.greetingsSection")}</h3>
              <p className="text-muted-foreground text-sm">{t("family.greetingsSectionBody")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-email">{t("family.email")}</Label>
              <Input
                id="m-email"
                type="email"
                inputMode="email"
                value={email}
                maxLength={200}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sunita@example.com"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-wa">{t("family.whatsapp")}</Label>
              <Input
                id="m-wa"
                inputMode="tel"
                value={whatsapp}
                maxLength={20}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-12"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="m-pin">{t("family.theirPincode")}</Label>
                <Input
                  id="m-pin"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  placeholder="400069"
                  className="h-12"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="m-city">{t("family.theirCity")}</Label>
                <Input
                  id="m-city"
                  value={city}
                  maxLength={80}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("family.cityPlaceholder")}
                  className="h-12"
                />
              </div>
            </div>
            <label className="flex min-h-11 items-center justify-between gap-3 text-base font-semibold">
              {t("family.allowGreetings")}
              <Switch checked={greetingsEnabled} onCheckedChange={setGreetingsEnabled} />
            </label>
          </div>
        </div>
        </DialogBody>
        <DialogFooter>
          <Button
            size="lg"
            className="h-13 w-full text-base"
            disabled={saving}
            onClick={async () => {
              const parsed = memberSchema.safeParse({ full_name: fullName, relationship, gift_hints: giftHints });
              if (!parsed.success) {
                toast.error(t(parsed.error.issues[0]?.message ?? "family.errDetails"));
                return;
              }
              setSaving(true);
              const { data: userData } = await supabase.auth.getUser();
              const userId = userData.user?.id;
              if (!userId) {
                setSaving(false);
                toast.error(t("reminders.errSignIn"));
                return;
              }
              const { data: member, error } = await supabase
                .from("family_members")
                .insert({
                  user_id: userId,
                  full_name: parsed.data.full_name,
                  relationship: parsed.data.relationship,
                  birth_date: birthDate || null,
                  birth_year: birthDate ? new Date(birthDate).getFullYear() : null,
                  likes: likes
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 12),
                  music_genres: music
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 12),
                  gift_hints: parsed.data.gift_hints || null,
                  email: email.trim() || null,
                  whatsapp_phone: whatsapp.trim() || null,
                  pincode: pincode.trim() || null,
                  city: city.trim() || null,
                  greetings_enabled: greetingsEnabled,
                })
                .select("id")
                .single();

              if (error || !member) {
                setSaving(false);
                toast.error(t("family.errSavePerson"));
                return;
              }

              if (birthDate) {
                await supabase.from("special_dates").insert({
                  user_id: userId,
                  family_member_id: member.id,
                  kind: "birthday",
                  title: `${parsed.data.full_name}'s birthday`,
                  event_date: birthDate,
                  recurring: true,
                });
                await supabase.from("reminders").insert({
                  user_id: userId,
                  family_member_id: member.id,
                  title: `${parsed.data.full_name}'s birthday`,
                  category: "personal_family",
                  due_at: nextAnniversary(birthDate).toISOString(),
                  recurrence: "yearly",
                  priority: "high",
                  birth_year: new Date(birthDate).getFullYear(),
                });
              }

              setSaving(false);
              setOpen(false);
              setFullName("");
              setBirthDate("");
              setLikes("");
              setMusic("");
              setGiftHints("");
              setEmail("");
              setWhatsapp("");
              setPincode("");
              setCity("");
              setGreetingsEnabled(true);
              void queryClient.invalidateQueries({ queryKey: ["family_members"] });
              void queryClient.invalidateQueries({ queryKey: ["special_dates"] });
              void queryClient.invalidateQueries({ queryKey: ["reminders"] });
              toast.success(t("family.addedToast"));
            }}
          >
            {saving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ member }: { member: any }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(member.full_name);
  const [relationship, setRelationship] = useState(member.relationship);
  const [likes, setLikes] = useState(member.likes?.join(", ") ?? "");
  const [music, setMusic] = useState(member.music_genres?.join(", ") ?? "");
  const [giftHints, setGiftHints] = useState(member.gift_hints ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [whatsapp, setWhatsapp] = useState(member.whatsapp_phone ?? "");
  const [pincode, setPincode] = useState(member.pincode ?? "");
  const [city, setCity] = useState(member.city ?? "");
  const [greetingsEnabled, setGreetingsEnabled] = useState(member.greetings_enabled ?? true);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-muted-foreground hover:text-primary bg-muted rounded-full p-2 transition-colors">
          <Edit2 className="size-4" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">{t("family.editTitle") || "Edit Member"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`m-name-${member.id}`}>{t("family.fullName")}</Label>
            <Input
              id={`m-name-${member.id}`}
              value={fullName}
              maxLength={100}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`m-rel-${member.id}`}>{t("family.relationship")}</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger id={`m-rel-${member.id}`} className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`family.rel.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`m-likes-${member.id}`}>{t("family.likes")}</Label>
            <Input
              id={`m-likes-${member.id}`}
              value={likes}
              maxLength={300}
              onChange={(e) => setLikes(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`m-music-${member.id}`}>{t("family.music")}</Label>
            <Input
              id={`m-music-${member.id}`}
              value={music}
              maxLength={200}
              onChange={(e) => setMusic(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`m-gift-${member.id}`}>{t("family.giftHints")}</Label>
            <Textarea
              id={`m-gift-${member.id}`}
              value={giftHints}
              maxLength={500}
              onChange={(e) => setGiftHints(e.target.value)}
              rows={2}
            />
          </div>

          <div className="bg-muted/60 space-y-4 rounded-2xl p-4">
            <div>
              <h3 className="text-lg">{t("family.greetingsSection")}</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`m-email-${member.id}`}>{t("family.email")}</Label>
              <Input
                id={`m-email-${member.id}`}
                type="email"
                inputMode="email"
                value={email}
                maxLength={200}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`m-wa-${member.id}`}>{t("family.whatsapp")}</Label>
              <Input
                id={`m-wa-${member.id}`}
                inputMode="tel"
                value={whatsapp}
                maxLength={20}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`m-pin-${member.id}`}>{t("family.theirPincode")}</Label>
                <Input
                  id={`m-pin-${member.id}`}
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  className="h-12"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor={`m-city-${member.id}`}>{t("family.theirCity")}</Label>
                <Input
                  id={`m-city-${member.id}`}
                  value={city}
                  maxLength={80}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>
            <label className="flex min-h-11 items-center justify-between gap-3 text-base font-semibold">
              {t("family.allowGreetings")}
              <Switch checked={greetingsEnabled} onCheckedChange={setGreetingsEnabled} />
            </label>
          </div>
        </div>
        </DialogBody>
        <DialogFooter>
          <Button
            size="lg"
            className="h-13 w-full text-base"
            disabled={saving}
            onClick={async () => {
              const parsed = memberSchema.safeParse({ full_name: fullName, relationship, gift_hints: giftHints });
              if (!parsed.success) {
                toast.error(t(parsed.error.issues[0]?.message ?? "family.errDetails"));
                return;
              }
              setSaving(true);
              const { error } = await supabase
                .from("family_members")
                .update({
                  full_name: parsed.data.full_name,
                  relationship: parsed.data.relationship,
                  likes: likes.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12),
                  music_genres: music.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12),
                  gift_hints: parsed.data.gift_hints || null,
                  email: email.trim() || null,
                  whatsapp_phone: whatsapp.trim() || null,
                  pincode: pincode.trim() || null,
                  city: city.trim() || null,
                  greetings_enabled: greetingsEnabled,
                })
                .eq("id", member.id);

              setSaving(false);
              if (error) {
                toast.error(t("family.errSavePerson"));
                return;
              }
              
              setOpen(false);
              void queryClient.invalidateQueries({ queryKey: ["family_members"] });
              toast.success(t("saved") || "Saved");
            }}
          >
            {saving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
