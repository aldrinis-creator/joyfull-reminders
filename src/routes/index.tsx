import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BellRing, CalendarHeart, Gift, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useLanguage";

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
  { icon: CalendarHeart, key: "milestones" },
  { icon: BellRing, key: "alarms" },
  { icon: ShieldCheck, key: "deadlines" },
  { icon: Gift, key: "gifting" },
] as const;

function Landing() {
  const t = useT();
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/home", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <section className="gradient-warm rounded-b-[2.5rem] px-6 pt-16 pb-14 text-center">
        <p className="text-primary-foreground/90 text-sm font-bold tracking-widest uppercase">
          {t("appName")}
        </p>
        <h1 className="text-primary-foreground mx-auto mt-4 max-w-xl text-4xl sm:text-5xl">
          {t("public.heroTitle")}
        </h1>
        <p className="text-primary-foreground/95 mx-auto mt-4 max-w-md text-lg">
          {t("public.heroBody")}
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button asChild size="lg" className="bg-indigo text-indigo-foreground h-14 w-64 text-lg">
            <Link to="/auth">{t("public.createAccount")}</Link>
          </Button>
          <Link
            to="/auth"
            className="text-primary-foreground text-base font-semibold underline underline-offset-4"
          >
            {t("public.haveAccount")}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.key} className="bg-card shadow-card rounded-3xl p-6">
              <f.icon className="text-primary size-8" aria-hidden />
              <h2 className="mt-3 text-xl">{t(`public.feature.${f.key}.title`)}</h2>
              <p className="text-muted-foreground mt-2 text-base">
                {t(`public.feature.${f.key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="text-muted-foreground px-5 pb-12 text-center text-sm">
        {t("public.footer")}
      </footer>
    </div>
  );
}
