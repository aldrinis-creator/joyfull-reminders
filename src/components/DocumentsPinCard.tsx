import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/useLanguage";
import { useProfile } from "@/lib/queries";
import { clearDocumentsUnlock } from "@/components/DocumentsPinGate";
import { phoneSchema } from "@/lib/otp.schemas";
import { requestNumberVerification } from "@/lib/otp.functions";
import {
  hasDocumentsPin,
  resetDocumentsPinWithOtp,
  setDocumentsPin,
  verifyDocumentsPin,
} from "@/lib/documents-pin.functions";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
const validPin = (v: string) => /^\d{4,6}$/.test(v);

/** Profile control to set, change or recover the Document Shelf PIN. */
export function DocumentsPinCard({ embedded = false }: { embedded?: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const check = useServerFn(hasDocumentsPin);
  const savePin = useServerFn(setDocumentsPin);
  const verifyPin = useServerFn(verifyDocumentsPin);
  const requestOtp = useServerFn(requestNumberVerification);
  const resetPin = useServerFn(resetDocumentsPinWithOtp);

  const { data } = useQuery({
    queryKey: ["documents-pin-status"],
    queryFn: () => check({ data: undefined }),
  });
  const hasPin = Boolean(data?.hasPin);

  const [mode, setMode] = useState<"none" | "change" | "forgot">("none");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setMode("none");
    setCurrent("");
    setNext("");
    setConfirm("");
    setCode("");
    setCodeSent(false);
  };

  const refresh = () => {
    clearDocumentsUnlock();
    void queryClient.invalidateQueries({ queryKey: ["documents-pin-status"] });
  };

  async function submitChange() {
    if (!validPin(next) ) {
      toast.error(t("pin.errDigits"));
      return;
    }
    if (next !== confirm) {
      toast.error(t("pin.errMatch"));
      return;
    }
    setBusy(true);
    try {
      if (hasPin) {
        const ok = await verifyPin({ data: { pin: current } });
        if (!ok.ok) {
          toast.error(t("pin.errCurrent"));
          return;
        }
      }
      const result = await savePin({ data: { pin: next } });
      if (!result.ok) {
        toast.error(result.detail);
        return;
      }
      toast.success(hasPin ? t("pin.changed") : t("pin.saved"));
      refresh();
      close();
    } catch {
      toast.error(t("pin.errSave"));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    const parsed = phoneSchema.safeParse(profile?.phone ?? "");
    if (!parsed.success) {
      toast.error(t("pin.errNoPhone"));
      return;
    }
    setBusy(true);
    try {
      const result = await requestOtp({ data: { phone: parsed.data, channel: "sms" } });
      if (!result.ok) {
        toast.error(result.detail);
        return;
      }
      setCodeSent(true);
      toast.success(t("profile.codeSms"));
    } catch {
      toast.error(t("pin.errSendCode"));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset() {
    const parsed = phoneSchema.safeParse(profile?.phone ?? "");
    if (!parsed.success) {
      toast.error(t("pin.errNoPhone"));
      return;
    }
    if (!validPin(next)) {
      toast.error(t("pin.errDigits"));
      return;
    }
    if (next !== confirm) {
      toast.error(t("pin.errMatch"));
      return;
    }
    setBusy(true);
    try {
      const result = await resetPin({ data: { phone: parsed.data, code, pin: next } });
      if (!result.ok) {
        toast.error(result.detail);
        return;
      }
      toast.success(t("pin.changed"));
      refresh();
      close();
    } catch {
      toast.error(t("pin.errSave"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={embedded ? "space-y-3" : "bg-card shadow-card space-y-3 rounded-3xl p-5"}>
      <div className="flex items-center gap-3">
        <KeyRound className="text-primary size-6" aria-hidden />
        <h2 className="text-xl">{t("pin.cardTitle")}</h2>
      </div>
      <p className="text-muted-foreground text-sm">
        {hasPin ? t("pin.cardHintSet") : t("pin.cardHintNone")}
      </p>
      <Button variant="outline" className="h-12 w-full" onClick={() => setMode("change")}>
        {hasPin ? t("pin.changePin") : t("pin.setPin")}
      </Button>
      {hasPin ? (
        <Button variant="ghost" className="w-full" onClick={() => setMode("forgot")}>
          {t("pin.forgot")}
        </Button>
      ) : null}

      <Dialog open={mode !== "none"} onOpenChange={(v) => (!v ? close() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "forgot" ? t("pin.forgotTitle") : hasPin ? t("pin.changePin") : t("pin.setPin")}
            </DialogTitle>
          </DialogHeader>

          {mode === "forgot" ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submitReset();
              }}
            >
              <p className="text-muted-foreground text-sm">{t("pin.forgotHint")}</p>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full"
                disabled={busy}
                onClick={() => void sendCode()}
              >
                {t("pin.sendCode")}
              </Button>
              {codeSent ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="pin-code">{t("pin.codeLabel")}</Label>
                    <Input
                      id="pin-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      className="h-12 text-center text-2xl tracking-[0.3em]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pin-reset-new">{t("pin.newLabel")}</Label>
                    <Input
                      id="pin-reset-new"
                      type="password"
                      inputMode="numeric"
                      value={next}
                      onChange={(e) => setNext(digits(e.target.value))}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pin-reset-confirm">{t("pin.confirmLabel")}</Label>
                    <Input
                      id="pin-reset-confirm"
                      type="password"
                      inputMode="numeric"
                      value={confirm}
                      onChange={(e) => setConfirm(digits(e.target.value))}
                      className="h-12"
                    />
                  </div>
                  <Button type="submit" className="h-12 w-full" disabled={busy}>
                    {t("pin.verifyAndSet")}
                  </Button>
                </>
              ) : null}
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submitChange();
              }}
            >
              {hasPin ? (
                <div className="space-y-2">
                  <Label htmlFor="pin-current">{t("pin.currentLabel")}</Label>
                  <Input
                    id="pin-current"
                    type="password"
                    inputMode="numeric"
                    value={current}
                    onChange={(e) => setCurrent(digits(e.target.value))}
                    className="h-12"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="pin-new">{t("pin.newLabel")}</Label>
                <Input
                  id="pin-new"
                  type="password"
                  inputMode="numeric"
                  value={next}
                  onChange={(e) => setNext(digits(e.target.value))}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin-confirm">{t("pin.confirmLabel")}</Label>
                <Input
                  id="pin-confirm"
                  type="password"
                  inputMode="numeric"
                  value={confirm}
                  onChange={(e) => setConfirm(digits(e.target.value))}
                  className="h-12"
                />
              </div>
              <Button type="submit" className="h-12 w-full" disabled={busy}>
                {t("pin.save")}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
