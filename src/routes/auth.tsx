import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  fullName: z.string().trim().max(100).optional(),
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Use international format, e.g. +919876543210");

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/home", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="gradient-warm rounded-b-[2.5rem] px-6 pt-14 pb-12 text-center">
        <h1 className="text-primary-foreground text-4xl">e-Reminder</h1>
        <p className="text-primary-foreground/95 mt-2 text-base">
          Your milestones, deadlines and celebrations in one place.
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
                toast.error("Google sign-in failed. Please try another method.");
                return;
              }
              if (result.redirected) return;
              navigate({ to: "/home" });
            }}
          >
            Continue with Google
          </Button>

          <div className="text-muted-foreground my-5 flex items-center gap-3 text-xs font-semibold tracking-wider uppercase">
            <span className="bg-border h-px flex-1" /> or <span className="bg-border h-px flex-1" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
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
          toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
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
            toast.success("Almost there — tap the confirmation link we just emailed you.");
            return;
          }
          toast.success("Account created. Welcome to e-Reminder!");
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
          <Label htmlFor="fullName">Your name</Label>
          <Input
            id="fullName"
            value={fullName}
            maxLength={100}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Aarti Sharma"
            className="h-12"
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${mode}-email`}>Email</Label>
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
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <Input
          id={`${mode}-password`}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          maxLength={72}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="h-12"
        />
      </div>
      <Button type="submit" size="lg" className="h-13 w-full text-base" disabled={busy}>
        {mode === "signup" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}

function PhoneForm({ busy, setBusy }: { busy: boolean; setBusy: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = phoneSchema.safeParse(phone);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Enter a valid phone number");
          return;
        }
        setBusy(true);
        if (!sent) {
          const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data });
          setBusy(false);
          if (error) {
            toast.error(error.message);
            return;
          }
          setSent(true);
          toast.success("Code sent by SMS");
        } else {
          const { error } = await supabase.auth.verifyOtp({
            phone: parsed.data,
            token: code.trim(),
            type: "sms",
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
      <div className="space-y-2">
        <Label htmlFor="phone">Mobile number</Label>
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
      {sent ? (
        <div className="space-y-2">
          <Label htmlFor="otp">6-digit code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            value={code}
            maxLength={8}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="h-12 text-center text-2xl tracking-[0.4em]"
          />
        </div>
      ) : null}
      <Button type="submit" size="lg" className="h-13 w-full text-base" disabled={busy}>
        {sent ? "Verify and continue" : "Send OTP"}
      </Button>
      <p className="text-muted-foreground text-xs">
        SMS sign-in needs an SMS provider connected to your account.
      </p>
    </form>
  );
}
