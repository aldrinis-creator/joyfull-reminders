import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useT } from "@/hooks/useLanguage";
import { registerPushToken } from "@/lib/push.functions";
import { enablePush, isIos, isStandalone, pushPermission } from "@/lib/push-client";

const TOKEN_KEY = "ereminder.push.token";
const ASKED_KEY = "ereminder.push.asked";

/**
 * First-run notification prompt. Browsers only grant notification permission
 * from a real tap, so setup asks once, clearly, instead of leaving an
 * off-by-default switch buried in Profile for people to discover.
 */
export function PushSetupPrompt() {
  const t = useT();
  const register = useServerFn(registerPushToken);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.top !== window.self) return; // preview iframe: prompts are refused
    if (isIos() && !isStandalone()) return; // must be installed to the home screen first
    if (pushPermission() !== "default") return; // already allowed or blocked
    if (localStorage.getItem(ASKED_KEY)) return;
    setOpen(true);
  }, []);

  const allow = async () => {
    setBusy(true);
    try {
      const result = await enablePush();
      localStorage.setItem(ASKED_KEY, "1");
      if (result.status === "registered" && result.token) {
        await register({
          data: {
            token: result.token,
            platform: isIos() ? "ios" : "web",
            userAgent: navigator.userAgent.slice(0, 300),
          },
        });
        localStorage.setItem(TOKEN_KEY, result.token);
        toast.success(t("profile.pushOnDevice"));
      } else {
        toast.error(t(`profile.push_${result.status.replace(/-/g, "_")}`));
      }
    } catch {
      toast.error(t("profile.pushError"));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const later = () => {
    localStorage.setItem(ASKED_KEY, "1");
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && later()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-2xl rounded-t-[28px] border-border bg-background px-[22px] pt-7 pb-8"
      >
        <SheetHeader className="mb-5 pr-8 text-left">
          <SheetTitle className="text-[24px]">{t("profile.pushSetupTitle")}</SheetTitle>
          <SheetDescription>{t("profile.pushSetupBody")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3">
          <Button className="h-12 w-full" disabled={busy} onClick={() => void allow()}>
            <BellRing className="size-5" aria-hidden />
            {busy ? t("saving") : t("profile.pushSetupAllow")}
          </Button>
          <Button variant="ghost" className="h-12 w-full" disabled={busy} onClick={later}>
            {t("profile.pushSetupLater")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
