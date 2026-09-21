/**
 * Sends phone/desktop notifications through Firebase Cloud Messaging via the
 * Lovable connector gateway (never straight to FCM). Stale device tokens are
 * deleted so we stop trying them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

export type PushPayload = {
  title: string;
  body: string;
  path?: string;
  /** Enables the notification's "Dismiss" action for this reminder occurrence. */
  dismiss?: { reminderId: string; occurrenceAt: string };
  /** Distinguishes repeat nudges for the same occurrence so none replaces another. */
  alertSeq?: number | string;
};


export type PushAttempt = { token: string; ok: boolean; detail?: string };

export async function sendPushToUser(
  admin: SupabaseClient<Database>,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; attempts: PushAttempt[] }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !connectionKey) return { sent: 0, failed: 0, attempts: [] };

  const { data: tokens } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId)
    .limit(20);
  if (!tokens?.length) return { sent: 0, failed: 0, attempts: [] };

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];
  const attempts: PushAttempt[] = [];

  const { createDismissToken } = await import("@/lib/dismiss-token.server");
  const dismissToken = payload.dismiss
    ? createDismissToken({
        userId,
        reminderId: payload.dismiss.reminderId,
        occurrenceAt: payload.dismiss.occurrenceAt,
      })
    : null;
  const actions = dismissToken ? [{ action: "dismiss", title: "Dismiss" }] : undefined;

  // FCM data values must be strings. reminderId/occurrenceAt/alertSeq give the
  // service worker a genuinely unique notification tag, so one alert never
  // silently replaces another.
  const dataPayload: Record<string, string> = {
    path: payload.path ?? "/home",
    ...(dismissToken ? { dismissToken } : {}),
    ...(payload.dismiss
      ? {
          reminderId: payload.dismiss.reminderId,
          occurrenceAt: payload.dismiss.occurrenceAt,
        }
      : {}),
    alertSeq: String(payload.alertSeq ?? Date.now()),
  };


  for (const { token } of tokens) {
    try {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connectionKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: payload.title, body: payload.body },
            data: {
              path: payload.path ?? "/home",
              ...(dismissToken ? { dismissToken } : {}),
            },
            webpush: {
              notification: {
                // Title and body MUST be repeated here: the webpush block
                // overrides the common notification for web delivery, and
                // without them the worker receives nothing displayable.
                title: payload.title,
                body: payload.body,
                icon: "/icons/icon-192.png",

                badge: "/icons/icon-192.png",
                requireInteraction: true,
                ...(actions ? { actions } : {}),
                data: {
                  path: payload.path ?? "/home",
                  ...(dismissToken ? { dismissToken } : {}),
                },
              },
              fcm_options: { link: payload.path ?? "/home" },
            },
            android: { priority: "HIGH", notification: { sound: "default" } },
            apns: { payload: { aps: { sound: "default" } } },
          },
        }),
      });
      if (res.ok) {
        sent += 1;
        attempts.push({ token, ok: true });
        continue;
      }
      const detail = await res.text();
      console.error(`FCM send failed [${res.status}]: ${detail}`);
      if (res.status === 404 || res.status === 400) stale.push(token);
      failed += 1;
      attempts.push({ token, ok: false, detail: `${res.status}: ${detail.slice(0, 300)}` });
    } catch (err) {
      failed += 1;
      attempts.push({ token, ok: false, detail: String(err).slice(0, 300) });
    }
  }

  if (stale.length) {
    await admin.from("push_tokens").delete().in("token", stale);
  }
  return { sent, failed, attempts };
}

