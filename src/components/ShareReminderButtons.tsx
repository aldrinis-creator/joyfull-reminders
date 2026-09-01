import { Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useLanguage";
import { formatDateTime, type Reminder } from "@/lib/ereminder";

/**
 * Share a reminder as plain text via WhatsApp and Email — always shown,
 * regardless of device or native share sheet support.
 */
export function ShareReminderButtons({
  reminder,
  occurrence,
}: {
  reminder: Reminder;
  occurrence: Date;
}) {
  const t = useT();
  const when = formatDateTime(occurrence);
  const notes = reminder.description?.trim();
  const text = notes
    ? t("home.shareTextWithNotes", { title: reminder.title, when, notes })
    : t("home.shareText", { title: reminder.title, when });
  const subject = t("home.shareSubject", { title: reminder.title });

  return (
    <>
      <Button asChild size="sm" variant="outline" className="h-11">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="size-4" aria-hidden /> {t("home.shareWhatsApp")}
        </a>
      </Button>

      <Button asChild size="sm" variant="outline" className="h-11">
        <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}>
          <Mail className="size-4" aria-hidden /> {t("home.shareEmail")}
        </a>
      </Button>
    </>
  );
}
