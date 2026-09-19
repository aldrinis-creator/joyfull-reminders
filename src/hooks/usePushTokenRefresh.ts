import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { registerPushToken } from "@/lib/push.functions";
import { isIos, pushPermission, refreshPushToken } from "@/lib/push-client";

const STORAGE_KEY = "ereminder.push.token";

/**
 * Keeps this device's notification address current: once per app start (and
 * once a day at most), an already-enabled device re-fetches its token and
 * saves it again, so it can't quietly go stale between visits.
 */
export function usePushTokenRefresh() {
  const register = useServerFn(registerPushToken);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pushPermission() !== "granted") return;
    if (!localStorage.getItem(STORAGE_KEY)) return;

    let cancelled = false;
    void (async () => {
      const token = await refreshPushToken();
      if (!token || cancelled) return;
      try {
        await register({
          data: {
            token,
            platform: isIos() ? "ios" : "web",
            userAgent: navigator.userAgent.slice(0, 300),
          },
        });
        localStorage.setItem(STORAGE_KEY, token);
      } catch {
        /* a failed refresh must never break the app — the old token stays */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [register]);
}
