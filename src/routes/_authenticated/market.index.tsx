import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, Star, Truck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile, useVendors } from "@/lib/queries";
import { VENDOR_KINDS, haversineKm, type VendorKind } from "@/lib/ereminder";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/market/")({
  head: () => ({
    meta: [
      { title: "Gift marketplace — e-Reminder" },
      {
        name: "description",
        content:
          "Order cakes, flowers and gifts from florists, bakeries and gift shops near you, or from pan-India sellers.",
      },
      { property: "og:title", content: "Gift marketplace — e-Reminder" },
      {
        property: "og:description",
        content: "Local florists, bakeries and gift shops ready to deliver for your next milestone.",
      },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const { data: vendors, isLoading } = useVendors();
  const { data: profile } = useProfile();
  const [filter, setFilter] = useState<VendorKind | "all">("all");
  const [nearbyOnly, setNearbyOnly] = useState(false);

  const origin =
    profile?.latitude != null && profile?.longitude != null
      ? { lat: profile.latitude, lng: profile.longitude }
      : null;

  const list = useMemo(() => {
    const withDistance = (vendors ?? []).map((v) => ({
      vendor: v,
      distance:
        origin && v.latitude != null && v.longitude != null
          ? haversineKm(origin, { lat: v.latitude, lng: v.longitude })
          : null,
    }));
    return withDistance
      .filter((v) => (filter === "all" ? true : v.vendor.kind === filter))
      .filter((v) => {
        if (!nearbyOnly) return true;
        if (v.vendor.ships_all_india) return true;
        return v.distance != null && v.distance <= v.vendor.service_radius_km;
      })
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  }, [vendors, filter, nearbyOnly, origin]);

  return (
    <AppShell title="Marketplace" subtitle="Cake, flowers and gifts, delivered">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All shops
        </FilterChip>
        {VENDOR_KINDS.map((k) => (
          <FilterChip key={k.value} active={filter === k.value} onClick={() => setFilter(k.value)}>
            {k.emoji} {k.label}
          </FilterChip>
        ))}
      </div>

      <div className="bg-card shadow-card mb-4 flex items-center justify-between gap-3 rounded-3xl px-5 py-4">
        <div className="min-w-0">
          <p className="font-semibold">
            {origin ? "Showing shops around your saved location" : "Location not set"}
          </p>
          <p className="text-muted-foreground text-sm">
            {origin
              ? "Nearby means within each shop's delivery radius."
              : "Add your location in Profile to sort shops by distance."}
          </p>
        </div>
        <Button
          variant={nearbyOnly ? "default" : "outline"}
          className="h-12 shrink-0"
          onClick={() => setNearbyOnly((v) => !v)}
        >
          Nearby
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground bg-card shadow-card rounded-3xl px-6 py-12 text-center">
          No shops match that filter yet.
        </p>
      ) : (
        <div className="space-y-3 pb-6">
          {list.map(({ vendor, distance }) => (
            <Link
              key={vendor.id}
              to="/market/$vendorId"
              params={{ vendorId: vendor.id }}
              className="bg-card shadow-card block rounded-3xl p-5 transition-transform active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="bg-muted rounded-full px-2.5 py-1 text-xs font-bold">
                    {VENDOR_KINDS.find((k) => k.value === vendor.kind)?.emoji}{" "}
                    {VENDOR_KINDS.find((k) => k.value === vendor.kind)?.label}
                  </span>
                  <h2 className="mt-2 text-xl">{vendor.name}</h2>
                  <p className="text-muted-foreground text-sm">{vendor.description}</p>
                  <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" aria-hidden /> {vendor.city}
                      {distance != null ? ` · ${distance.toFixed(1)} km` : ""}
                    </span>
                    {vendor.ships_all_india ? (
                      <span className="inline-flex items-center gap-1">
                        <Truck className="size-4" aria-hidden /> All India
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="bg-accent text-accent-foreground inline-flex shrink-0 items-center gap-1 rounded-2xl px-3 py-2 text-sm font-bold">
                  <Star className="size-4 fill-current" aria-hidden /> {vendor.rating}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 shrink-0 rounded-full px-4 text-sm font-bold whitespace-nowrap",
        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-card",
      )}
    >
      {children}
    </button>
  );
}
