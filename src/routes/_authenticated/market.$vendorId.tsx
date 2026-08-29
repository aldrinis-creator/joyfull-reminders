import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyMembers, useVendor } from "@/lib/queries";
import { VENDOR_KINDS, rupees, type VendorProduct } from "@/lib/ereminder";

type VendorSearch = { pin?: string; for?: string };

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
  recipient: z.string().trim().min(1, "Who is it for?").max(100),
  address: z.string().trim().min(6, "Add a delivery address").max(400),
  date: z.string().min(1, "Pick a delivery date"),
  message: z.string().trim().max(300).optional(),
});

function VendorPage() {
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
      title={vendor?.name ?? "Shop"}
      subtitle={vendor?.description ?? undefined}
      action={
        <Button asChild variant="secondary" size="lg" className="h-12">
          <Link to="/market">
            <ArrowLeft className="size-5" aria-hidden /> Back
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
          This shop is no longer available.
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
              {VENDOR_KINDS.find((k) => k.value === vendor.kind)?.emoji} Delivers within{" "}
              {vendor.service_radius_km} km
              {vendor.ships_all_india ? " · ships all India" : ""}
            </span>
          </div>

          {recipientPin ? (
            <p className="bg-accent/30 rounded-3xl px-5 py-4 font-semibold">
              {vendor.serviceable_pincodes.includes(recipientPin) || vendor.pincode === recipientPin
                ? `Delivers to ${recipientPin}${recipient ? ` — ${recipient.full_name}'s area` : ""}.`
                : vendor.ships_all_india
                  ? `Ships pan-India, so ${recipientPin} is covered by courier.`
                  : `This shop may not deliver to ${recipientPin}.`}
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
                Order this
              </Button>
            </article>
          ))}

          {(data?.products.length ?? 0) === 0 ? (
            <p className="text-muted-foreground bg-card shadow-card rounded-3xl px-6 py-12 text-center">
              This shop hasn't listed anything yet.
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
  const navigate = useNavigate();
  const { data: members } = useFamilyMembers();
  const [recipient, setRecipient] = useState(recipientName);
  const [address, setAddress] = useState(
    recipientPin ? `\n${recipientCity ? `${recipientCity} ` : ""}${recipientPin}` : "",
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{product.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xl font-bold">{rupees(product.price_paise)}</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="o-recipient">Deliver to</Label>
            <Input
              id="o-recipient"
              list="family-names"
              value={recipient}
              maxLength={100}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Amma"
              className="h-12"
            />
            <datalist id="family-names">
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.full_name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="o-address">
              Delivery address{recipientPin ? ` (pincode ${recipientPin})` : ""}
            </Label>
            <Textarea
              id="o-address"
              value={address}
              maxLength={400}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Flat 302, Sai Residency, Andheri East, Mumbai 400069"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="o-date">Delivery date</Label>
            <Input
              id="o-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="o-message">Gift message</Label>
            <Input
              id="o-message"
              value={message}
              maxLength={300}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Happy birthday Amma, love you!"
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
              const parsed = orderSchema.safeParse({ recipient, address, date, message });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Please check the details");
                return;
              }
              setSaving(true);
              const { data: userData } = await supabase.auth.getUser();
              const userId = userData.user?.id;
              if (!userId) {
                setSaving(false);
                toast.error("Please sign in again");
                return;
              }
              const match = (members ?? []).find(
                (m) => m.full_name.toLowerCase() === parsed.data.recipient.toLowerCase(),
              );
              const { data: order, error } = await supabase
                .from("orders")
                .insert({
                  user_id: userId,
                  vendor_id: vendorId,
                  product_id: product.id,
                  family_member_id: match?.id ?? null,
                  amount_paise: product.price_paise,
                  recipient_name: parsed.data.recipient,
                  delivery_address: parsed.data.address,
                  delivery_date: parsed.data.date,
                  gift_message: parsed.data.message || null,
                })
                .select("id")
                .single();
              setSaving(false);
              if (error || !order) {
                toast.error("Could not create that order.");
                return;
              }
              navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
            }}
          >
            Continue to payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
