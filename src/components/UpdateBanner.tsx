import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/hooks/useLanguage";
import { currentEntry, isUpdateAvailable } from "@/lib/app-update";

const POLL_MS = 5 * 60_000;
/** Routes where an automatic reload could throw away typed input. */
const EDITING = ["/new", "/edit", "/auth"];

/**
 * Tells a long-lived tab that a new build exists. An installed app that has
 * been in the background is reloaded outright when it comes back; anything
 * else gets a banner so nobody loses what they were typing.
 */
export function UpdateBanner() {
  const t = useT();
  const [stale, setStale] = useState(false);
  const booted = useRef<string | null>(null);
  const wasHidden = useRef(false);

  useEffect(() => {
    booted.current = currentEntry();
    let cancelled = false;

    const check = async (fromBackground: boolean) => {
      if (cancelled || !(await isUpdateAvailable(booted.current)) || cancelled) return;
      const safeToReload =
        fromBackground && !EDITING.some((part) => window.location.pathname.includes(part));
      if (safeToReload) window.location.reload();
      else setStale(true);
    };

    void check(false);
    const timer = setInterval(() => void check(false), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        wasHidden.current = true;
        return;
      }
      const returning = wasHidden.current;
      wasHidden.current = false;
      void check(returning);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!stale) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] px-3 pt-3">
      <div className="bg-primary text-primary-foreground shadow-lifted mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <p className="text-sm font-semibold">{t("update.available")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-primary-foreground text-primary inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          {t("update.action")}
        </button>
      </div>
    </div>
  );
}
