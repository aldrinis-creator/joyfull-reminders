import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersLayout,
});

function OrdersLayout() {
  return <Outlet />;
}