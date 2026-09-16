import { useEffect, useState } from "react";
import { BellRing, Check, Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useLanguage";
import { useServerFn } from "@tanstack/react-start";
import { registerPushToken, removePushToken } from "@/lib/push.functions";
import { enablePush, isIos, isStandalone, pushPermission } from "@/lib/push-client";

const STORAGE_KEY = "ereminder.push.token";

/**
 * Per-device notification switch: FCM tokens are per browser/phone, so this
 * has to be turned on once on each device the person uses.
 */
export function PushDeviceCard({ embedded = false }: { embedded?: boolean }) {
  const t = useT();
  const register = useServerFn(registerPushToken);
  const unregister = useServerFn(removePushToken);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setToken(pushPermission() === "granted" ? stored : null);
    setNeedsInstall(isIos() && !isStandalone());
  }, []);

  const turnOn = async () => {
    setBusy(true);
    try {
      const result = await enablePush();
      if (result.status === "registered" && result.token) {
        await register({
          data: {
            token: result.token,
            platform: isIos() ? "ios" : "web",
            userAgent: navigator.userAgent.slice(0, 300),
          },
        });
        localStorage.setItem(STORAGE_KEY, result.token);
        setToken(result.token);
        toast.success(t("profile.pushOnDevice"));
        return;
      }
      toast.error(t(`profile.push_${result.status.replace(/-/g, "_")}`));
    } catch {
      toast.error(t("profile.pushError"));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await unregister({ data: { token } });
      localStorage.removeItem(STORAGE_KEY);
      setToken(null);
      toast.success(t("profile.pushOffDevice"));
    } catch {
      toast.error(t("profile.pushError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={embedded ? "space-y-3" : "space-y-3 border-t pt-4"}>
      <div>
        <p className="font-semibold">{t("profile.pushDevice")}</p>
        <p className="text-muted-foreground text-sm">
          {token ? t("profile.pushDeviceOn") : t("profile.pushDeviceHint")}
        </p>
      </div>

      {needsInstall ? (
        <p className="bg-muted text-muted-foreground flex items-start gap-2 rounded-2xl px-4 py-3 text-sm">
          <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("profile.pushIosInstall")}
        </p>
      ) : null}

      {token ? (
        <Button variant="outline" className="h-12 w-full" disabled={busy} onClick={() => void turnOff()}>
          <Check className="size-5" aria-hidden /> {t("profile.pushTurnOff")}
        </Button>
      ) : (
        <Button variant="outline" className="h-12 w-full" disabled={busy} onClick={() => void turnOn()}>
          <BellRing className="size-5" aria-hidden />
          {busy ? t("saving") : t("profile.pushTurnOn")}
        </Button>
      )}
    </div>
  );
}
