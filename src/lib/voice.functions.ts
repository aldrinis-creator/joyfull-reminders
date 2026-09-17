import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sarvam AI speech bridge for the "Ask My-Mitr" assistant.
 *
 * Both calls run server-side so SARVAM_API_KEY never reaches the browser.
 * Every failure is returned as a typed result rather than thrown, so the
 * assistant can quietly fall back to its text-only behaviour.
 */

const SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text";
const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech";

export const transcribeInput = z.object({
  /** Raw base64 (no data: prefix) of a short recording. */
  audioBase64: z.string().min(100).max(8_000_000),
  mimeType: z.string().min(3).max(60),
  language: z.enum(["en", "hi"]).default("en"),
});

export const speakInput = z.object({
  text: z.string().trim().min(1).max(1500),
  language: z.enum(["en", "hi"]).default("en"),
});

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: "not_configured" | "failed" | "empty" };

export type SpeakResult =
  | { ok: true; audioBase64: string; mimeType: string }
  | { ok: false; reason: "not_configured" | "failed" };

function langCode(language: "en" | "hi") {
  return language === "hi" ? "hi-IN" : "en-IN";
}

function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** "audio/webm;codecs=opus" → "audio/webm" — the provider rejects parameters. */
function cleanMime(mimeType: string): string {
  const base = (mimeType.split(";")[0] ?? "").trim().toLowerCase();
  return base.startsWith("audio/") ? base : "audio/webm";
}

function extensionFor(mimeType: string): string {
  const base = cleanMime(mimeType);
  if (base.includes("wav")) return "wav";
  if (base.includes("mp4") || base.includes("m4a")) return "mp4";
  if (base.includes("mpeg") || base.includes("mp3")) return "mp3";
  if (base.includes("ogg")) return "ogg";
  return "webm";
}


/** Speech → text via Sarvam Saarika. */
export const transcribeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => transcribeInput.parse(input))
  .handler(async ({ data }): Promise<TranscribeResult> => {
    const key = process.env["SARVAM_API_KEY"];
    if (!key) return { ok: false, reason: "not_configured" };

    try {
      const bytes = decodeBase64(data.audioBase64);
      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes], { type: cleanMime(data.mimeType) }),
        `speech.${extensionFor(data.mimeType)}`,
      );
      form.append("model", "saarika:v2.5");
      form.append("language_code", langCode(data.language));

      const res = await fetch(SARVAM_STT_URL, {
        method: "POST",
        headers: { "api-subscription-key": key },
        body: form,
      });
      if (!res.ok) {
        console.error("Sarvam STT failed", res.status, await res.text().catch(() => ""));
        return { ok: false, reason: "failed" };
      }
      const body = (await res.json()) as { transcript?: string };
      const text = (body.transcript ?? "").trim();
      if (!text) return { ok: false, reason: "empty" };
      return { ok: true, text };
    } catch (error) {
      console.error("Sarvam STT error", error);
      return { ok: false, reason: "failed" };
    }
  });

/** Text → speech via Sarvam Bulbul. */
export const speakText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => speakInput.parse(input))
  .handler(async ({ data }): Promise<SpeakResult> => {
    const key = process.env["SARVAM_API_KEY"];
    if (!key) return { ok: false, reason: "not_configured" };

    try {
      const res = await fetch(SARVAM_TTS_URL, {
        method: "POST",
        headers: {
          "api-subscription-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text.slice(0, 1500),
          target_language_code: langCode(data.language),
          speaker: "priya",
          model: "bulbul:v3",
          enable_preprocessing: true,
        }),
      });
      if (!res.ok) {
        console.error("Sarvam TTS failed", res.status, await res.text().catch(() => ""));
        return { ok: false, reason: "failed" };
      }
      const body = (await res.json()) as { audios?: string[] };
      const audio = body.audios?.[0];
      if (!audio) return { ok: false, reason: "failed" };
      return { ok: true, audioBase64: audio, mimeType: "audio/wav" };
    } catch (error) {
      console.error("Sarvam TTS error", error);
      return { ok: false, reason: "failed" };
    }
  });
