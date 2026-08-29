import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useLanguage";
import { requestPhoneOtp, verifyPhoneOtp } from "@/lib/otp.functions";
import { phoneSchema } from "@/lib/otp.schemas";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to e-Reminder" },
      {
        name: "description",
        content:
          "Sign in or create your e-Reminder account with email, phone OTP or Google to start tracking birthdays, bills and deadlines.",
      },
      { property: "og:title", content: "Sign in to e-Reminder" },
      {
        property: "og:description",
        content: "Create your e-Reminder account and never miss a milestone or deadline again.",
      },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.object({
  email: z.string().trim().email("public.errEmail").max(255),
  password: z.string().min(8, "public.errPassword").max(72),
  fullName: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const t = useT();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/home", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="gradient-warm rounded-b-[2.5rem] px-6 pt-14 pb-12 text-center">
        <h1 className="text-primary-foreground text-4xl">{t("appName")}</h1>
        <p className="text-primary-foreground/95 mt-2 text-base">
          {t("public.authTagline")}
        </p>
      </div>

      <div className="mx-auto -mt-6 w-full max-w-md px-5 pb-16">
        <div className="bg-card shadow-card rounded-3xl p-5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-14 w-full text-base"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (result.error) {
                setBusy(false);
                toast.error(t("public.errGoogle"));
                return;
              }
              if (result.redirected) return;
              navigate({ to: "/home" });
            }}
          >
            {t("public.continueGoogle")}
          </Button>

          <div className="text-muted-foreground my-5 flex items-center gap-3 text-xs font-semibold tracking-wider uppercase">
            <span className="bg-border h-px flex-1" /> {t("public.or")}{" "}
            <span className="bg-border h-px flex-1" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">{t("public.signIn")}</TabsTrigger>
              <TabsTrigger value="signup">{t("public.signUp")}</TabsTrigger>
              <TabsTrigger value="phone">{t("profile.phone")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <EmailForm mode="signin" busy={busy} setBusy={setBusy} />
            </TabsContent>
            <TabsContent value="signup">
              <EmailForm mode="signup" busy={busy} setBusy={setBusy} />
            </TabsContent>
            <TabsContent value="phone">
              <PhoneForm busy={busy} setBusy={setBusy} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function EmailForm({
  mode,
  busy,
  setBusy,
}: {
  mode: "signin" | "signup";
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = emailSchema.safeParse({ email, password, fullName });
        if (!parsed.success) {
          toast.error(t(parsed.error.issues[0]?.message ?? "profile.errDetails"));
          return;
        }
        setBusy(true);
        if (mode === "signup") {
          const { data, error } = await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
              emailRedirectTo: `${window.location.origin}/home`,
              data: { full_name: parsed.data.fullName || null },
            },
          });
          setBusy(false);
          if (error) {
            toast.error(error.message);
            return;
          }
          if (!data.session) {
            toast.success(t("public.confirmEmail"));
            return;
          }
          toast.success(t("public.accountCreated"));
          navigate({ to: "/home" });
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
          });
          setBusy(false);
          if (error) {
            toast.error(error.message);
            return;
          }
          navigate({ to: "/home" });
        }
      }}
    >
      {mode === "signup" ? (
        <div className="space-y-2">
          <Label htmlFor="fullName">{t("public.yourName")}</Label>
          <Input
            id="fullName"
            value={fullName}
            maxLength={100}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("public.namePlaceholder")}
            className="h-12"
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${mode}-email`}>{t("family.email")}</Label>
        <Input
          id={`${mode}-email`}
          type="email"
          autoComplete="email"
          value={email}
          maxLength={255}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-12"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${mode}-password`}>{t("public.password")}</Label>
        <Input
          id={`${mode}-password`}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          maxLength={72}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("public.passwordPlaceholder")}
          className="h-12"
        />
      </div>
      <Button type="submit" size="lg" className="h-13 w-full text-base" disabled={busy}>
        {mode === "signup" ? t("public.createAccountShort") : t("public.signIn")}
      </Button>
    </form>
  );
}

function PhoneForm({ busy, setBusy }: { busy: boolean; setBusy: (v: boolean) => void }) {
  const navigate = useNavigate();
  const requestOtp = useServerFn(requestPhoneOtp);
  const verifyOtp = useServerFn(verifyPhoneOtp);
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "channel" | "code">("phone");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");

  async function send(pickedChannel: "sms" | "whatsapp") {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0]?.message ?? "public.errPhone"));
      return;
    }
    setBusy(true);
    try {
      const result = await requestOtp({ data: { phone: parsed.data, channel: pickedChannel } });
      if (!result.ok) {
        toast.error(result.detail);
        return;
      }
      setChannel(pickedChannel);
      setStep("code");
      toast.success(
        pickedChannel === "sms" ? t("profile.codeSms") : t("profile.codeWhatsapp"),
      );
    } catch {
      toast.error(t("profile.errSendCode"));
    } finally {
      setBusy(false);
    }
  }

  if (step === "channel") {
    return (
      <div className="mt-5 space-y-4">
        <p className="text-muted-foreground text-sm">
          {t("public.otpQuestionFor")} <strong>{phone}</strong>
        </p>
        <Button
          type="button"
          size="lg"
          className="h-13 w-full text-base"
          disabled={busy}
          onClick={() => void send("sms")}
        >
          {t("profile.otpSms")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-13 w-full text-base"
          disabled={busy}
          onClick={() => void send("whatsapp")}
        >
          {t("profile.otpWhatsapp")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={busy}
          onClick={() => setStep("phone")}
        >
          {t("public.changeNumber")}
        </Button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form
        className="mt-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = phoneSchema.safeParse(phone);
          if (!parsed.success) return;
          setBusy(true);
          try {
            const result = await verifyOtp({ data: { phone: parsed.data, code: code.trim() } });
            if (!result.ok) {
              toast.error(result.detail);
              return;
            }
            const { error } = await supabase.auth.setSession({
              access_token: result.accessToken,
              refresh_token: result.refreshToken,
            });
            if (error) {
              toast.error(t("public.errSession"));
              return;
            }
            navigate({ to: "/home" });
          } catch {
            toast.error(t("public.errVerify"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="otp">{t("profile.sixDigitCode")}</Label>
          <Input
            id="otp"
            inputMode="numeric"
            value={code}
            maxLength={8}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="h-12 text-center text-2xl tracking-[0.4em]"
          />
          <p className="text-muted-foreground text-xs">
            {channel === "sms"
              ? t("public.otpSentSms", { phone })
              : t("public.otpSentWhatsapp", { phone })}
          </p>
        </div>
        <Button type="submit" size="lg" className="h-13 w-full text-base" disabled={busy}>
          {t("public.verifyContinue")}
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => void send(channel)}
          >
            {t("public.resend")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => void send(channel === "sms" ? "whatsapp" : "sms")}
          >
            {channel === "sms" ? t("profile.switchWhatsapp") : t("profile.switchSms")}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={busy}
          onClick={() => {
            setCode("");
            setStep("phone");
          }}
        >
          {t("public.differentNumber")}
        </Button>
      </form>
    );
  }

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = phoneSchema.safeParse(phone);
        if (!parsed.success) {
          toast.error(t(parsed.error.issues[0]?.message ?? "public.errPhone"));
          return;
        }
        setStep("channel");
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="phone">{t("public.mobileNumber")}</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          maxLength={16}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+919876543210"
          className="h-12"
        />
      </div>
      <Button type="submit" size="lg" className="h-13 w-full text-base" disabled={busy}>
        {t("public.continue")}
      </Button>
      <p className="text-muted-foreground text-xs">
        {t("public.otpChoiceHint")}
      </p>
    </form>
  );
}
