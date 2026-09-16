import { createFileRoute, Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useLanguage";
import { useOrders } from "@/lib/queries";
import { formatDate, orderStatusLabel, rupees } from "@/lib/ereminder";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — My-Mitr" },
      { name: "description", content: "See your My-Mitr gift orders, payments and delivery updates." },
      { property: "og:title", content: "Orders — My-Mitr" },
      { property: "og:description", content: "Gift order history and delivery progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const t = useT();
  const { data: orders, isLoading } = useOrders();

  return (
    <AppShell title={t("nav.orders")} subtitle={t("profile.ordersSubtitle")}>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 rounded-[26px]" />)}
        </div>
      ) : orders?.length ? (
        <ul className="space-y-3 pb-6">
          {orders.map((order) => {
            const item = order.vendor_products?.name ?? t("market.gift");
            return (
              <li key={order.id}>
                <Link
                  to="/orders/$orderId"
                  params={{ orderId: order.id }}
                  aria-label={t("profile.viewOrder", { item })}
                  className="bg-card shadow-card flex min-h-24 items-center gap-4 rounded-[26px] p-5"
                >
                  <span className="bg-accent-2-100 text-accent-2-800 flex size-12 shrink-0 items-center justify-center rounded-2xl">
                    <Package className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">{item}</span>
                    <span className="text-muted-foreground mt-1 block text-[12.5px]">
                      {order.vendors?.name} · {order.delivery_date ? formatDate(order.delivery_date) : "—"}
                    </span>
                    <span className="text-accent-2-700 mt-1 block text-xs font-semibold">{orderStatusLabel(order.status)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{rupees(order.amount_paise)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="bg-card shadow-card rounded-[26px] px-6 py-12 text-center">
          <Package className="text-accent-2-700 mx-auto size-10" aria-hidden />
          <p className="text-muted-foreground mt-3 text-sm">{t("profile.noOrders")}</p>
        </div>
      )}
    </AppShell>
  );
}