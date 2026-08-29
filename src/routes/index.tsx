import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BellRing, CalendarHeart, Gift, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "e-Reminder — Never miss a birthday, bill or deadline again" },
      {
        name: "description",
        content:
          "e-Reminder tracks family birthdays, tax and PUC deadlines, bills and exam dates, then helps you send cake, flowers or gifts from shops near you.",
      },
      { property: "og:title", content: "e-Reminder — Never miss a moment that matters" },
      {
        property: "og:description",
        content:
          "Family milestones, bill and PUC reminders, loud due-date alarms, and gifting from local florists and bakeries.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: CalendarHeart,
    title: "Family milestones first",
    body: "Birthdays, anniversaries, memorials and exam dates for everyone you love — with the age they're turning.",
  },
  {
    icon: BellRing,
    title: "Alarms you can't sleep through",
    body: "A full-screen alert with a 60-second chime, snooze options and a one-tap way to act on it.",
  },
  {
    icon: ShieldCheck,
    title: "Every deadline covered",
    body: "IT returns, FD maturity, insurance, PUC expiry, rent, SIPs, OTT trials and exam forms.",
  },
  {
    icon: Gift,
    title: "Gifting built in",
    body: "Order cake, flowers or a hamper from shops near you and track it to the doorstep.",
  },
];

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/home", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <section className="gradient-warm rounded-b-[2.5rem] px-6 pt-16 pb-14 text-center">
        <p className="text-primary-foreground/90 text-sm font-bold tracking-widest uppercase">
          e-Reminder
        </p>
        <h1 className="text-primary-foreground mx-auto mt-4 max-w-xl text-4xl sm:text-5xl">
          Never miss a moment that matters.
        </h1>
        <p className="text-primary-foreground/95 mx-auto mt-4 max-w-md text-lg">
          Birthdays, bills, PUC, tax filings, exam forms — remembered for you, and celebrated with
          cake and flowers when the day arrives.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button asChild size="lg" className="bg-indigo text-indigo-foreground h-14 w-64 text-lg">
            <Link to="/auth">Create your account</Link>
          </Button>
          <Link
            to="/auth"
            className="text-primary-foreground text-base font-semibold underline underline-offset-4"
          >
            I already have an account
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="bg-card shadow-card rounded-3xl p-6">
              <f.icon className="text-primary size-8" aria-hidden />
              <h2 className="mt-3 text-xl">{f.title}</h2>
              <p className="text-muted-foreground mt-2 text-base">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="text-muted-foreground px-5 pb-12 text-center text-sm">
        Made for busy families across India.
      </footer>
    </div>
  );
}
