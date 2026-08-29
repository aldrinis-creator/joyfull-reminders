import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCalendarToken } from "@/lib/calendar.functions";
import { useT } from "@/hooks/useLanguage";

export function CalendarSyncCard() {
  const t = useT();
  const fetchToken = useServerFn(getCalendarToken);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchToken({ data: { rotate: false } })
      .then((res) => {
        if (!cancelled) setToken(res.token);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fetchToken]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const httpsUrl = token ? `${origin}/api/public/calendar/${token}.ics` : "";
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("profile.linkCopied", { label }));
    } catch {
      toast.error(t("profile.errCopy"));
    }
  };

  const rotate = async () => {
    setBusy(true);
    try {
      const res = await fetchToken({ data: { rotate: true } });
      setToken(res.token);
      toast.success(t("profile.newLink"));
    } catch {
      toast.error(t("profile.errNewLink"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-card shadow-card space-y-4 rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <CalendarPlus className="text-primary size-6" aria-hidden />
        <h2 className="text-xl">{t("profile.calendarSync")}</h2>
      </div>
      <p className="text-muted-foreground text-sm">{t("profile.calendarSyncHint")}</p>

      <div className="space-y-2">
        <Input
          readOnly
          value={httpsUrl}
          aria-label={t("profile.calendarLinkAria")}
          onFocus={(e) => e.currentTarget.select()}
          className="h-12 text-xs"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            className="h-12"
            disabled={!token}
            onClick={() => void copy(webcalUrl, t("profile.calendarLink"))}
          >
            <Copy className="size-4" aria-hidden /> {t("profile.copyCalendarLink")}
          </Button>
          <Button
            variant="outline"
            className="h-12"
            disabled={!token}
            onClick={() => void copy(httpsUrl, t("profile.webLink"))}
          >
            <Copy className="size-4" aria-hidden /> {t("profile.copyHttpsLink")}
          </Button>
        </div>
      </div>

      <Button variant="ghost" className="h-12 w-full" disabled={busy} onClick={() => void rotate()}>
        <RefreshCw className="size-4" aria-hidden /> {t("profile.getNewLink")}
      </Button>
      <p className="text-muted-foreground text-xs">{t("profile.calendarLinkWarning")}</p>
    </section>
  );
}
