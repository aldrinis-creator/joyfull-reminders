import { useRef, useState } from "react";
import { Camera, Loader2, ScanLine } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useLanguage, useT } from "@/hooks/useLanguage";
import { parseDocumentScan } from "@/lib/document-scan.functions";
import type { ParsedReminder } from "@/lib/voice-reminder.schemas";

type Status = "idle" | "processing" | "done" | "error";

const MAX_EDGE = 1600;

/** Downscales to a JPEG data URL so the upload stays small. */
async function compress(file: File): Promise<{ base64: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
  return { base64: dataUrl.split(",")[1] ?? "", preview: dataUrl };
}

/** Photograph a bill/document and let the AI prefill the reminder fields. */
export function DocumentScanButton({ onParsed }: { onParsed: (parsed: ParsedReminder) => void }) {
  const t = useT();
  const { language } = useLanguage();
  const scan = useServerFn(parseDocumentScan);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorKey, setErrorKey] = useState("reminders.scanError");
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorKey("reminders.scanNotImage");
      setStatus("error");
      return;
    }
    setStatus("processing");
    setPreview(null);
    try {
      const { base64, preview: dataUrl } = await compress(file);
      if (!base64) throw new Error("empty image");
      setPreview(dataUrl);

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
        now.getHours(),
      )}:${pad(now.getMinutes())}`;

      const result = await scan({
        data: { imageBase64: base64, mimeType: "image/jpeg", localNow, language },
      });
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

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Button
        type="button"
        size="lg"
        variant="secondary"
        className="mt-4 h-14 w-full text-base"
        disabled={processing}
        onClick={() => inputRef.current?.click()}
      >
        {processing ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden /> {t("reminders.scanProcessing")}
          </>
        ) : status === "error" ? (
          <>
            <Camera className="size-5" aria-hidden /> {t("reminders.scanRetry")}
          </>
        ) : (
          <>
            <ScanLine className="size-5" aria-hidden /> {t("reminders.scanStart")}
          </>
        )}
      </Button>

      {preview ? (
        <img
          src={preview}
          alt={t("reminders.scanPreviewAlt")}
          className="border-border mt-3 max-h-40 w-auto rounded-xl border object-contain"
        />
      ) : null}
      {status === "done" ? (
        <p className="text-success mt-2 text-sm font-semibold">{t("reminders.scanFilled")}</p>
      ) : null}
      {status === "error" ? (
        <p className="text-destructive mt-2 text-sm font-semibold">{t(errorKey)}</p>
      ) : null}
    </section>
  );
}
