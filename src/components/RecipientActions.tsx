import { useState } from "react";
import { MessageCircle, MessageCircleHeart, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GreetingComposer } from "@/components/GreetingComposer";
import { ReminderGreetingStatus } from "@/components/ReminderGreetingStatus";
import { useT } from "@/hooks/useLanguage";
import type { FamilyMember, Reminder } from "@/lib/ereminder";

/** Digits only, with the Indian country code added when it is missing. */
export function dialNumber(member: FamilyMember): string | null {
  const raw = (member.whatsapp_phone ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.length === 10 ? `91${digits}` : digits;
}

/** True for occasions where calling the person makes sense. */
export function isWishingReminder(reminder: Reminder): boolean {
  return reminder.category === "personal_family" || Boolean(reminder.occasion_kind);
}

function occasionFor(reminder: Reminder): string {
  if (/anniversar/i.test(reminder.title)) return "anniversary";
  if (/exam/i.test(reminder.title)) return "exam";
  return reminder.occasion_kind ?? "birthday";
}

/** Call / WhatsApp chat shortcuts for one person. */
export function CallButtons({
  member,
  tone = "default",
}: {
  member: FamilyMember;
  tone?: "default" | "onDark";
}) {
  const t = useT();
  const number = dialNumber(member);
  if (!number) return null;
  const className =
    tone === "onDark"
      ? "text-indigo-foreground h-11 border-white/40 bg-transparent hover:bg-white/10"
      : "h-11";

  return (
    <>
      <Button asChild size="sm" variant="outline" className={className}>
        <a href={`tel:+${number}`}>
          <Phone className="size-4" aria-hidden /> {t("home.call")}
        </a>
      </Button>
      <Button asChild size="sm" variant="outline" className={className}>
        <a
          href={`https://wa.me/${number}`}
          target="_blank"
          rel="noopener noreferrer"
          title={t("home.whatsappHint")}
        >
          <MessageCircle className="size-4" aria-hidden /> {t("home.whatsappChat")}
        </a>
      </Button>
    </>
  );
}

/**
 * One row per designated recipient: their name, a greeting composer trigger,
 * the greeting delivery status and call / WhatsApp shortcuts.
 */
export function RecipientRow({
  reminder,
  occurrence,
  member,
  showName,
}: {
  reminder: Reminder;
  occurrence: Date;
  member: FamilyMember;
  showName: boolean;
}) {
  const t = useT();
  const [composerOpen, setComposerOpen] = useState(false);
  const wishing = isWishingReminder(reminder);

  return (
    <div className="space-y-2">
      {showName ? <p className="text-sm font-bold">{member.full_name}</p> : null}
      <div className="flex flex-wrap gap-2">
        {member.greetings_enabled ? (
          <Button size="sm" variant="outline" className="h-11" onClick={() => setComposerOpen(true)}>
            <MessageCircleHeart className="size-4" aria-hidden /> {t("home.sendGreeting")}
          </Button>
        ) : null}
        {wishing ? <CallButtons member={member} /> : null}
      </div>

      {member.greetings_enabled ? (
        <ReminderGreetingStatus reminderId={reminder.id} member={member} />
      ) : null}

      <GreetingComposer
        member={member}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        occasion={occasionFor(reminder)}
        reminderId={reminder.id}
        scheduleDefault={occurrence}
      />
    </div>
  );
}

/** The whole recipient block for a reminder. */
export function RecipientList({
  reminder,
  occurrence,
  recipients,
}: {
  reminder: Reminder;
  occurrence: Date;
  recipients: FamilyMember[];
}) {
  const t = useT();
  if (recipients.length === 0) return null;
  const multiple = recipients.length > 1;

  return (
    <div className="mt-4 space-y-3 border-t pt-3">
      {multiple ? (
        <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          {t("home.recipients", { count: recipients.length })}
        </p>
      ) : null}
      {recipients.map((m) => (
        <RecipientRow
          key={m.id}
          reminder={reminder}
          occurrence={occurrence}
          member={m}
          showName={multiple}
        />
      ))}
    </div>
  );
}
