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
      toast.error("Save a valid number in international format first, e.g. +919876543210");
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
      toast.success(picked === "sms" ? "Code sent by SMS" : "Code sent on WhatsApp");
    } catch {
      toast.error("Could not send the code. Please try again.");
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
          {verified ? "Verified" : "Verify number"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify {phone || "your number"}</DialogTitle>
        </DialogHeader>
        {step === "channel" ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              How would you like to receive your one-time code?
            </p>
            <Button className="h-12 w-full" disabled={busy} onClick={() => void send("sms")}>
              Text me on SMS
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full"
              disabled={busy}
              onClick={() => void send("whatsapp")}
            >
              Send it on WhatsApp
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
                toast.success("Number verified");
                setOpen(false);
                setStep("channel");
                setCode("");
                onVerified?.();
              } catch {
                toast.error("Could not verify that code.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="verify-otp">6-digit code</Label>
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
                Sent {channel === "sms" ? "by SMS" : "on WhatsApp"}. Expires in 10 minutes.
              </p>
            </div>
            <Button type="submit" className="h-12 w-full" disabled={busy}>
              Verify
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={() => void send(channel === "sms" ? "whatsapp" : "sms")}
            >
              {channel === "sms" ? "Send on WhatsApp instead" : "Send by SMS instead"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
