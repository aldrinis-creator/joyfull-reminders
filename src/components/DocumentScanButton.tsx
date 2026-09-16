import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, ScanLine, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cropToJpeg, MAX_PHOTOS, type CapturedPhoto } from "@/components/PhotoCapture";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage, useT } from "@/hooks/useLanguage";
import { parseDocumentScan } from "@/lib/document-scan.functions";
import { categoryMeta, type ReminderCategory } from "@/lib/ereminder";
import type { ParsedReminder } from "@/lib/voice-reminder.schemas";

type Step = "closed" | "capture" | "processing" | "confirm" | "saved";

/** Editable rows shown on the confirm sheet — only fields the scan really returned. */
type FieldKey = "title" | "date" | "time" | "upiPayeeName" | "paymentAmount" | "vehicleNumber" | "institution";

const FIELD_ORDER: FieldKey[] = [
  "title",
  "vehicleNumber",
  "institution",
  "upiPayeeName",
  "paymentAmount",
  "date",
  "time",
];

function daysFromToday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** How many documents are already on the shelf, for the saved-state line. */
function useDocumentCount(enabled: boolean) {
  return useQuery({
    queryKey: ["documents_count"],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Photograph a bill/document (up to 10 pages/sides) and let the AI prefill the fields. */
export function DocumentScanButton({
  onParsed,
  variant = "card",
  triggerLabel,
}: {
  onParsed: (parsed: ParsedReminder) => void;
  /** "card" is the explainer card used inside the reminder form; "bare" is a single pill. */
  variant?: "card" | "bare";
  triggerLabel?: string;
}) {
  const t = useT();
  const { language } = useLanguage();
  const locale = language === "hi" ? "hi-IN" : "en-IN";
  const scan = useServerFn(parseDocumentScan);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("closed");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [draft, setDraft] = useState<ParsedReminder | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { data: documentCount } = useDocumentCount(step === "saved");

  function reset() {
    setPhotos([]);
    setDraft(null);
    setErrorKey(null);
  }

  async function addFiles(files: File[]) {
    const room = MAX_PHOTOS - photos.length;
    const usable = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (!usable.length) return;
    const captured = await Promise.all(
      usable.map((f) => cropToJpeg(f, { x: 0, y: 0, w: 1, h: 1 })),
    );
    const next = [...photos, ...captured];
    setPhotos(next);
    void run(next);
  }

  async function run(shots: CapturedPhoto[]) {
    if (!shots.length) return;
    setErrorKey(null);
    setStep("processing");
    try {
      const images = shots.map((p) => ({
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
        setStep("capture");
        return;
      }
      setDraft(result.reminder);
      setStep("confirm");
    } catch {
      setErrorKey("reminders.scanError");
      setStep("capture");
    }
  }

  function setField(key: FieldKey, value: string) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            [key]: key === "paymentAmount" ? (value === "" ? null : Number(value)) : value,
          }
        : prev,
    );
  }

  function save() {
    if (!draft) return;
    onParsed(draft);
    setStep("saved");
  }

  const categoryLabel = draft?.category
    ? t(`cat.${categoryMeta(draft.category as ReminderCategory).value}`)
    : t("cat.custom");

  const expiryDays = draft?.date ? daysFromToday(draft.date) : null;
  const expiryText = draft?.date
    ? `${new Date(draft.date).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })} · ${
        expiryDays === null
          ? ""
          : expiryDays === 0
            ? t("scan.today")
            : expiryDays > 0
              ? t("scan.inDays", { count: expiryDays })
              : t("scan.daysAgo", { count: Math.abs(expiryDays) })
      }`
    : "";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const chosen = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addFiles(chosen);
        }}
      />

      {variant === "bare" ? (
        <button
          type="button"
          onClick={() => {
            reset();
            setStep("capture");
          }}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-[var(--accent-400)] text-[15px] font-semibold text-[var(--accent-700)]"
        >
          {triggerLabel ?? t("reminders.scanStart")}
        </button>
      ) : (
        <section className="bg-card shadow-card rounded-3xl p-5">
          <p className="font-semibold">{t("reminders.scanTitle")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("reminders.scanHint")}</p>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="mt-3 h-14 w-full text-base"
            onClick={() => {
              reset();
              setStep("capture");
            }}
          >
            <ScanLine className="size-5" aria-hidden /> {t("reminders.scanStart")}
          </Button>
        </section>
      )}

      {step === "capture" || step === "processing" ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[var(--neutral-900)]"
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          aria-label={t("scan.captureTitle")}
        >
          <header className="flex items-center gap-3 px-[22px] py-5">
            <button
              type="button"
              aria-label={t("scan.close")}
              onClick={() => {
                reset();
                setStep("closed");
              }}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[rgba(245,234,216,.3)] text-[var(--neutral-100)]"
            >
              <X className="size-5" aria-hidden />
            </button>
            <p className="text-[15px] font-semibold text-[var(--neutral-100)]">
              {t("scan.captureTitle")}
            </p>
          </header>

          <div className="px-[22px]">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[26px] bg-[var(--neutral-800)]">
              {(
                [
                  "top-[34px] left-[34px] rounded-tl-[18px] border-t-4 border-l-4",
                  "top-[34px] right-[34px] rounded-tr-[18px] border-t-4 border-r-4",
                  "bottom-[34px] left-[34px] rounded-bl-[18px] border-b-4 border-l-4",
                  "bottom-[34px] right-[34px] rounded-br-[18px] border-r-4 border-b-4",
                ] as const
              ).map((pos) => (
                <span
                  key={pos}
                  aria-hidden
                  className={`absolute size-[42px] border-[var(--accent-300)] ${pos}`}
                />
              ))}
              {step === "processing" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--neutral-100)]">
                  <Loader2 className="size-8 animate-spin" aria-hidden />
                  <p className="text-sm font-semibold">{t("reminders.scanProcessing")}</p>
                </div>
              ) : null}
            </div>
          </div>

          <p className="mt-5 px-[22px] text-[14px] text-[var(--neutral-100)]/75">
            {t("scan.captureHint")}
          </p>
          {errorKey ? (
            <p className="mt-2 px-[22px] text-[14px] font-semibold text-[var(--accent-300)]">
              {t(errorKey)}
            </p>
          ) : null}

          <div className="mt-auto flex flex-col items-center gap-3 pt-6 pb-10">
            <button
              type="button"
              aria-label={t("scan.shutter")}
              disabled={step === "processing"}
              onClick={() => inputRef.current?.click()}
              className="size-[78px] rounded-full bg-[var(--neutral-100)] ring-5 ring-[rgba(245,234,216,.35)] disabled:opacity-60"
            />
            <p className="text-[12px] text-[var(--neutral-100)]/60">
              {t("scan.shutterHint", { max: MAX_PHOTOS })}
            </p>
          </div>
        </div>
      ) : null}

      {step === "confirm" && draft ? (
        <div
          className="bg-background fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={t("scan.confirmKicker")}
        >
          <div className="mx-auto flex min-h-full max-w-2xl flex-col px-[22px] py-6">
            <div className="flex items-center gap-3">
              <Check
                className="animate-mm-pop size-9 text-[var(--accent-2-700)]"
                strokeWidth={3}
                aria-hidden
              />
              <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--accent-2-700)] uppercase">
                {t("scan.confirmKicker")}
              </p>
            </div>

            <h2 className="mt-3 text-[27px] leading-tight">{draft.title ?? categoryLabel}</h2>
            <p className="text-muted-foreground mt-1.5 text-[14.5px]">{t("scan.confirmBody")}</p>

            <div className="bg-card shadow-card mt-5 rounded-[28px] p-5">
              <ul className="divide-y divide-border">
                {FIELD_ORDER.filter((key) => {
                  const value = draft[key];
                  return key === "title" || key === "date" || (value !== null && value !== undefined && value !== "");
                }).map((key) => {
                  const isExpiry = key === "date";
                  const raw = draft[key];
                  return (
                    <li key={key} className="py-3 first:pt-0 last:pb-0">
                      <label
                        className="text-foreground/50 text-[11px] font-semibold tracking-[0.08em] uppercase"
                        htmlFor={`scan-${key}`}
                      >
                        {t(`scan.field.${key}`)}
                      </label>
                      <Input
                        id={`scan-${key}`}
                        type={
                          key === "date"
                            ? "date"
                            : key === "time"
                              ? "time"
                              : key === "paymentAmount"
                                ? "number"
                                : "text"
                        }
                        value={raw === null || raw === undefined ? "" : String(raw)}
                        onChange={(e) => setField(key, e.target.value)}
                        className={`mt-1 h-12 border-0 bg-transparent px-0 text-[17px] font-semibold shadow-none focus-visible:ring-0 ${
                          isExpiry ? "text-[var(--accent-700)]" : ""
                        }`}
                      />
                      {isExpiry && expiryText ? (
                        <p className="text-[13px] font-semibold text-[var(--accent-700)]">
                          {expiryText}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 rounded-3xl bg-[var(--accent-2-100)] p-5">
              <p className="text-[13.5px] text-[var(--accent-2-800)]">
                {t("scan.nextSteps", {
                  category: categoryLabel,
                  date: draft.date
                    ? new Date(draft.date).toLocaleDateString(locale, {
                        day: "numeric",
                        month: "long",
                      })
                    : t("scan.theDueDate"),
                })}
              </p>
            </div>

            <div className="mt-auto flex gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                className="h-[54px] px-6"
                onClick={() => {
                  reset();
                  setStep("capture");
                }}
              >
                {t("scan.retake")}
              </Button>
              <Button type="button" className="h-[54px] flex-1 text-base" onClick={save}>
                {t("scan.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "saved" ? (
        <div
          className="bg-background fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={t("scan.savedTitle")}
        >
          <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-[22px] py-10 text-center">
            <Check
              className="animate-mm-pop size-[86px] text-[var(--accent-2-600)]"
              strokeWidth={2.5}
              aria-hidden
            />
            <h2 className="mt-5 text-[28px]">{t("scan.savedTitle")}</h2>
            <p className="text-foreground/62 mt-3 text-[15px]">
              {t("scan.savedBody", {
                title: draft?.title ?? categoryLabel,
                date: draft?.date
                  ? new Date(draft.date).toLocaleDateString(locale, {
                      day: "numeric",
                      month: "short",
                    })
                  : t("scan.theDueDate"),
                count: documentCount ?? 0,
              })}
            </p>
            <div className="mt-7 flex w-full flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-[52px] w-full"
                onClick={() => {
                  reset();
                  setStep("capture");
                }}
              >
                {t("scan.scanAnother")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-[52px] w-full"
                onClick={() => {
                  reset();
                  setStep("closed");
                }}
              >
                {t("scan.done")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
