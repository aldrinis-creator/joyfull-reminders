import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { createGiftOrder } from "@/lib/orders.functions";
import { useFamilyMembers, useVendor } from "@/lib/queries";
import { VENDOR_KINDS, rupees, type VendorProduct } from "@/lib/ereminder";
import { useT } from "@/hooks/useLanguage";

type VendorSearch = { pin?: string | undefined; for?: string | undefined };

export const Route = createFileRoute("/_authenticated/market/$vendorId")({
  validateSearch: (search: Record<string, unknown>): VendorSearch => ({
    pin: typeof search["pin"] === "string" ? search["pin"] : undefined,
    for: typeof search["for"] === "string" ? search["for"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop details — e-Reminder" },
      {
        name: "description",
        content: "Browse this shop's cakes, bouquets and hampers and place a gift order.",
      },
      { property: "og:title", content: "Shop details — e-Reminder" },
      { property: "og:description", content: "Pick a gift and schedule the delivery date." },
    ],
  }),
  component: VendorPage,
});

const orderSchema = z.object({
  recipient: z.string().trim().min(1, "market.errRecipient").max(100),
  address: z.string().trim().min(6, "market.errAddress").max(400),
  city: z.string().trim().min(2, "market.errCity").max(80),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "family.errPincode"),
  date: z.string().min(1, "market.errDate"),
  message: z.string().trim().max(300).optional(),
});


function VendorPage() {
  const t = useT();
  const { vendorId } = Route.useParams();
  const { data, isLoading } = useVendor(vendorId);
  const { pin, for: forMemberId } = Route.useSearch();
  const { data: members } = useFamilyMembers();
  const recipient = (members ?? []).find((m) => m.id === forMemberId);
  const recipientPin = pin ?? recipient?.pincode ?? null;
  const [selected, setSelected] = useState<VendorProduct | null>(null);

  const vendor = data?.vendor;

  return (
    <AppShell
      title={vendor?.name ?? t("market.shop")}
      subtitle={vendor?.description ?? undefined}
      action={
        <Button asChild variant="secondary" size="lg" className="h-12">
          <Link to="/market">
            <ArrowLeft className="size-5" aria-hidden /> {t("back")}
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : !vendor ? (
        <p className="bg-card shadow-card rounded-3xl px-6 py-12 text-center">
          {t("market.shopGone")}
        </p>
      ) : (
        <div className="space-y-4 pb-8">
          <div className="bg-card shadow-card flex flex-wrap items-center gap-x-5 gap-y-2 rounded-3xl px-5 py-4 text-sm font-semibold">
            <span className="inline-flex items-center gap-1">
              <Star className="text-accent size-4 fill-current" aria-hidden /> {vendor.rating}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {vendor.address}, {vendor.city}
            </span>
            <span>
              {VENDOR_KINDS.find((k) => k.value === vendor.kind)?.emoji}{" "}
              {t("market.deliversWithin", { km: vendor.service_radius_km })}
              {vendor.ships_all_india ? ` · ${t("market.shipsAllIndia")}` : ""}
            </span>
          </div>

          {recipientPin ? (
            <p className="bg-accent/30 rounded-3xl px-5 py-4 font-semibold">
              {vendor.serviceable_pincodes.includes(recipientPin) || vendor.pincode === recipientPin
                ? `${t("market.deliversTo", { pincode: recipientPin })}${
                    recipient ? ` — ${t("market.theirArea", { name: recipient.full_name })}` : ""
                  }.`
                : vendor.ships_all_india
                  ? t("market.courierCovered", { pincode: recipientPin })
                  : t("market.mayNotDeliver", { pincode: recipientPin })}
            </p>
          ) : null}

          {(data?.products ?? []).map((p) => (
            <article key={p.id} className="bg-card shadow-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {p.tag ? (
                    <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-1 text-xs font-bold">
                      {p.tag}
                    </span>
                  ) : null}
                  <h2 className="mt-2 text-xl">{p.name}</h2>
                  <p className="text-muted-foreground text-sm">{p.description}</p>
                </div>
                <p className="shrink-0 text-xl font-bold">{rupees(p.price_paise)}</p>
              </div>
              <Button
                size="lg"
                className="mt-4 h-13 w-full text-base"
                onClick={() => setSelected(p)}
              >
                {t("market.orderThis")}
              </Button>
            </article>
          ))}

          {(data?.products.length ?? 0) === 0 ? (
            <p className="text-muted-foreground bg-card shadow-card rounded-3xl px-6 py-12 text-center">
              {t("market.noProducts")}
            </p>
          ) : null}
        </div>
      )}

      {selected && vendor ? (
        <OrderDialog
          product={selected}
          vendorId={vendor.id}
          onClose={() => setSelected(null)}
          recipientName={recipient?.full_name ?? ""}
          recipientPin={recipientPin ?? ""}
          recipientCity={recipient?.city ?? ""}
        />
      ) : null}
    </AppShell>
  );
}

function OrderDialog({
  product,
  vendorId,
  onClose,
  recipientName,
  recipientPin,
  recipientCity,
}: {
  product: VendorProduct;
  vendorId: string;
  onClose: () => void;
  recipientName: string;
  recipientPin: string;
  recipientCity: string;
}) {
  const t = useT();
  const navigate = useNavigate();
  const { data: members } = useFamilyMembers();
  const [recipient, setRecipient] = useState(recipientName);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(recipientCity);
  const [pincode, setPincode] = useState(recipientPin);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const placeOrder = useServerFn(createGiftOrder);

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{product.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xl font-bold">{rupees(product.price_paise)}</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="o-recipient">{t("market.deliverTo")}</Label>
            <Input
              id="o-recipient"
              list="family-names"
              value={recipient}
              maxLength={100}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={t("market.recipientPlaceholder")}
              className="h-12"
            />
            <datalist id="family-names">
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.full_name} />
              ))}
            </datalist>
          </div>
          <AddressAutocomplete
            id="o-address"
            label={t("market.deliveryAddress")}
            value={address}
            onChange={setAddress}
            onResolved={(a) => {
              if (a.city) setCity(a.city);
              if (a.pincode) setPincode(a.pincode);
            }}
            multiline
            placeholder={t("market.addressPlaceholder")}
            hint={t("market.addressHint")}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="o-city">{t("family.city")}</Label>
              <Input
                id="o-city"
                value={city}
                maxLength={80}
                onChange={(e) => setCity(e.target.value)}
                className="h-12 w-full min-w-0"
                placeholder={t("family.cityPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-pin">{t("family.pincode")}</Label>
              <Input
                id="o-pin"
                value={pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                className="h-12 w-full min-w-0"
                placeholder="400069"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="o-date">{t("market.deliveryDate")}</Label>
            <Input
              id="o-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 w-full min-w-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="o-message">{t("market.giftMessage")}</Label>
            <Input
              id="o-message"
              value={message}
              maxLength={300}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("market.giftMessagePlaceholder")}
              className="h-12"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            size="lg"
            className="h-14 w-full text-base"
            disabled={saving}
            onClick={async () => {
              const parsed = orderSchema.safeParse({
                recipient,
                address,
                city,
                pincode,
                date,
                message,
              });
              if (!parsed.success) {
                toast.error(t(parsed.error.issues[0]?.message ?? "family.errDetails"));
                return;
              }
              setSaving(true);
              const match = (members ?? []).find(
                (m) => m.full_name.toLowerCase() === parsed.data.recipient.toLowerCase(),
              );
              try {
                const { orderId } = await placeOrder({
                  data: {
                    vendorId,
                    productId: product.id,
                    familyMemberId: match?.id ?? null,
                    recipientName: parsed.data.recipient,
                    deliveryAddress: parsed.data.address,
                    deliveryCity: parsed.data.city,
                    deliveryPincode: parsed.data.pincode,
                    deliveryDate: parsed.data.date,
                    giftMessage: parsed.data.message || null,
                  },
                });

                setSaving(false);
                navigate({ to: "/orders/$orderId", params: { orderId } });
              } catch {
                setSaving(false);
                toast.error(t("market.errCreateOrder"));
              }
            }}
          >
            {saving ? t("saving") : t("market.continuePayment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
