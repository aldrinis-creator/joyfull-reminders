// Server-only helpers for greeting voice notes.
// The bucket is private: recipients only ever get a short-lived signed URL
// generated at request time, never a stored public link.

export const VOICE_BUCKET = "greeting-voice-notes";
/** Hard cap enforced in the recorder UI too. */
export const VOICE_MAX_SECONDS = 100;
/** Signed links live just long enough to open and play the card. */
export const VOICE_SIGNED_URL_SECONDS = 60 * 60;

/** Public origin used for links we put inside WhatsApp/email messages. */
export function siteOrigin(): string {
  return (process.env["PUBLIC_SITE_URL"] ?? "https://e-reminders.lovable.app").replace(/\/+$/, "");
}

export function greetingPageUrl(greetingId: string): string {
  return `${siteOrigin()}/greeting/${greetingId}`;
}

export async function createVoiceSignedUrl(path: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(path, VOICE_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
