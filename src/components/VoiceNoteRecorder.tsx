import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, RotateCcw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadGreetingVoiceNote } from "@/lib/greetings.functions";
import { useT } from "@/hooks/useLanguage";

/** Hard cap — recording stops itself the instant it is reached. */
export const MAX_SECONDS = 100;

type Saved = { path: string; seconds: number };

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function VoiceNoteRecorder({
  value,
  onChange,
}: {
  value: Saved | null;
  onChange: (next: Saved | null) => void;
}) {
  const t = useT();
  const upload = useServerFn(uploadGreetingVoiceNote);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function startRecording() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    secondsRef.current = 0;
    setElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTimer();
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setElapsed(secondsRef.current);
        // Hard stop at the cap.
        if (secondsRef.current >= MAX_SECONDS) {
          stopRecording();
          toast.info(t("family.voiceCapReached"));
        }
      }, 1000);
    } catch {
      toast.error(t("family.voiceMicDenied"));
    }
  }

  function stopRecording() {
    stopTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function saveRecording() {
    const blob = blobRef.current;
    if (!blob) return;
    setBusy(true);
    try {
      const result = await upload({
        data: {
          audioBase64: await blobToBase64(blob),
          mimeType: blob.type || "audio/webm",
          seconds: Math.max(1, Math.min(MAX_SECONDS, secondsRef.current)),
        },
      });
      if (result.ok) {
        onChange({ path: result.path, seconds: result.seconds });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        blobRef.current = null;
        toast.success(t("family.voiceSaved"));
      } else {
        toast.error(result.detail);
      }
    } catch {
      toast.error(t("family.voiceUploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  function discardPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    secondsRef.current = 0;
    setElapsed(0);
  }

  return (
    <div className="space-y-2">
      <Label>{t("family.voiceTitle")}</Label>
      <div className="border-border space-y-3 rounded-2xl border p-3">
        {value ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold">
              {t("family.voiceAttached", { seconds: value.seconds })}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => onChange(null)}
            >
              <Trash2 className="size-4" aria-hidden /> {t("family.voiceRemove")}
            </Button>
          </div>
        ) : previewUrl ? (
          <div className="space-y-3">
            <audio className="w-full" controls src={previewUrl} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="h-11" disabled={busy} onClick={saveRecording}>
                {busy ? t("family.voiceSaving") : t("family.voiceSave")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={busy}
                onClick={discardPreview}
              >
                <RotateCcw className="size-4" aria-hidden /> {t("family.voiceReRecord")}
              </Button>
            </div>
          </div>
        ) : recording ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-destructive text-lg font-bold tabular-nums" role="timer">
              {fmt(elapsed)} / {fmt(MAX_SECONDS)}
            </span>
            <Button type="button" variant="outline" className="h-11" onClick={stopRecording}>
              <Square className="size-4" aria-hidden /> {t("family.voiceStop")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button type="button" variant="outline" className="h-11" onClick={startRecording}>
              <Mic className="size-4" aria-hidden /> {t("family.voiceRecord")}
            </Button>
            <p className="text-muted-foreground text-sm">{t("family.voiceHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
