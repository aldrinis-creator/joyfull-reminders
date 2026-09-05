import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CARD_STYLES, OCCASIONS } from "@/lib/greetings";
import { getPublicGreeting } from "@/lib/greetings.functions";
import { useT } from "@/hooks/useLanguage";

export const Route = createFileRoute("/greeting/$id")({
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
  loader: ({ params }) => getPublicGreeting({ data: { greetingId: params.id } }),
  component: GreetingCardPage,
});

function GreetingCardPage() {
  const t = useT();
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();
  const { data } = useQuery({
    queryKey: ["public-greeting", id],
    queryFn: () => getPublicGreeting({ data: { greetingId: id } }),
    initialData: initial,
    staleTime: 5 * 60 * 1000,
  });

  const style =
    CARD_STYLES.find((c) => c.value === data?.cardStyle) ?? CARD_STYLES[0]!;
  const occasion = OCCASIONS.find((x) => x.value === data?.occasion);

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
          {data?.recipientName ? t("public.forName", { name: data.recipientName }) : ""}
        </h1>
        <p className="mt-4 text-lg whitespace-pre-line">
          {data?.message ?? t("public.defaultWish")}
        </p>

        {data?.voiceUrl ? (
          <section className="mt-6 rounded-2xl bg-black/15 p-4">
            <p className="text-sm font-bold">{t("public.voiceNote")}</p>
            <audio className="mt-3 w-full" controls preload="none" src={data.voiceUrl}>
              {t("public.voiceNoteFallback")}
            </audio>
          </section>
        ) : null}

        <p className="mt-8 text-sm font-bold opacity-90">{t("public.sentWith")}</p>
      </article>
    </main>
  );
}
