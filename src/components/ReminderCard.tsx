import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Check, Gift, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { RecipientList } from "@/components/RecipientActions";
import { PayNowButtons } from "@/components/PayNowButtons";
import { ShareReminderButtons } from "@/components/ShareReminderButtons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { buildIcs } from "@/lib/ics";
import { paymentTarget } from "@/lib/pay-link";
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
  recipients,
  tone = "default",
}: {
  reminder: Reminder;
  occurrence: Date;
  onComplete?: ((r: Reminder) => void) | undefined;
  onDelete?: ((r: Reminder) => void) | undefined;
  memberName?: string | undefined;
  member?: FamilyMember | undefined;
  /** Everyone linked through reminder_recipients — source of truth when present. */
  recipients?: FamilyMember[] | undefined;
  tone?: "default" | "overdue" | undefined;
}) {
  const t = useT();
  const meta = categoryMeta(reminder.category);
  const isGiftable = reminder.category === "personal_family";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const people = recipients && recipients.length ? recipients : member ? [member] : [];
  const giftMember = people[0] ?? member;
  const hasPayment = Boolean(paymentTarget(reminder));

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
      className={cn(
        "shadow-card relative overflow-hidden rounded-[26px] p-5",
        tone === "overdue" ? "bg-accent-800 text-primary-foreground" : isGiftable ? "bg-accent-100" : "bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold uppercase", tone === "overdue" ? "text-primary-foreground/75" : "text-muted-foreground")}>
            {meta.emoji} {categoryShortLabel(reminder.category)}
          </span>
          <h3
            className={cn(
              "mt-1 text-[16.5px] font-semibold",
              tone === "overdue" ? "text-primary-foreground" : isGiftable && "text-accent-900",
              reminder.completed && "line-through opacity-60",
            )}
          >
            {reminder.title}
          </h3>
          {memberName ? (
            <p className={cn("text-sm font-semibold", tone === "overdue" ? "text-primary-foreground/75" : "text-muted-foreground")}>{t("home.forMember", { name: memberName })}</p>
          ) : null}
          <p className={cn("mt-1 text-[12.5px]", tone === "overdue" ? "text-primary-foreground/75" : "text-muted-foreground")}>{formatDateTime(occurrence)}</p>
          {reminder.description ? (
            <p className={cn("mt-2 text-sm", tone === "overdue" ? "text-primary-foreground/85" : "text-foreground/80")}>{reminder.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={cn("hidden text-[11px] font-semibold sm:block", tone === "overdue" ? "text-primary-foreground/75" : "text-muted-foreground")}>
            {relativeDay(occurrence)}
          </span>
          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className={cn("size-11 rounded-full", tone === "overdue" && "text-primary-foreground hover:bg-primary-foreground/10")} aria-label={t("home.moreActions")}>
                <MoreHorizontal className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[28px] border-border bg-background px-[22px] pb-8 shadow-lg">
              <SheetHeader className="pr-10 text-left">
                <SheetTitle>{t("home.actionsTitle", { title: reminder.title })}</SheetTitle>
              </SheetHeader>
              <div className="mt-5 grid gap-3">
                {hasPayment ? <PayNowButtons shortcut={{ ...reminder, title: reminder.title }} showCopy /> : null}
                <Button variant="outline" className="h-12 justify-start" onClick={downloadIcs}>
                  <CalendarPlus className="size-4" aria-hidden /> {t("home.addToCalendar")}
                </Button>
                <div className="flex flex-wrap gap-2">
                  <ShareReminderButtons reminder={reminder} occurrence={occurrence} />
                </div>
                <Button asChild variant="outline" className="h-12 justify-start">
                  <Link to="/reminders/$reminderId/edit" params={{ reminderId: reminder.id }}>
                    <Pencil className="size-4" aria-hidden /> {t("home.edit")}
                  </Link>
                </Button>
                {onDelete ? (
                  <Button
                    variant="outline"
                    className="text-destructive h-12 justify-start"
                    onClick={() => {
                      setActionsOpen(false);
                      setConfirmDelete(true);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden /> {t("home.delete")}
                  </Button>
                ) : null}
                {isGiftable ? (
                  <Button asChild variant="outline" className="h-12 justify-start">
                    <Link to="/market" search={{ pin: giftMember?.pincode ?? undefined, for: giftMember?.id }}>
                      <Gift className="size-4" aria-hidden /> {t("home.sendGift")}
                    </Link>
                  </Button>
                ) : null}
                <RecipientList reminder={reminder} occurrence={occurrence} recipients={people} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className={cn("mt-4 flex items-center gap-3", isGiftable && "flex-wrap")}>
        {hasPayment ? (
          <div className="min-w-0 flex-1"><PayNowButtons shortcut={{ ...reminder, title: reminder.title }} showCopy={false} tone={tone === "overdue" ? "onDark" : "default"} /></div>
        ) : isGiftable ? (
          <Button asChild className="order-2 h-[46px] w-full">
            <Link to="/market" search={{ pin: giftMember?.pincode ?? undefined, for: giftMember?.id }}>
              <Gift className="size-4" aria-hidden /> {t("home.sendGift")}
            </Link>
          </Button>
        ) : <span className="flex-1" />}
        {onComplete && !reminder.completed ? (
          <Button
            size="icon"
            variant="outline"
            className={cn(
              "size-[46px] shrink-0 rounded-full border-[1.5px]",
              isGiftable && !hasPayment && "order-1 ml-auto",
              tone === "overdue"
                ? "border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                : isGiftable
                  ? "border-accent-400 text-accent-700"
                  : "border-accent-2-400 text-accent-2-700",
            )}
            onClick={() => onComplete(reminder)}
            aria-label={t("home.markDone")}
          >
            <Check className="size-5" aria-hidden />
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

    </article>
  );
}
