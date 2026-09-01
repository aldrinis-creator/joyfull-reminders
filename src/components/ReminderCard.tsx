import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Check, Gift, MessageCircleHeart, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GreetingComposer } from "@/components/GreetingComposer";
import { PayNowButtons } from "@/components/PayNowButtons";
import { cn } from "@/lib/utils";
import { buildIcs } from "@/lib/ics";
import { useT } from "@/hooks/useLanguage";

import {
  categoryLabel,
  categoryShortLabel,
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
  onDelete,
  memberName,
  member,
}: {
  reminder: Reminder;
  occurrence: Date;
  onComplete?: ((r: Reminder) => void) | undefined;
  onDelete?: ((r: Reminder) => void) | undefined;
  memberName?: string | undefined;
  member?: FamilyMember | undefined;
}) {
  const t = useT();
  const meta = categoryMeta(reminder.category);
  const isGiftable = reminder.category === "personal_family";
  const [composerOpen, setComposerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const occasion = /anniversar/i.test(reminder.title)
    ? "anniversary"
    : /exam/i.test(reminder.title)
      ? "exam"
      : "birthday";

  function downloadIcs() {
    const ics = buildIcs({
      name: reminder.title,
      events: [
        {
          uid: `reminder-${reminder.id}-${occurrence.getTime()}@ereminder`,
          start: occurrence,
          durationMinutes: 30,
          summary: `${meta.emoji} ${reminder.title}`,
          description: [categoryLabel(reminder.category), reminder.description].filter(Boolean).join(" — "),
        },
      ],
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reminder.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "reminder"}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

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
            {meta.emoji} {categoryShortLabel(reminder.category)}
          </span>
          <h3 className={cn("mt-2 text-xl", reminder.completed && "line-through opacity-60")}>
            {reminder.title}
          </h3>
          {memberName ? (
            <p className="text-muted-foreground text-sm font-semibold">{t("home.forMember", { name: memberName })}</p>
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
            <Check className="size-4" aria-hidden /> {t("home.markDone")}
          </Button>
        ) : null}
        {member && member.greetings_enabled ? (
          <Button
            size="sm"
            variant="outline"
            className="h-11"
            onClick={() => setComposerOpen(true)}
          >
            <MessageCircleHeart className="size-4" aria-hidden /> {t("home.sendGreeting")}
          </Button>
        ) : null}
        <PayNowButtons shortcut={{ ...reminder, title: reminder.title }} />
        <Button size="sm" variant="outline" className="h-11" onClick={downloadIcs}>
          <CalendarPlus className="size-4" aria-hidden /> {t("home.addToCalendar")}
        </Button>
        <ShareReminderButtons reminder={reminder} occurrence={occurrence} />


        <Button asChild size="sm" variant="outline" className="h-11">
          <Link to="/reminders/$reminderId/edit" params={{ reminderId: reminder.id }}>
            <Pencil className="size-4" aria-hidden /> {t("home.edit")}
          </Link>
        </Button>
        {onDelete ? (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive h-11"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" aria-hidden /> {t("home.delete")}
          </Button>
        ) : null}

        {isGiftable ? (
          <Button asChild size="sm" variant="outline" className="h-11">
            <Link
              to="/market"
              search={{ pin: member?.pincode ?? undefined, for: member?.id }}
            >
              <Gift className="size-4" aria-hidden /> {t("home.sendGift")}
            </Link>
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("home.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("home.deleteBody", { title: reminder.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete?.(reminder)}>
              {t("home.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
