import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { confirmNumberVerification, requestNumberVerification } from "@/lib/otp.functions";
import { phoneSchema } from "@/lib/otp.schemas";
import { useT } from "@/hooks/useLanguage";

/** Lets a signed-in user confirm their own mobile number by SMS or WhatsApp. */
export function PhoneVerifyDialog({
  phone,
  verified,
  onVerified,
}: {
  phone: string;
  verified: boolean;
  onVerified?: () => void;
}) {
  const t = useT();
  const requestOtp = useServerFn(requestNumberVerification);
  const confirmOtp = useServerFn(confirmNumberVerification);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"channel" | "code">("channel");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = phoneSchema.safeParse(phone);

  async function send(picked: "sms" | "whatsapp") {
    if (!parsed.success) {
      toast.error(t("profile.errPhoneFormat"));
      return;
    }
    setBusy(true);
    try {
      const result = await requestOtp({ data: { phone: parsed.data, channel: picked } });
      if (!result.ok) {
        toast.error(result.detail);
        return;
      }
      setChannel(picked);
      setStep("code");
      toast.success(picked === "sms" ? t("profile.codeSms") : t("profile.codeWhatsapp"));
    } catch {
      toast.error(t("profile.errSendCode"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStep("channel");
          setCode("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={verified}>
          {verified ? t("profile.verified") : t("profile.verifyNumber")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("profile.verifyTitle", { phone: phone || t("profile.yourNumber") })}</DialogTitle>
        </DialogHeader>
        {step === "channel" ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">{t("profile.otpChannelQuestion")}</p>
            <Button className="h-12 w-full" disabled={busy} onClick={() => void send("sms")}>
              {t("profile.otpSms")}
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full"
              disabled={busy}
              onClick={() => void send("whatsapp")}
            >
              {t("profile.otpWhatsapp")}
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!parsed.success) return;
              setBusy(true);
              try {
                const result = await confirmOtp({
                  data: { phone: parsed.data, code: code.trim() },
                });
                if (!result.ok) {
                  toast.error(result.detail);
                  return;
                }
                toast.success(t("profile.numberVerified"));
                setOpen(false);
                setStep("channel");
                setCode("");
                onVerified?.();
              } catch {
                toast.error(t("profile.errVerifyCode"));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="verify-otp">{t("profile.sixDigitCode")}</Label>
              <Input
                id="verify-otp"
                inputMode="numeric"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center text-2xl tracking-[0.4em]"
                placeholder="123456"
              />
              <p className="text-muted-foreground text-xs">
                {channel === "sms" ? t("profile.sentBySms") : t("profile.sentByWhatsapp")}
              </p>
            </div>
            <Button type="submit" className="h-12 w-full" disabled={busy}>
              {t("profile.verify")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={() => void send(channel === "sms" ? "whatsapp" : "sms")}
            >
              {channel === "sms" ? t("profile.switchWhatsapp") : t("profile.switchSms")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
