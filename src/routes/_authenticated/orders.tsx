import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/orders")({
  staticData: { sitemap: false },
  component: OrdersLayout,
});

function OrdersLayout() {
  return <Outlet />;
}