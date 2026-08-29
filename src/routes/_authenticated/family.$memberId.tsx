import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gift, Plus, Trash2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  SPECIAL_DATE_KINDS,
  formatDate,
  nextAnniversary,
  relativeDay,
  rupees,
  turningAge,
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
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["family_member", memberId] });

  return (
    <AppShell
      title={member?.full_name ?? "Family member"}
      subtitle={member?.relationship ?? undefined}
      action={
        <Button asChild variant="secondary" size="lg" className="h-12">
          <Link to="/family">
            <ArrowLeft className="size-5" aria-hidden /> Back
          </Link>
        </Button>
      }
    >
      <div className="space-y-4 pb-8">
        <section className="bg-card shadow-card rounded-3xl p-5">
          <h2 className="text-xl">Special dates</h2>
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
                      {age ? ` · turning ${age}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold">{relativeDay(when)}</span>
                </li>
              );
            })}
            {(data?.dates.length ?? 0) === 0 ? (
              <li className="text-muted-foreground text-sm">No dates yet.</li>
            ) : null}
          </ul>
          <AddDateForm memberId={memberId} memberName={member?.full_name ?? ""} onSaved={refresh} />
        </section>

        {member ? (
          <section className="bg-card shadow-card rounded-3xl p-5">
            <h2 className="text-xl">What makes them happy</h2>
            {member.likes.length === 0 && member.music_genres.length === 0 && !member.gift_hints ? (
              <p className="text-muted-foreground mt-2 text-sm">Nothing noted yet.</p>
            ) : null}
            {member.likes.length > 0 ? (
              <div className="mt-3">
                <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                  Likes
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
                  Music
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
                <span className="font-semibold">Gift hints: </span>
                {member.gift_hints}
              </p>
            ) : null}
            <Button asChild size="lg" className="mt-5 h-13 w-full text-base">
              <Link to="/market">
                <Gift className="size-5" aria-hidden /> Find a gift nearby
              </Link>
            </Button>
          </section>
        ) : null}

        <section className="bg-card shadow-card rounded-3xl p-5">
          <h2 className="text-xl">Wishlist</h2>
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
                    aria-label={`Remove ${w.title}`}
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
              <li className="text-muted-foreground text-sm">No wishes added yet.</li>
            ) : null}
          </ul>
          <AddWishForm memberId={memberId} onSaved={refresh} />
        </section>
      </div>
    </AppShell>
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
  const [kind, setKind] = useState<SpecialDateKind>("anniversary");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  return (
    <form
      className="mt-4 space-y-3 border-t pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!date) {
          toast.error("Pick a date");
          return;
        }
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;
        const finalTitle =
          title.trim().slice(0, 120) ||
          `${memberName}'s ${SPECIAL_DATE_KINDS.find((k) => k.value === kind)?.label.toLowerCase()}`;
        const { error } = await supabase.from("special_dates").insert({
          user_id: userId,
          family_member_id: memberId,
          kind,
          title: finalTitle,
          event_date: date,
          recurring: kind !== "exam",
        });
        if (error) {
          toast.error("Could not save that date.");
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
        toast.success("Date added");
        onSaved();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="sd-kind" className="text-sm">
            Occasion
          </Label>
          <Select value={kind} onValueChange={(v) => setKind(v as SpecialDateKind)}>
            <SelectTrigger id="sd-kind" className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPECIAL_DATE_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.emoji} {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sd-date" className="text-sm">
            Date
          </Label>
          <Input
            id="sd-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12"
          />
        </div>
      </div>
      <Input
        aria-label="Title"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Wedding anniversary (optional)"
        className="h-12"
      />
      <Button type="submit" variant="secondary" className="h-12 w-full">
        <Plus className="size-4" aria-hidden /> Add date
      </Button>
    </form>
  );
}

function AddWishForm({ memberId, onSaved }: { memberId: string; onSaved: () => void }) {
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
          toast.error("Could not add that wish.");
          return;
        }
        setTitle("");
        setPrice("");
        onSaved();
      }}
    >
      <Input
        aria-label="Wishlist item"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Noise-cancelling headphones"
        className="h-12 flex-1"
      />
      <Input
        aria-label="Approximate price in rupees"
        value={price}
        inputMode="numeric"
        maxLength={7}
        onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
        placeholder="₹"
        className="h-12 w-24"
      />
      <Button type="submit" variant="secondary" className="h-12">
        Add
      </Button>
    </form>
  );
}
