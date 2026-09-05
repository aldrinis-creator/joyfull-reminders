import { createFileRoute } from "@tanstack/react-router";
import { CARD_STYLES, OCCASIONS } from "@/lib/greetings";
import { useT } from "@/hooks/useLanguage";

type Search = {
  to?: string | undefined;
  m?: string | undefined;
  s?: string | undefined;
  o?: string | undefined;
};

export const Route = createFileRoute("/greeting/$id")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    to: typeof search["to"] === "string" ? search["to"] : undefined,
    m: typeof search["m"] === "string" ? search["m"] : undefined,
    s: typeof search["s"] === "string" ? search["s"] : undefined,
    o: typeof search["o"] === "string" ? search["o"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "A greeting just for you — e-Reminder" },
      {
        name: "description",
        content: "Someone who remembers your special day sent you a greeting card.",
      },
      { property: "og:title", content: "A greeting just for you" },
      { property: "og:description", content: "Open your personal greeting card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GreetingCardPage,
});

function GreetingCardPage() {
  const t = useT();
  const { to, m, s, o } = Route.useSearch();
  const style = CARD_STYLES.find((c) => c.value === s) ?? CARD_STYLES[0]!;
  const occasion = OCCASIONS.find((x) => x.value === o);

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center p-4">
      <article
        className="shadow-card w-full max-w-md rounded-[2rem] p-8 text-white"
        style={{ backgroundImage: style.gradient }}
      >
        <p className="text-5xl" aria-hidden>
          {occasion?.emoji ?? style.emoji}
        </p>
        <h1 className="mt-4 text-3xl">
          {occasion ? t(`family.occ.${occasion.value}`) : t("public.aGreeting")}{" "}
          {to ? t("public.forName", { name: to }) : ""}
        </h1>
        <p className="mt-4 text-lg whitespace-pre-line">
          {m ?? t("public.defaultWish")}
        </p>
        <p className="mt-8 text-sm font-bold opacity-90">{t("public.sentWith")}</p>
      </article>
    </main>
  );
}
