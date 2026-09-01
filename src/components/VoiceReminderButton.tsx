import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useLanguage, useT } from "@/hooks/useLanguage";
import { parseVoiceReminder } from "@/lib/voice-reminder.functions";
import type { ParsedReminder } from "@/lib/voice-reminder.schemas";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Status = "idle" | "listening" | "processing" | "done" | "error";

/** Speaks-a-reminder control. Renders nothing when the browser has no speech API. */
export function VoiceReminderButton({ onParsed }: { onParsed: (parsed: ParsedReminder) => void }) {
  const t = useT();
  const { language } = useLanguage();
  const parse = useServerFn(parseVoiceReminder);
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [heard, setHeard] = useState("");
  const [errorKey, setErrorKey] = useState("reminders.voiceError");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  if (!supported) return null;

  async function handleTranscript(transcript: string) {
    setHeard(transcript);
    if (!transcript.trim()) {
      setErrorKey("reminders.voiceNothing");
      setStatus("error");
      return;
    }
    setStatus("processing");
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
      now.getHours(),
    )}:${pad(now.getMinutes())}`;

    try {
      const result = await parse({ data: { transcript, localNow, language } });
      if (!result.ok) {
        setErrorKey(result.reason === "unclear" ? "reminders.voiceNothing" : "reminders.voiceError");
        setStatus("error");
        return;
      }
      onParsed(result.reminder);
      setStatus("done");
    } catch {
      setErrorKey("reminders.voiceError");
      setStatus("error");
    }
  }

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = language === "hi" ? "hi-IN" : "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let captured = "";
    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const alt = event.results[i]?.[0];
        if (alt) parts.push(alt.transcript);
      }
      captured = parts.join(" ").trim();
    };
    recognition.onerror = (event) => {
      const code = event.error ?? "";
      setErrorKey(
        code === "not-allowed" || code === "service-not-allowed"
          ? "reminders.voiceDenied"
          : code === "no-speech"
            ? "reminders.voiceNothing"
            : "reminders.voiceError",
      );
      setStatus("error");
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus((prev) => {
        if (prev !== "listening") return prev;
        void handleTranscript(captured);
        return "processing";
      });
    };

    setHeard("");
    setStatus("listening");
    try {
      recognition.start();
    } catch {
      setErrorKey("reminders.voiceError");
      setStatus("error");
    }
  }

  const listening = status === "listening";
  const processing = status === "processing";

  return (
    <section className="bg-card shadow-card rounded-3xl p-5" aria-live="polite">
      <p className="font-semibold">{t("reminders.voiceTitle")}</p>
      <p className="text-muted-foreground mt-1 text-sm">{t("reminders.voiceHint")}</p>

      <Button
        type="button"
        size="lg"
        variant={listening ? "destructive" : "secondary"}
        className="mt-4 h-14 w-full text-base"
        disabled={processing}
        onClick={() => {
          if (listening) {
            recognitionRef.current?.stop();
            return;
          }
          start();
        }}
      >
        {processing ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden /> {t("reminders.voiceProcessing")}
          </>
        ) : listening ? (
          <>
            <Square className="size-5" aria-hidden /> {t("reminders.voiceStop")}
          </>
        ) : status === "error" ? (
          <>
            <MicOff className="size-5" aria-hidden /> {t("reminders.voiceRetry")}
          </>
        ) : (
          <>
            <Mic className="size-5" aria-hidden /> {t("reminders.voiceStart")}
          </>
        )}
      </Button>

      {listening ? (
        <p className="text-primary mt-3 text-sm font-semibold">{t("reminders.voiceListening")}</p>
      ) : null}
      {heard && status !== "listening" ? (
        <p className="text-muted-foreground mt-3 text-sm">
          {t("reminders.voiceHeard", { text: heard })}
        </p>
      ) : null}
      {status === "done" ? (
        <p className="text-success mt-2 text-sm font-semibold">{t("reminders.voiceFilled")}</p>
      ) : null}
      {status === "error" ? (
        <p className="text-destructive mt-2 text-sm font-semibold">{t(errorKey)}</p>
      ) : null}
    </section>
  );
}
