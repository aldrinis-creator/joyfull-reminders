import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, Star, Truck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFamilyMembers, useProfile, useVendors } from "@/lib/queries";
import { VENDOR_KINDS, haversineKm, vendorKindLabel, type VendorKind } from "@/lib/ereminder";
import { useT } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

type MarketSearch = { pin?: string | undefined; for?: string | undefined };

export const Route = createFileRoute("/_authenticated/market/")({
  validateSearch: (search: Record<string, unknown>): MarketSearch => ({
    pin: typeof search["pin"] === "string" ? search["pin"] : undefined,
    for: typeof search["for"] === "string" ? search["for"] : undefined,
  }),
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
  const t = useT();
  const { data: vendors, isLoading } = useVendors();
  const { data: profile } = useProfile();
  const { data: members } = useFamilyMembers();
  const { pin, for: forMemberId } = Route.useSearch();
  const recipient = (members ?? []).find((m) => m.id === forMemberId);
  const recipientPin = pin ?? recipient?.pincode ?? null;
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
    const scored = withDistance.map((v) => {
      const serviceable = recipientPin
        ? v.vendor.serviceable_pincodes.includes(recipientPin)
        : false;
      const samePin = recipientPin ? v.vendor.pincode === recipientPin : false;
      const rank = recipientPin
        ? samePin
          ? 0
          : serviceable
            ? 1
            : v.vendor.ships_all_india
              ? 2
              : 3
        : 0;
      return { ...v, rank, serviceable: serviceable || samePin };
    });

    return scored
      .filter((v) => (filter === "all" ? true : v.vendor.kind === filter))
      .filter((v) => {
        if (recipientPin) return v.rank < 3;
        if (!nearbyOnly) return true;
        if (v.vendor.ships_all_india) return true;
        return v.distance != null && v.distance <= v.vendor.service_radius_km;
      })
      .sort((a, b) => a.rank - b.rank || (a.distance ?? 999) - (b.distance ?? 999));
  }, [vendors, filter, nearbyOnly, origin, recipientPin]);

  return (
    <AppShell title={t("market.title")} subtitle={t("market.subtitle")}>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          {t("market.allShops")}
        </FilterChip>
        {VENDOR_KINDS.map((k) => (
          <FilterChip key={k.value} active={filter === k.value} onClick={() => setFilter(k.value)}>
            {k.emoji} {vendorKindLabel(k.value)}
          </FilterChip>
        ))}
      </div>

      {recipientPin || recipient ? (
        <div className="bg-accent/30 mb-4 rounded-3xl px-5 py-4">
          <p className="font-semibold">
            {t("market.gifting", { name: recipient ? recipient.full_name : t("market.someone") })}
            {recipientPin ? ` · ${t("market.pincodeLabel", { pincode: recipientPin })}` : ""}
          </p>
          <p className="text-muted-foreground text-sm">
            {recipientPin ? t("market.pinHintYes") : t("market.pinHintNo")}
          </p>
          {recipient && !recipientPin ? (
            <Button asChild variant="secondary" className="mt-3 h-11">
              <Link to="/family/$memberId" params={{ memberId: recipient.id }}>
                {t("market.addTheirPincode")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="bg-card shadow-card mb-4 flex items-center justify-between gap-3 rounded-3xl px-5 py-4">
        <div className="min-w-0">
          <p className="font-semibold">
            {origin ? t("market.locOn") : t("market.locOff")}
          </p>
          <p className="text-muted-foreground text-sm">
            {origin ? t("market.locOnHint") : t("market.locOffHint")}
          </p>
        </div>
        <Button
          variant={nearbyOnly ? "default" : "outline"}
          className="h-12 shrink-0"
          onClick={() => setNearbyOnly((v) => !v)}
        >
          {t("market.nearby")}
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
          {t("market.noShops")}
        </p>
      ) : (
        <div className="space-y-3 pb-6">
          {list.map(({ vendor, distance, serviceable }) => (
            <Link
              key={vendor.id}
              to="/market/$vendorId"
              params={{ vendorId: vendor.id }}
              search={{ pin: recipientPin ?? undefined, for: recipient?.id }}
              className="bg-card shadow-card block rounded-3xl p-5 transition-transform active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="bg-muted rounded-full px-2.5 py-1 text-xs font-bold">
                    {VENDOR_KINDS.find((k) => k.value === vendor.kind)?.emoji}{" "}
                    {vendorKindLabel(vendor.kind)}
                  </span>
                  <h2 className="mt-2 text-xl">{vendor.name}</h2>
                  <p className="text-muted-foreground text-sm">{vendor.description}</p>
                  <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" aria-hidden /> {vendor.city}
                      {distance != null ? ` · ${distance.toFixed(1)} km` : ""}
                    </span>
                    {recipientPin && serviceable ? (
                      <span className="text-primary font-bold">{t("market.deliversTo", { pincode: recipientPin })}</span>
                    ) : null}
                    {vendor.ships_all_india ? (
                      <span className="inline-flex items-center gap-1">
                        <Truck className="size-4" aria-hidden /> {t("market.allIndia")}
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
