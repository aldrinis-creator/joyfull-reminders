import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Gift, MessageCircleHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GreetingComposer } from "@/components/GreetingComposer";
import { cn } from "@/lib/utils";
import {
  categoryMeta,
  formatDateTime,
  relativeDay,
  type FamilyMember,
  type Reminder,
} from "@/lib/ereminder";

export function ReminderCard({
  reminder,
  occurrence,
  onComplete,
  memberName,
  member,
}: {
  reminder: Reminder;
  occurrence: Date;
  onComplete?: ((r: Reminder) => void) | undefined;
  memberName?: string | undefined;
  member?: FamilyMember | undefined;
}) {
  const meta = categoryMeta(reminder.category);
  const isGiftable = reminder.category === "personal_family";
  const [composerOpen, setComposerOpen] = useState(false);
  const occasion = /anniversar/i.test(reminder.title)
    ? "anniversary"
    : /exam/i.test(reminder.title)
      ? "exam"
      : "birthday";

  return (
    <article
      className="bg-card shadow-card relative overflow-hidden rounded-3xl p-4 pl-6"
      style={{ borderLeft: `8px solid ${meta.colorVar}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: meta.colorVar }}
          >
            {meta.emoji} {meta.short}
          </span>
          <h3 className={cn("mt-2 text-xl", reminder.completed && "line-through opacity-60")}>
            {reminder.title}
          </h3>
          {memberName ? (
            <p className="text-muted-foreground text-sm font-semibold">for {memberName}</p>
          ) : null}
          <p className="text-muted-foreground mt-1 text-sm">{formatDateTime(occurrence)}</p>
          {reminder.description ? (
            <p className="text-foreground/80 mt-2 text-sm">{reminder.description}</p>
          ) : null}
        </div>
        <span
          className="shrink-0 rounded-2xl px-3 py-2 text-center text-xs font-bold"
          style={{ backgroundColor: `color-mix(in oklab, ${meta.colorVar} 15%, transparent)` }}
        >
          {relativeDay(occurrence)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {onComplete && !reminder.completed ? (
          <Button size="sm" variant="secondary" className="h-11" onClick={() => onComplete(reminder)}>
            <Check className="size-4" aria-hidden /> Mark done
          </Button>
        ) : null}
        {member && member.greetings_enabled ? (
          <Button
            size="sm"
            variant="outline"
            className="h-11"
            onClick={() => setComposerOpen(true)}
          >
            <MessageCircleHeart className="size-4" aria-hidden /> Send greeting
          </Button>
        ) : null}
        {isGiftable ? (
          <Button asChild size="sm" variant="outline" className="h-11">
            <Link
              to="/market"
              search={{ pin: member?.pincode ?? undefined, for: member?.id }}
            >
              <Gift className="size-4" aria-hidden /> Send a gift
            </Link>
          </Button>
        ) : null}
      </div>

      {member ? (
        <GreetingComposer
          member={member}
          open={composerOpen}
          onOpenChange={setComposerOpen}
          occasion={occasion}
          reminderId={reminder.id}
        />
      ) : null}
    </article>
  );
}
