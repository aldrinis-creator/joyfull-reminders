/**
 * Sends phone/desktop notifications through Firebase Cloud Messaging via the
 * Lovable connector gateway (never straight to FCM). Stale device tokens are
 * deleted so we stop trying them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

export type PushPayload = { title: string; body: string; path?: string };

export async function sendPushToUser(
  admin: SupabaseClient<Database>,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !connectionKey) return { sent: 0, failed: 0 };

  const { data: tokens } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId)
    .limit(20);
  if (!tokens?.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

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
            data: { path: payload.path ?? "/home" },
            webpush: {
              notification: {
                icon: "/icons/icon-192.png",
                badge: "/icons/icon-192.png",
                requireInteraction: true,
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
        continue;
      }
      const detail = await res.text();
      console.error(`FCM send failed [${res.status}]: ${detail}`);
      if (res.status === 404 || res.status === 400) stale.push(token);
      failed += 1;
    } catch {
      failed += 1;
    }
  }

  if (stale.length) {
    await admin.from("push_tokens").delete().in("token", stale);
  }
  return { sent, failed };
}
