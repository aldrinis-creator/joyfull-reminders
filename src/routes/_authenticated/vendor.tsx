import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Store } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/hooks/useLanguage";
import {
  orderStatusLabel,
  vendorKindLabel,
  ORDER_STEPS,
  VENDOR_KINDS,
  formatDate,
  rupees,
  type OrderStatus,
  type VendorKind,
} from "@/lib/ereminder";

export const Route = createFileRoute("/_authenticated/vendor")({
  head: () => ({
    meta: [
      { title: "Vendor portal — e-Reminder" },
      {
        name: "description",
        content:
          "Florists, bakeries and gift shops: list your shop, publish your catalogue and update delivery status.",
      },
      { property: "og:title", content: "Vendor portal — e-Reminder" },
      { property: "og:description", content: "Register your shop and manage incoming gift orders." },
    ],
  }),
  component: VendorPortal,
});

const shopSchema = z.object({
  name: z.string().trim().min(2, "market.errShopName").max(100),
  city: z.string().trim().min(2, "market.errShopCity").max(80),
  address: z.string().trim().max(300).optional(),
  description: z.string().trim().max(500).optional(),
});

function VendorPortal() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my_vendor"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return { shop: null, products: [], orders: [] };
      const { data: shop } = await supabase
        .from("vendors")
        .select("*")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!shop) return { shop: null, products: [], orders: [] };
      const [{ data: products }, { data: orders }] = await Promise.all([
        supabase.from("vendor_products").select("*").eq("vendor_id", shop.id).order("created_at"),
        supabase
          .from("orders")
          .select("*, vendor_products(name)")
          .eq("vendor_id", shop.id)
          .neq("status", "pending_payment")
          .order("created_at", { ascending: false }),
      ]);
      return { shop, products: products ?? [], orders: orders ?? [] };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my_vendor"] });

  return (
    <AppShell title={t("market.vendorPortal")} subtitle={t("market.vendorSubtitle")}>
      {isLoading ? null : !data?.shop ? (
        <RegisterShop onSaved={refresh} />
      ) : (
        <div className="space-y-4 pb-8">
          <section className="bg-card shadow-card rounded-3xl p-5">
            <h2 className="text-xl">{data.shop.name}</h2>
            <p className="text-muted-foreground text-sm">
              {vendorKindLabel(data.shop.kind)} · {data.shop.city} ·{" "}
              {t("market.deliversWithin", { km: data.shop.service_radius_km })}
              {data.shop.ships_all_india ? ` · ${t("market.shipsAllIndia")}` : ""}
            </p>
          </section>

          <CoverageSection
            vendorId={data.shop.id}
            pincode={data.shop.pincode ?? ""}
            pins={data.shop.serviceable_pincodes}
            onSaved={refresh}
          />

          <section className="bg-card shadow-card rounded-3xl p-5">
            <h2 className="text-xl">{t("market.catalogue")}</h2>
            <ul className="mt-3 space-y-2">
              {data.products.map((p) => (
                <li
                  key={p.id}
                  className="bg-muted flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="font-bold">{rupees(p.price_paise)}</span>
                </li>
              ))}
              {data.products.length === 0 ? (
                <li className="text-muted-foreground text-sm">{t("market.nothingListed")}</li>
              ) : null}
            </ul>
            <AddProduct vendorId={data.shop.id} onSaved={refresh} />
          </section>

          <section className="bg-card shadow-card rounded-3xl p-5">
            <h2 className="text-xl">{t("market.incomingOrders")}</h2>
            <ul className="mt-3 space-y-3">
              {data.orders.map((o) => (
                <li key={o.id} className="bg-muted rounded-2xl px-4 py-3">
                  <p className="font-semibold">
                    {o.vendor_products?.name ?? t("market.gift")} · {rupees(o.amount_paise)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {o.recipient_name} ·{" "}
                    {o.delivery_date ? formatDate(o.delivery_date) : t("market.noDate")} ·{" "}
                    {orderStatusLabel(o.status)}
                  </p>
                  <p className="text-sm">{o.delivery_address}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ORDER_STEPS.filter((s) => s !== "paid").map((step) => (
                      <Button
                        key={step}
                        size="sm"
                        variant={o.status === step ? "default" : "outline"}
                        className="h-11"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("orders")
                            .update({ status: step as OrderStatus })
                            .eq("id", o.id);
                          if (error) {
                            toast.error(t("market.errUpdateOrder"));
                            return;
                          }
                          await supabase
                            .from("order_events")
                            .insert({ order_id: o.id, status: step as OrderStatus });
                          toast.success(t("market.markedAs", { status: orderStatusLabel(step) }));
                          refresh();
                        }}
                      >
                        {orderStatusLabel(step)}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
              {data.orders.length === 0 ? (
                <li className="text-muted-foreground text-sm">{t("market.noPaidOrders")}</li>
              ) : null}
            </ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function CoverageSection({
  vendorId,
  pincode,
  pins,
  onSaved,
}: {
  vendorId: string;
  pincode: string;
  pins: string[];
  onSaved: () => void;
}) {
  const t = useT();
  const [pin, setPin] = useState(pincode);
  const [list, setList] = useState(pins.join(", "));
  const [saving, setSaving] = useState(false);

  return (
    <section className="bg-card shadow-card rounded-3xl p-5">
      <h2 className="text-xl">{t("market.coverage")}</h2>
      <p className="text-muted-foreground text-sm">{t("market.coverageHint")}</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const { error } = await supabase
            .from("vendors")
            .update({ pincode: pin.trim() || null, serviceable_pincodes: parsePincodes(list, pin) })
            .eq("id", vendorId);
          setSaving(false);
          if (error) {
            toast.error(t("market.errCoverage"));
            return;
          }
          toast.success(t("market.coverageSaved"));
          onSaved();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="c-shop-pin" className="text-sm">
            {t("market.shopPincode")}
          </Label>
          <Input
            id="c-shop-pin"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="h-12"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-shop-pins" className="text-sm">
            {t("market.servicePins")}
          </Label>
          <Textarea
            id="c-shop-pins"
            value={list}
            maxLength={600}
            onChange={(e) => setList(e.target.value)}
            rows={2}
          />
        </div>
        <Button type="submit" variant="secondary" className="h-12 w-full" disabled={saving}>
          {saving ? t("saving") : t("market.saveCoverage")}
        </Button>
      </form>
    </section>
  );
}

function parsePincodes(raw: string, own: string): string[] {
  const all = [...raw.split(/[^0-9]+/), own]
    .map((p) => p.trim())
    .filter((p) => /^[1-9][0-9]{5}$/.test(p));
  return [...new Set(all)].slice(0, 60);
}

function RegisterShop({ onSaved }: { onSaved: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<VendorKind>("bakery");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [radius, setRadius] = useState("5");
  const [pincode, setPincode] = useState("");
  const [servicePins, setServicePins] = useState("");
  const [allIndia, setAllIndia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
    );
  }, []);

  return (
    <form
      className="space-y-4 pb-8"
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = shopSchema.safeParse({ name, city, address, description });
        if (!parsed.success) {
          toast.error(t(parsed.error.issues[0]?.message ?? "family.errDetails"));
          return;
        }
        setSaving(true);
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          setSaving(false);
          return;
        }
        const { error } = await supabase.from("vendors").insert({
          owner_id: userId,
          name: parsed.data.name,
          kind,
          city: parsed.data.city,
          address: parsed.data.address || null,
          description: parsed.data.description || null,
          service_radius_km: Math.min(50, Math.max(1, Number(radius) || 5)),
          pincode: pincode.trim() || null,
          serviceable_pincodes: parsePincodes(servicePins, pincode),
          ships_all_india: allIndia,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
        });
        if (!error) {
          await supabase.from("user_roles").insert({ user_id: userId, role: "vendor" });
        }
        setSaving(false);
        if (error) {
          toast.error(t("market.errRegisterShop"));
          return;
        }
        toast.success(t("market.shopLive"));
        onSaved();
      }}
    >
      <div className="bg-card shadow-card rounded-3xl p-6 text-center">
        <Store className="text-primary mx-auto size-10" aria-hidden />
        <h2 className="mt-3 text-2xl">{t("market.listShop")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("market.listShopHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="v-name">{t("market.shopName")}</Label>
        <Input id="v-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="h-12" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="v-kind">{t("market.whatSell")}</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as VendorKind)}>
          <SelectTrigger id="v-kind" className="h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VENDOR_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.emoji} {vendorKindLabel(k.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <AddressAutocomplete
        id="v-address"
        label={t("market.shopAddress")}
        value={address}
        onChange={setAddress}
        onResolved={(a) => {
          if (a.city) setCity(a.city);
          if (a.pincode) setPincode(a.pincode);
        }}
        placeholder={t("market.shopAddressPlaceholder")}
        hint={t("market.shopAddressHint")}
      />
      <div className="space-y-2">
        <Label htmlFor="v-city">{t("family.city")}</Label>
        <Input
          id="v-city"
          value={city}
          maxLength={80}
          onChange={(e) => setCity(e.target.value)}
          className="h-12 w-full min-w-0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="v-desc">{t("market.shortDescription")}</Label>
        <Textarea
          id="v-desc"
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="v-pin">{t("market.shopPincode")}</Label>
        <Input
          id="v-pin"
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
          placeholder="400069"
          className="h-12"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="v-pins">{t("market.servicePinsComma")}</Label>
        <Textarea
          id="v-pins"
          value={servicePins}
          maxLength={600}
          onChange={(e) => setServicePins(e.target.value)}
          placeholder="400069, 400059, 400053"
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="v-radius">{t("market.radius")}</Label>
        <Input
          id="v-radius"
          type="number"
          min={1}
          max={50}
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="h-12"
        />
      </div>
      <div className="bg-card shadow-card flex items-center justify-between gap-4 rounded-3xl p-5">
        <div>
          <p className="font-semibold">{t("market.shipIndia")}</p>
          <p className="text-muted-foreground text-sm">{t("market.shipIndiaHint")}</p>
        </div>
        <Switch checked={allIndia} onCheckedChange={setAllIndia} />
      </div>
      <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={saving}>
        {saving ? t("saving") : t("market.registerShop")}
      </Button>
    </form>
  );
}

function AddProduct({ vendorId, onSaved }: { vendorId: string; onSaved: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  return (
    <form
      className="mt-4 flex gap-2 border-t pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const clean = name.trim();
        const amount = Number(price);
        if (!clean || !amount) {
          toast.error(t("market.errNamePrice"));
          return;
        }
        const { error } = await supabase.from("vendor_products").insert({
          vendor_id: vendorId,
          name: clean.slice(0, 120),
          price_paise: Math.round(amount * 100),
        });
        if (error) {
          toast.error(t("market.errAddItem"));
          return;
        }
        setName("");
        setPrice("");
        onSaved();
      }}
    >
      <Input
        aria-label={t("market.itemName")}
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("market.itemPlaceholder")}
        className="h-12 flex-1"
      />
      <Input
        aria-label={t("market.priceAria")}
        value={price}
        inputMode="numeric"
        maxLength={7}
        onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
        placeholder="₹"
        className="h-12 w-24"
      />
      <Button type="submit" variant="secondary" className="h-12">
        <Plus className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
