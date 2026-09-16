import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/hooks/useLanguage";
import { hasDocumentsPin, setDocumentsPin, verifyDocumentsPin } from "@/lib/documents-pin.functions";
import { cn } from "@/lib/utils";

const UNLOCK_KEY = "ereminder.documentsPinUnlocked";
const LOCK_EVENT = "mymitr:documents-relock";
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;
const MIN_PIN = 4;
const MAX_PIN = 6;

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

/** Re-locks the shelf straight away, from anywhere inside it. */
export function lockDocumentsNow() {
  clearDocumentsUnlock();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCK_EVENT));
}

const digits = (v: string) => v.replace(/\D/g, "").slice(0, MAX_PIN);
const validPin = (v: string) => /^\d{4,6}$/.test(v);

/**
 * PIN boxes. The PIN itself is only ever checked on the server, so the app does
 * not know whether this person chose 4, 5 or 6 digits: the row starts at four
 * boxes and grows as they type, up to the six the PIN rules allow.
 */
function PinCells({
  value,
  onChange,
  disabled,
  label,
  id,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  label: string;
  id: string;
  autoFocus?: boolean;
}) {
  const cells = Math.min(MAX_PIN, Math.max(MIN_PIN, value.length + (value.length >= MIN_PIN ? 1 : 0)));

  return (
    <div className="relative">
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        autoFocus={autoFocus}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(digits(e.target.value))}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
      <div className="flex justify-center gap-[11px]" aria-hidden>
        {Array.from({ length: cells }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "bg-card shadow-card flex h-[58px] w-[50px] items-center justify-center rounded-[18px]",
              i === value.length ? "border-[1.5px] border-[var(--accent-500)]" : "",
            )}
          >
            {i < value.length ? (
              <span className="bg-foreground size-5 rounded-full" />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

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

  const { data: fileCount } = useQuery({
    queryKey: ["documents_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
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
    const relock = () => {
      setUnlocked(false);
      setPin("");
    };
    window.addEventListener(LOCK_EVENT, relock);
    return () => window.removeEventListener(LOCK_EVENT, relock);
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
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-[74px] items-center justify-center rounded-full bg-[var(--accent-200)]">
        <Lock className="size-8 text-[var(--accent-800)]" aria-hidden />
      </span>

      <h2 className="mt-5 text-[27px] leading-tight">{t("pin.lockedTitle")}</h2>
      <p className="text-foreground/60 mt-2.5 max-w-[250px] text-[14.5px]">
        {hasPin
          ? t("pin.lockedBody", { count: fileCount ?? 0 })
          : t("pin.setupBody", { count: fileCount ?? 0 })}
      </p>

      <form
        className="mt-7 w-full max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void (hasPin ? unlock() : createPin());
        }}
      >
        <PinCells
          id="doc-pin"
          label={t("pin.pinLabel")}
          value={pin}
          onChange={setPin}
          disabled={busy || cooldown > 0}
          autoFocus
        />

        {!hasPin ? (
          <div className="space-y-2">
            <p className="text-foreground/60 text-[13px] font-semibold">{t("pin.confirmLabel")}</p>
            <PinCells
              id="doc-pin-confirm"
              label={t("pin.confirmLabel")}
              value={confirm}
              onChange={setConfirm}
              disabled={busy}
            />
          </div>
        ) : null}

        {cooldown > 0 ? (
          <p role="status" className="text-destructive text-sm font-semibold">
            {t("pin.lockedFor", { count: cooldown })}
          </p>
        ) : null}

        <Button
          type="submit"
          className="h-[54px] w-full rounded-full text-base"
          disabled={busy || cooldown > 0}
        >
          {hasPin ? t("pin.unlock") : t("pin.save")}
        </Button>
        {!hasPin ? (
          <Button type="button" variant="ghost" className="w-full" onClick={() => setSkipped(true)}>
            {t("pin.later")}
          </Button>
        ) : null}
      </form>
    </div>
  );
}
