import { useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { PhotoCapture, type CapturedPhoto } from "@/components/PhotoCapture";
import { useLanguage, useT } from "@/hooks/useLanguage";
import { parseDocumentScan } from "@/lib/document-scan.functions";
import type { ParsedReminder } from "@/lib/voice-reminder.schemas";

type Status = "idle" | "processing" | "done" | "error";

/** Photograph a bill/document (up to 10 pages/sides) and let the AI prefill the fields. */
export function DocumentScanButton({ onParsed }: { onParsed: (parsed: ParsedReminder) => void }) {
  const t = useT();
  const { language } = useLanguage();
  const scan = useServerFn(parseDocumentScan);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorKey, setErrorKey] = useState("reminders.scanError");

  async function run() {
    if (!photos.length) return;
    setStatus("processing");
    try {
      const images = photos.map((p) => ({
        imageBase64: p.dataUrl.split(",")[1] ?? "",
        mimeType: "image/jpeg" as const,
      }));
      if (images.some((i) => !i.imageBase64)) throw new Error("empty image");

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
        now.getHours(),
      )}:${pad(now.getMinutes())}`;

      const result = await scan({ data: { images, localNow, language } });
      if (!result.ok) {
        setErrorKey(result.reason === "unclear" ? "reminders.scanUnclear" : "reminders.scanError");
        setStatus("error");
        return;
      }
      onParsed(result.reminder);
      setStatus("done");
    } catch {
      setErrorKey("reminders.scanError");
      setStatus("error");
    }
  }

  const processing = status === "processing";

  return (
    <section className="bg-card shadow-card rounded-3xl p-5" aria-live="polite">
      <p className="font-semibold">{t("reminders.scanTitle")}</p>
      <p className="text-muted-foreground mt-1 text-sm">{t("reminders.scanHint")}</p>

      <div className="mt-4">
        <PhotoCapture photos={photos} onChange={setPhotos} buttonLabel={t("reminders.scanAddPhotos")} />
      </div>

      <Button
        type="button"
        size="lg"
        variant="secondary"
        className="mt-3 h-14 w-full text-base"
        disabled={processing || photos.length === 0}
        onClick={() => void run()}
      >
        {processing ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden /> {t("reminders.scanProcessing")}
          </>
        ) : status === "error" ? (
          <>
            <ScanLine className="size-5" aria-hidden /> {t("reminders.scanRetry")}
          </>
        ) : (
          <>
            <ScanLine className="size-5" aria-hidden /> {t("reminders.scanStart")}
          </>
        )}
      </Button>

      {status === "done" ? (
        <p className="text-success mt-2 text-sm font-semibold">{t("reminders.scanFilled")}</p>
      ) : null}
      {status === "error" ? (
        <p className="text-destructive mt-2 text-sm font-semibold">{t(errorKey)}</p>
      ) : null}
    </section>
  );
}
