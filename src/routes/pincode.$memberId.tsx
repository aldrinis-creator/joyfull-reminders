import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitRecipientPincode } from "@/lib/recipient.functions";
import { isValidPincode } from "@/lib/greetings";

export const Route = createFileRoute("/pincode/$memberId")({
  head: () => ({
    meta: [
      { title: "Share your pincode — e-Reminder" },
      {
        name: "description",
        content:
          "Share your 6-digit pincode so gifts and flowers can be delivered from a shop close to you.",
      },
      { property: "og:title", content: "Share your pincode" },
      {
        property: "og:description",
        content: "A friend wants to send you something — share your delivery pincode.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PincodePage,
});

function PincodePage() {
  const { memberId } = Route.useParams();
  const submit = useServerFn(submitRecipientPincode);
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [city, setCity] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPincode(pincode)) {
      setState("error");
      return;
    }
    setState("busy");
    try {
      const result = await submit({ data: { memberId, pincode: pincode.trim() } });
      if (result.ok) {
        setCity(result.city);
        setState("done");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="bg-card shadow-card w-full max-w-md rounded-[2rem] p-8">
        {state === "done" ? (
          <>
            <p className="text-5xl" aria-hidden>
              🎁
            </p>
            <h1 className="mt-4 text-3xl">Thank you!</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              We've saved {pincode}
              {city ? ` (${city})` : ""}. Your surprise can now be delivered from a shop nearby.
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="text-5xl" aria-hidden>
                📮
              </p>
              <h1 className="mt-4 text-3xl">Share your delivery pincode</h1>
              <p className="text-muted-foreground mt-2">
                Someone wants to send you a gift. Your 6-digit pincode helps us find a shop within a
                few kilometres of you. Nothing else is shared.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">Pincode</Label>
              <Input
                id="pin"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                className="h-13 text-lg"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                aria-invalid={state === "error"}
              />
              {state === "error" ? (
                <p className="text-destructive text-sm">Please enter a valid 6-digit pincode.</p>
              ) : null}
            </div>
            <Button type="submit" className="h-13 w-full text-base" disabled={state === "busy"}>
              {state === "busy" ? "Saving…" : "Share pincode"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
