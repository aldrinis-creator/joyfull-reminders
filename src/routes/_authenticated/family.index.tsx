import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Heart } from "lucide-react";
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
      { title: "Family milestones — e-Reminder" },
      {
        name: "description",
        content:
          "Everyone in your family circle with their upcoming birthdays, anniversaries, exams and the age they're turning.",
      },
      { property: "og:title", content: "Family milestones — e-Reminder" },
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
  full_name: z.string().trim().min(1, "Name is required").max(100),
  relationship: z.string().trim().min(1).max(40),
  gift_hints: z.string().trim().max(500).optional(),
});

function FamilyPage() {
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
      title="Family"
      subtitle="The people you never want to disappoint"
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
          <h2 className="mt-4 text-2xl">Build your family circle</h2>
          <p className="text-muted-foreground mt-2">
            Add your parents, spouse, children and closest friends with their special dates and what
            makes them happy.
          </p>
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
                    <p className="text-muted-foreground text-sm font-semibold">{m.relationship}</p>
                    {next ? (
                      <p className="mt-2 text-base">
                        {kindMeta?.emoji} {next.title} · {formatDate(next.when)}
                        {next.age ? ` · turning ${next.age}` : ""}
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-sm">No dates added yet</p>
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
                  {next ? (
                    <span className="bg-accent text-accent-foreground shrink-0 rounded-2xl px-3 py-2 text-xs font-bold">
                      {relativeDay(next.when)}
                    </span>
                  ) : null}
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
          <Plus className="size-5" aria-hidden /> Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Add a family member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-name">Full name</Label>
            <Input
              id="m-name"
              value={fullName}
              maxLength={100}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12"
              placeholder="Sunita Sharma"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-rel">Relationship</Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger id="m-rel" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-dob">Date of birth</Label>
            <Input
              id="m-dob"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-likes">What do they love? (comma separated)</Label>
            <Input
              id="m-likes"
              value={likes}
              maxLength={300}
              onChange={(e) => setLikes(e.target.value)}
              placeholder="Filter coffee, gardening, sarees"
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-music">Music they enjoy</Label>
            <Input
              id="m-music"
              value={music}
              maxLength={200}
              onChange={(e) => setMusic(e.target.value)}
              placeholder="Carnatic, old Hindi film songs"
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-gift">Gift hints</Label>
            <Textarea
              id="m-gift"
              value={giftHints}
              maxLength={500}
              onChange={(e) => setGiftHints(e.target.value)}
              placeholder="Loves yellow roses, allergic to lilies."
              rows={2}
            />
          </div>

          <div className="bg-muted/60 space-y-4 rounded-2xl p-4">
            <div>
              <h3 className="text-lg">Greetings &amp; delivery</h3>
              <p className="text-muted-foreground text-sm">
                Optional. Needed to send greetings and to find shops near them.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-email">Email</Label>
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
              <Label htmlFor="m-wa">WhatsApp number</Label>
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
                <Label htmlFor="m-pin">Their pincode</Label>
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
                <Label htmlFor="m-city">Their city</Label>
                <Input
                  id="m-city"
                  value={city}
                  maxLength={80}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Mumbai"
                  className="h-12"
                />
              </div>
            </div>
            <label className="flex min-h-11 items-center justify-between gap-3 text-base font-semibold">
              Allow greetings to this person
              <Switch checked={greetingsEnabled} onCheckedChange={setGreetingsEnabled} />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button
            size="lg"
            className="h-13 w-full text-base"
            disabled={saving}
            onClick={async () => {
              const parsed = memberSchema.safeParse({ full_name: fullName, relationship, gift_hints: giftHints });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Please check the details");
                return;
              }
              setSaving(true);
              const { data: userData } = await supabase.auth.getUser();
              const userId = userData.user?.id;
              if (!userId) {
                setSaving(false);
                toast.error("Please sign in again");
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
                toast.error("Could not save that person.");
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
              toast.success("Added to your family circle");
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
