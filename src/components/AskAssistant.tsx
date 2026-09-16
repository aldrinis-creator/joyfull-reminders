import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Mic, Send, Square } from "lucide-react";
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

type Message = { role: "user" | "assistant"; text: string };

/** Floating "Ask My-Mitr" assistant: answers from the signed-in user's own data. */
export function AskAssistant() {
  const t = useT();
  const { language } = useLanguage();
  const ask = useServerFn(askAssistant);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMicSupported(getRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, thinking]);

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setListening(false);
      setMessages([]);
      setDraft("");
      setThinking(false);
    }
  }

  async function send(question: string) {
    const text = question.trim();
    if (!text || thinking) return;
    const history = messages.slice(-6);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setDraft("");
    setThinking(true);
    try {
      const result = await ask({ data: { question: text, language, history } });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: result.ok
            ? result.answer
            : t(result.reason === "not_configured" ? "home.askNotConfigured" : "home.askFailed"),
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: t("home.askFailed") }]);
    } finally {
      setThinking(false);
    }
  }

  function startListening() {
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
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      if (captured) setDraft(captured);
    };
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

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
                variant={listening ? "destructive" : "outline"}
                size="icon"
                className="size-12 shrink-0"
                aria-label={t(listening ? "home.askStopMic" : "home.askMic")}
                onClick={() => (listening ? stopListening() : startListening())}
              >
                {listening ? (
                  <Square className="size-5" aria-hidden />
                ) : (
                  <Mic className="size-5" aria-hidden />
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
