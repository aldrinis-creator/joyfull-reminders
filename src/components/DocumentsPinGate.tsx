import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useLanguage";
import { hasDocumentsPin, setDocumentsPin, verifyDocumentsPin } from "@/lib/documents-pin.functions";

const UNLOCK_KEY = "ereminder.documentsPinUnlocked";
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;

function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    /* private mode — the shelf simply asks again */
  }
}

/** Clears the session unlock, e.g. after the PIN is changed. */
export function clearDocumentsUnlock() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* nothing to clear */
  }
}

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
const validPin = (v: string) => /^\d{4,6}$/.test(v);

/** Locks the document shelf behind a 4-6 digit PIN for the browser session. */
export function DocumentsPinGate({ children }: { children: ReactNode }) {
  const t = useT();
  const check = useServerFn(hasDocumentsPin);
  const savePin = useServerFn(setDocumentsPin);
  const verifyPin = useServerFn(verifyDocumentsPin);

  const { data, isPending } = useQuery({
    queryKey: ["documents-pin-status"],
    queryFn: () => check({ data: undefined }),
    staleTime: 0,
  });

  const [unlocked, setUnlocked] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setUnlocked(isUnlocked());
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cooldown > 0]);

  if (isPending) return null;

  const hasPin = Boolean(data?.hasPin);
  if (!hasPin && skipped) return <>{children}</>;
  if (hasPin && unlocked) return <>{children}</>;

  async function createPin() {
    if (!validPin(pin)) {
      toast.error(t("pin.errDigits"));
      return;
    }
    if (pin !== confirm) {
      toast.error(t("pin.errMatch"));
      return;
    }
    setBusy(true);
    try {
      const result = await savePin({ data: { pin } });
      if (!result.ok) {
        toast.error(result.detail);
        return;
      }
      markUnlocked();
      setUnlocked(true);
      setPin("");
      setConfirm("");
      toast.success(t("pin.saved"));
    } catch {
      toast.error(t("pin.errSave"));
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    if (cooldown > 0) return;
    if (!validPin(pin)) {
      toast.error(t("pin.errDigits"));
      return;
    }
    setBusy(true);
    try {
      const result = await verifyPin({ data: { pin } });
      if (result.ok) {
        markUnlocked();
        setUnlocked(true);
        setAttempts(0);
        setPin("");
        return;
      }
      const next = attempts + 1;
      setAttempts(next);
      setPin("");
      if (next >= MAX_ATTEMPTS) {
        setAttempts(0);
        setCooldown(COOLDOWN_SECONDS);
        toast.error(t("pin.lockedFor", { count: COOLDOWN_SECONDS }));
      } else {
        toast.error(t("pin.errWrong", { count: MAX_ATTEMPTS - next }));
      }
    } catch {
      toast.error(t("pin.errSave"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="bg-card shadow-card space-y-4 rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-primary size-7" aria-hidden />
          <h1 className="text-xl font-bold">{hasPin ? t("pin.enterTitle") : t("pin.setTitle")}</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {hasPin ? t("pin.enterHint") : t("pin.setHint")}
        </p>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void (hasPin ? unlock() : createPin());
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="doc-pin">{t("pin.pinLabel")}</Label>
            <Input
              id="doc-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              disabled={busy || cooldown > 0}
              onChange={(e) => setPin(digits(e.target.value))}
              className="h-12 text-center text-2xl tracking-[0.4em]"
            />
          </div>
          {!hasPin ? (
            <div className="space-y-2">
              <Label htmlFor="doc-pin-confirm">{t("pin.confirmLabel")}</Label>
              <Input
                id="doc-pin-confirm"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={confirm}
                disabled={busy}
                onChange={(e) => setConfirm(digits(e.target.value))}
                className="h-12 text-center text-2xl tracking-[0.4em]"
              />
            </div>
          ) : null}

          {cooldown > 0 ? (
            <p role="status" className="text-destructive text-sm font-semibold">
              {t("pin.lockedFor", { count: cooldown })}
            </p>
          ) : null}

          <Button type="submit" className="h-12 w-full" disabled={busy || cooldown > 0}>
            {hasPin ? t("pin.unlock") : t("pin.save")}
          </Button>
          {!hasPin ? (
            <Button type="button" variant="ghost" className="w-full" onClick={() => setSkipped(true)}>
              {t("pin.later")}
            </Button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
