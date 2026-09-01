import { Mail, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useLanguage";
import { formatDateTime, type Reminder } from "@/lib/ereminder";

/**
 * Share a reminder as plain text. Native share sheet when available,
 * with WhatsApp and Email always offered so desktop users aren't stuck.
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

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <>
      {canNativeShare ? (
        <Button
          size="sm"
          variant="outline"
          className="h-11"
          onClick={async () => {
            try {
              await navigator.share({ title: subject, text });
            } catch (error) {
              if ((error as { name?: string })?.name === "AbortError") return;
              toast.error(t("home.shareFailed"));
            }
          }}
        >
          <Share2 className="size-4" aria-hidden /> {t("home.shareNative")}
        </Button>
      ) : null}

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
