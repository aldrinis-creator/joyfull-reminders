import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Bell, CalendarHeart, Gift, ShieldCheck, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useLanguage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My-Mitr — Never miss a birthday, bill or deadline again" },
      {
        name: "description",
        content:
          "My-Mitr tracks family birthdays, tax and PUC deadlines, bills and exam dates, then helps you send cake, flowers or gifts from shops near you.",
      },
      { property: "og:title", content: "My-Mitr — Never miss a moment that matters" },
      {
        property: "og:description",
        content:
          "Family milestones, bill and PUC reminders, loud due-date alarms, and gifting from local florists and bakeries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: CalendarHeart, key: "milestones" },
  { icon: Bell, key: "alarms" },
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
      <div className="mx-auto w-full max-w-[900px] overflow-hidden">
        <nav
          aria-label={t("public.navLabel")}
          className="flex h-[84px] items-center gap-7 px-5 sm:px-10"
        >
          <Link to="/" className="font-display text-[21px] leading-none text-foreground">
            {t("appName")}
          </Link>
          <div className="ml-auto flex items-center gap-5 sm:gap-7">
            <a
              href="#features"
              className="hidden text-sm font-semibold text-foreground/70 hover:text-foreground sm:inline"
            >
              {t("public.navFeatures")}
            </a>
            <Link
              to="/auth"
              className="hidden text-sm font-semibold text-foreground/70 hover:text-foreground min-[420px]:inline"
            >
              {t("public.navSignIn")}
            </Link>
            <Button asChild className="h-11 rounded-full px-5 text-sm font-semibold shadow-none">
              <Link to="/auth">{t("public.createAccountShort")}</Link>
            </Button>
          </div>
        </nav>

        <main>
          <section className="relative overflow-hidden px-5 pt-10 pb-[60px] sm:px-10 sm:pt-14">
            <div
              className="pointer-events-none absolute -top-14 -right-14 z-0 size-[400px] rounded-full bg-accent-200"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-[130px] right-[250px] z-0 size-[220px] rounded-full bg-accent-2-200"
              aria-hidden
            />

            <div
              className="washed absolute top-5 -right-4 z-10 flex size-28 items-center justify-center overflow-hidden rounded-full border border-foreground/10 bg-card shadow-sm md:top-[26px] md:right-[26px] md:size-[262px]"
              role="img"
              aria-label={t("public.photoPlaceholder")}
            >
              <UsersRound className="size-10 text-secondary/75 md:size-20" strokeWidth={1.5} aria-hidden />
            </div>

            <div className="relative z-20 max-w-[560px]">
              <p className="inline-flex rounded-full bg-accent-2-100 px-3 py-1.5 text-[13px] font-semibold text-accent-2-700">
                {t("public.familyTag")}
              </p>
              <h1 className="mt-5 max-w-[560px] text-[44px] leading-[1.02] sm:text-[52px] md:text-[60px]">
                {t("public.heroTitle")}
              </h1>
              <p className="mt-5 max-w-[480px] text-lg leading-[1.55] text-foreground/70 md:max-w-[510px] md:pr-24">
                {t("public.heroBody")}
              </p>
              <div className="mt-7 flex flex-col items-start gap-4 min-[460px]:flex-row min-[460px]:items-center">
                <Button
                  asChild
                  className="h-14 rounded-full px-7 text-base font-semibold shadow-none"
                >
                  <Link to="/auth">{t("public.createAccount")}</Link>
                </Button>
                <Link
                  to="/auth"
                  className="text-[15px] font-semibold text-foreground underline decoration-1 underline-offset-4"
                >
                  {t("public.haveAccount")}
                </Link>
              </div>
              <p className="mt-5 text-[13.5px] leading-5 text-foreground/55">
                {t("public.freeNote")}
              </p>
            </div>
          </section>

          <section id="features" className="px-5 py-8 sm:px-10 sm:py-10">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {FEATURES.map((feature, index) => (
                <article
                  key={feature.key}
                  className="rounded-[28px] bg-card px-6 py-[22px] shadow-sm md:px-[22px]"
                >
                  <span
                    className={`flex size-10 items-center justify-center rounded-full ${
                      index % 2 === 0 ? "bg-accent-200" : "bg-accent-2-200"
                    }`}
                  >
                    <feature.icon className="size-5 text-foreground" strokeWidth={2.75} aria-hidden />
                  </span>
                  <h2 className="mt-5 text-[19px] leading-[1.15]">
                    {t(`public.feature.${feature.key}.title`)}
                  </h2>
                  <p className="mt-2.5 text-sm leading-[1.5] text-foreground/60">
                    {t(`public.feature.${feature.key}.body`)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <footer className="px-5 pt-3 pb-10 text-center text-[13.5px] text-foreground/50 sm:px-10">
          {t("public.footer")}
        </footer>
      </div>
    </div>
  );
}
