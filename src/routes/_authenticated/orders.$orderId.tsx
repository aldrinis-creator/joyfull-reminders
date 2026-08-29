import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, CreditCard, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { createCheckoutSession } from "@/lib/payments.functions";
import { ORDER_STEPS, formatDate, orderStatusLabel, rupees } from "@/lib/ereminder";
import { useT } from "@/hooks/useLanguage";
import { activeLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order & delivery tracking — e-Reminder" },
      {
        name: "description",
        content: "Pay for your gift order and follow it from the shop to the doorstep.",
      },
      { property: "og:title", content: "Order & delivery tracking — e-Reminder" },
      { property: "og:description", content: "Payment status and live delivery updates." },
    ],
  }),
  component: OrderPage,
});

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const STEP_ICON = {
  paid: CreditCard,
  confirmed: CheckCircle2,
  out_for_delivery: Truck,
  delivered: PackageCheck,
} as const;

function OrderPage() {
  const t = useT();
  const { orderId } = Route.useParams();
  const queryClient = useQueryClient();
  const startCheckout = useServerFn(createCheckoutSession);
  const [paying, setPaying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const [order, events] = await Promise.all([
        supabase
          .from("orders")
          .select("*, vendors(name, phone, city), vendor_products(name, description)")
          .eq("id", orderId)
          .maybeSingle(),
        supabase
          .from("order_events")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true }),
      ]);
      return { order: order.data, events: events.data ?? [] };
    },
    refetchInterval: (query) =>
      query.state.data?.order?.status === "pending_payment" ? 4000 : false,
  });

  const order = data?.order;

  useEffect(() => {
    if (document.getElementById("razorpay-checkout")) return;
    const script = document.createElement("script");
    script.id = "razorpay-checkout";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const pay = async () => {
    setPaying(true);
    try {
      const session = await startCheckout({ data: { orderId } });
      if (!session.configured) {
        toast.error(t("market.errPaymentsOff"));
        return;
      }
      if (!window.Razorpay) {
        toast.error(t("market.errCheckoutLoading"));
        return;
      }
      const checkout = new window.Razorpay({
        key: session.keyId,
        order_id: session.providerOrderId,
        amount: session.amountPaise,
        currency: session.currency,
        name: "e-Reminder",
        description: session.description,
        prefill: {
          name: session.customerName ?? undefined,
          email: session.customerEmail ?? undefined,
        },
        theme: { color: "#ff6b57" },
        handler: () => {
          toast.success(t("market.paySubmitted"));
          void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        },
      });
      checkout.open();
    } catch (err) {
      console.error(err);
      toast.error(t("market.errPayStart"));
    } finally {
      setPaying(false);
    }
  };

  const currentIndex = order ? ORDER_STEPS.indexOf(order.status) : -1;

  return (
    <AppShell
      title={t("market.yourOrder")}
      subtitle={order ? orderStatusLabel(order.status) : undefined}
      action={
        <Button asChild variant="secondary" size="lg" className="h-12">
          <Link to="/market">
            <ArrowLeft className="size-5" aria-hidden /> {t("market.shop")}
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-64 rounded-3xl" />
      ) : !order ? (
        <p className="bg-card shadow-card rounded-3xl px-6 py-12 text-center">{t("market.orderNotFound")}</p>
      ) : (
        <div className="space-y-4 pb-8">
          <section className="bg-card shadow-card rounded-3xl p-5">
            <h2 className="text-xl">{order.vendor_products?.name ?? t("market.gift")}</h2>
            <p className="text-muted-foreground text-sm">{t("market.fromShop", { name: order.vendors?.name ?? "" })}</p>
            <dl className="mt-4 space-y-2 text-base">
              <Row label={t("market.amount")} value={rupees(order.amount_paise)} />
              <Row label={t("market.for")} value={order.recipient_name ?? "—"} />
              <Row
                label={t("market.deliveryDate")}
                value={order.delivery_date ? formatDate(order.delivery_date) : "—"}
              />
              <Row label={t("market.address")} value={order.delivery_address ?? "—"} />
              {order.gift_message ? <Row label={t("market.message")} value={order.gift_message} /> : null}
            </dl>
          </section>

          {order.status === "pending_payment" ? (
            <Button size="lg" className="h-15 w-full text-lg" disabled={paying} onClick={pay}>
              <CreditCard className="size-5" aria-hidden /> {t("market.payNow", { amount: rupees(order.amount_paise) })}
            </Button>
          ) : (
            <section className="bg-card shadow-card rounded-3xl p-5">
              <h2 className="text-xl">{t("market.tracking")}</h2>
              <ol className="mt-4 space-y-4">
                {ORDER_STEPS.map((step, i) => {
                  const Icon = STEP_ICON[step as keyof typeof STEP_ICON];
                  const done = i <= currentIndex;
                  return (
                    <li key={step} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-full",
                          done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className={cn("font-semibold", !done && "text-muted-foreground")}>
                        {orderStatusLabel(step)}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {order.status === "delivered" ? (
                <p className="bg-success/15 text-success mt-5 rounded-2xl px-4 py-3 text-center font-bold">
                  {t("market.deliveredNote")}
                </p>
              ) : null}
            </section>
          )}

          {(data?.events.length ?? 0) > 0 ? (
            <section className="bg-card shadow-card rounded-3xl p-5">
              <h2 className="text-xl">{t("market.updates")}</h2>
              <ul className="mt-3 space-y-2">
                {data!.events.map((e) => (
                  <li key={e.id} className="bg-muted rounded-2xl px-4 py-3">
                    <p className="font-semibold">{orderStatusLabel(e.status)}</p>
                    <p className="text-muted-foreground text-sm">
                      {e.note ?? ""} · {new Date(e.created_at).toLocaleString(activeLocale())}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-none">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
