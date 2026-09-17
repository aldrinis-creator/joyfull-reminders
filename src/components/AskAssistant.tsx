import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Mic, Send, Square, Volume2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useLanguage, useT } from "@/hooks/useLanguage";
import { askAssistant } from "@/lib/assistant.functions";
import { speakText, transcribeSpeech } from "@/lib/voice.functions";

type Message = { role: "user" | "assistant"; text: string };

/** Everything the voice loop can be doing at a given moment. */
type VoiceState = "off" | "listening" | "transcribing" | "thinking" | "speaking";

const SILENCE_MS = 3000; // pause after speech that ends the turn
const NO_SPEECH_MS = 9000; // give up if nothing is said at all
const MAX_TURN_MS = 30000;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

/** Floating "Ask My-Mitr" assistant: answers from the signed-in user's own data. */
export function AskAssistant() {
  const t = useT();
  const { language } = useLanguage();
  const ask = useServerFn(askAssistant);
  const transcribe = useServerFn(transcribeSpeech);
  const speak = useServerFn(speakText);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voice, setVoice] = useState<VoiceState>("off");
  const [micSupported, setMicSupported] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const voiceOnRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMicSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
    return () => stopEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, thinking, voice]);

  function clearTimers() {
    for (const timer of timersRef.current) clearInterval(timer);
    timersRef.current = [];
  }

  function stopEverything() {
    voiceOnRef.current = false;
    clearTimers();
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {
      /* already stopped */
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setVoice("off");
  }

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      stopEverything();
      setMessages([]);
      setDraft("");
      setThinking(false);
    }
  }

  /** Text turn: no audio in, no audio out. */
  async function send(question: string) {
    const text = question.trim();
    if (!text || thinking) return;
    setDraft("");
    await runTurn(text, false);
  }

  /** One question/answer. Returns the spoken answer, or null when it failed. */
  async function runTurn(question: string, withAudio: boolean): Promise<string | null> {
    const history = messagesRef.current.slice(-6);
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setThinking(true);
    let answer: string | null = null;
    try {
      const result = await ask({ data: { question, language, history } });
      answer = result.ok
        ? result.answer
        : t(result.reason === "not_configured" ? "home.askNotConfigured" : "home.askFailed");
      setMessages((prev) => [...prev, { role: "assistant", text: answer! }]);
      if (!result.ok) answer = null;
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: t("home.askFailed") }]);
    } finally {
      setThinking(false);
    }
    if (answer && withAudio) await playAnswer(answer);
    return answer;
  }

  async function playAnswer(text: string) {
    setVoice("speaking");
    try {
      const result = await speak({ data: { text: text.slice(0, 1500), language } });
      if (!result.ok) {
        if (result.reason === "failed" && voiceOnRef.current) toast.message(t("home.askSpeakFailed"));
        return;
      }
      if (!voiceOnRef.current) return;

      const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
      audioRef.current = null;
    } catch {
      /* speaking is a bonus; the answer is already on screen */
    }
  }

  /** Records until a ~3s pause, then transcribes, answers and speaks back. */
  async function listenOnce() {
    if (!voiceOnRef.current) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: t("home.askMicDenied") }]);
      stopEverything();
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);

    let heardSpeech = false;
    let lastLoudAt = Date.now();
    const startedAt = Date.now();

    const finish = () => {
      clearTimers();
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* already stopped */
      }
    };

    const meter = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (const sample of buffer) sum += sample * sample;
      const rms = Math.sqrt(sum / buffer.length);
      const now = Date.now();
      if (rms > 0.02) {
        heardSpeech = true;
        lastLoudAt = now;
      }
      const quietFor = now - lastLoudAt;
      if (heardSpeech && quietFor > SILENCE_MS) finish();
      else if (!heardSpeech && now - startedAt > NO_SPEECH_MS) finish();
      else if (now - startedAt > MAX_TURN_MS) finish();
    }, 150);
    timersRef.current.push(meter);

    recorder.onstop = () => {
      clearTimers();
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      void ctx.close().catch(() => {});
      audioCtxRef.current = null;
      recorderRef.current = null;
      void handleRecording(new Blob(chunks, { type: mimeType || "audio/webm" }), heardSpeech);
    };

    setVoice("listening");
    recorder.start();
  }

  async function handleRecording(blob: Blob, heardSpeech: boolean) {
    if (!voiceOnRef.current) return;
    if (!heardSpeech || blob.size < 2000) {
      setMessages((prev) => [...prev, { role: "assistant", text: t("home.askNoSpeech") }]);
      stopEverything();
      return;
    }

    setVoice("transcribing");
    let question = "";
    try {
      const audioBase64 = await blobToBase64(blob);
      const result = await transcribe({
        data: { audioBase64, mimeType: blob.type || "audio/webm", language },
      });
      if (!result.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: t(
              result.reason === "not_configured"
                ? "home.askVoiceNotConfigured"
                : result.reason === "empty"
                  ? "home.askNoSpeech"
                  : "home.askHearFailed",
            ),
          },
        ]);
        stopEverything();
        return;
      }
      question = result.text;
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: t("home.askFailed") }]);
      stopEverything();
      return;
    }

    if (!voiceOnRef.current) return;
    setVoice("thinking");
    await runTurn(question, true);
    // Continuous conversation: listen again straight after speaking.
    if (voiceOnRef.current) void listenOnce();
  }

  function startVoice() {
    voiceOnRef.current = true;
    void listenOnce();
  }

  const voiceLabel =
    voice === "listening"
      ? t("home.askListening")
      : voice === "transcribing"
        ? t("home.askTranscribing")
        : voice === "speaking"
          ? t("home.askSpeaking")
          : null;

  return (
    <>
      <Button
        type="button"
        size="lg"
        onClick={() => setOpen(true)}
        aria-label={t("home.askTitle")}
        className="bg-primary text-primary-foreground shadow-lifted fixed right-4 bottom-24 z-40 h-14 rounded-full px-5"
      >
        <MessageCircle className="size-5" aria-hidden /> {t("home.askButton")}
      </Button>

      <Drawer open={open} onOpenChange={close}>
        <DrawerContent className="flex max-h-[85vh] flex-col">
          <DrawerHeader className="text-left">
            <DrawerTitle>{t("home.askTitle")}</DrawerTitle>
            <DrawerDescription>{t("home.askSubtitle")}</DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2">
            {messages.length === 0 && !thinking ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">{t("home.askExamplesLabel")}</p>
                {["home.askExample1", "home.askExample2", "home.askExample3"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void send(t(key))}
                    className="bg-muted min-h-11 w-full rounded-2xl px-4 py-3 text-left text-sm"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            ) : null}

            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap"
                    : "bg-muted mr-auto max-w-[90%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap"
                }
              >
                {m.text}
              </div>
            ))}

            {thinking ? (
              <div className="bg-muted text-muted-foreground mr-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("home.askThinking")}
              </div>
            ) : null}

            {voiceLabel && !thinking ? (
              <div
                className="mr-auto flex items-center gap-2 rounded-2xl bg-[var(--accent-100)] px-4 py-3 text-sm font-semibold text-[var(--accent-800)]"
                aria-live="polite"
              >
                {voice === "listening" ? (
                  <Mic className="size-4 animate-pulse" aria-hidden />
                ) : voice === "speaking" ? (
                  <Volume2 className="size-4" aria-hidden />
                ) : (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {voiceLabel}
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("home.askPlaceholder")}
              aria-label={t("home.askPlaceholder")}
              className="h-12"
            />
            {micSupported ? (
              <Button
                type="button"
                variant={voice === "off" ? "outline" : "destructive"}
                size="icon"
                className="size-12 shrink-0"
                aria-label={t(voice === "off" ? "home.askMic" : "home.askStopVoice")}
                onClick={() => (voice === "off" ? startVoice() : stopEverything())}
              >
                {voice === "off" ? (
                  <Mic className="size-5" aria-hidden />
                ) : (
                  <Square className="size-5" aria-hidden />
                )}
              </Button>
            ) : null}
            <Button
              type="submit"
              size="icon"
              className="size-12 shrink-0"
              disabled={thinking || !draft.trim()}
              aria-label={t("home.askSend")}
            >
              <Send className="size-5" aria-hidden />
            </Button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
