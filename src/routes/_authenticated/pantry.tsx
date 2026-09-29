import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { usePantryItems, type PantryItem } from "@/lib/queries";
import { toast } from "sonner";
import { ShoppingCart, Plus, CheckCircle2, Share2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/pantry")({
  head: () => ({
    meta: [{ title: "Smart Pantry - My-Mitr" }],
  }),
  component: PantryPage,
});

function PantryPage() {
  const { data: items, isLoading } = usePantryItems();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [refillCycleDays, setRefillCycleDays] = useState(30);

  const addItem = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) throw new Error("Not logged in");

      const { error } = await supabase.from("pantry_items").insert({
        user_id: userData.user.id,
        name,
        quantity,
        refill_cycle_days: refillCycleDays,
        last_refilled_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item added to Smart Pantry");
      setIsOpen(false);
      setName("");
      setQuantity(1);
      setRefillCycleDays(30);
      void queryClient.invalidateQueries({ queryKey: ["pantry_items"] });
    },
    onError: () => toast.error("Failed to add item"),
  });

  const restockItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pantry_items")
        .update({ last_refilled_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item marked as restocked!");
      void queryClient.invalidateQueries({ queryKey: ["pantry_items"] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pantry_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removed");
      void queryClient.invalidateQueries({ queryKey: ["pantry_items"] });
    },
  });

  const { runningLow, wellStocked } = useMemo(() => {
    const runningLow: PantryItem[] = [];
    const wellStocked: PantryItem[] = [];
    const now = new Date().getTime();

    (items || []).forEach((item) => {
      const lastRefilled = new Date(item.last_refilled_at).getTime();
      const cycleMs = item.refill_cycle_days * 24 * 60 * 60 * 1000;
      const daysUntilEmpty = Math.ceil((lastRefilled + cycleMs - now) / (24 * 60 * 60 * 1000));

      if (daysUntilEmpty <= 3) {
        runningLow.push(item);
      } else {
        wellStocked.push(item);
      }
    });

    return { runningLow, wellStocked };
  }, [items]);

  const handleShareToGrocer = () => {
    if (runningLow.length === 0) {
      toast.info("No items running low right now.");
      return;
    }
    const text = "Hello! Please arrange the following items for delivery:\n\n" + runningLow.map((i) => "- " + i.name + " (Qty: " + i.quantity + ")").join("\n") + "\n\nThank you!";
    const url = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(url, "_blank");
  };

  return (
    <AppShell title="Smart Pantry">
      <div className="px-[22px] py-4 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Track your household essentials</p>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full shadow-sm bg-indigo text-indigo-foreground hover:bg-indigo/90">
                <Plus className="size-4 mr-1" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-3xl">
              <DialogHeader>
                <DialogTitle>Add to Smart Pantry</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Item Name</label>
                  <Input placeholder="e.g. Aashirvaad Atta (10kg)" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantity per order</label>
                  <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Refill Cycle (Days)</label>
                  <Input type="number" min="1" value={refillCycleDays} onChange={(e) => setRefillCycleDays(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">Mitr will remind you to buy this every {refillCycleDays} days.</p>
                </div>
              </div>
              <Button disabled={!name || addItem.isPending} onClick={() => addItem.mutate()} className="w-full h-12 rounded-2xl bg-indigo text-indigo-foreground hover:bg-indigo/90">
                Save Item
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {runningLow.length > 0 && (
          <div className="animate-mm-rise space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-rose-600 font-bold flex items-center gap-2">
                <ShoppingCart className="size-5" /> Running Low
              </h2>
              <Button onClick={handleShareToGrocer} size="sm" variant="outline" className="text-green-600 border-green-200 bg-green-50 rounded-xl hover:bg-green-100">
                <Share2 className="size-4 mr-2" /> WhatsApp Grocer
              </Button>
            </div>
            <div className="space-y-3">
              {runningLow.map((item) => (
                <div key={item.id} className="bg-rose-50 border border-rose-100 p-4 rounded-3xl flex justify-between items-center shadow-sm">
                  <div>
                    <h3 className="font-semibold text-rose-900">{item.name}</h3>
                    <p className="text-xs text-rose-600 mt-1">Qty: {item.quantity} • Due for refill</p>
                  </div>
                  <Button onClick={() => restockItem.mutate(item.id)} size="sm" className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-10">
                    <CheckCircle2 className="size-4 mr-1.5" /> Restocked
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-muted-foreground font-bold text-sm tracking-widest uppercase">Well Stocked</h2>
          
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-3xl" />
              <Skeleton className="h-20 rounded-3xl" />
            </div>
          ) : wellStocked.length === 0 && runningLow.length === 0 ? (
            <div className="bg-card shadow-card rounded-3xl px-6 py-12 text-center border">
              <ShoppingCart className="text-muted-foreground/30 mx-auto size-12" />
              <h3 className="mt-4 font-semibold">Your pantry is empty</h3>
              <p className="text-sm text-muted-foreground mt-2">Add household items you buy regularly, and Mitr will track when you run out.</p>
            </div>
          ) : wellStocked.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No other items tracked.</p>
          ) : (
            <div className="space-y-3">
              {wellStocked.map((item) => (
                <div key={item.id} className="bg-card border shadow-sm p-4 rounded-3xl flex justify-between items-center group">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">Refills every {item.refill_cycle_days} days</p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-500 opacity-50 hover:opacity-100 hover:bg-red-50" onClick={() => {
                    if (confirm(Delete  + item.name + ?)) deleteItem.mutate(item.id);
                  }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
