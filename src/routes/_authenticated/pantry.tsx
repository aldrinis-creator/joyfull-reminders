import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useMemo, useEffect } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { usePantryItems, type PantryItem } from '@/lib/queries';
import { toast } from 'sonner';
import { ShoppingCart, Plus, CheckCircle2, Share2, Trash2, Minus, Edit3, History, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const Route = createFileRoute('/_authenticated/pantry')({
  head: () => ({ meta: [{ title: 'Smart Pantry - My-Mitr' }] }),
  component: PantryPage,
});

const UNITS = ['bg', 'kg', 'g', 'L', 'ml', 'packet', 'piece', 'box', 'bottle'];
const COMMON_ITEMS = ['Milk', 'Bread', 'Eggs', 'Aashirvaad Atta', 'Rice', 'Toor Dal', 'Moong Dal', 'Sugar', 'Salt', 'Tea', 'Coffee', 'Cooking Oil', 'Butter', 'Paneer', 'Onions', 'Potatoes'];

function PantryPage() {
  const { data: items, isLoading } = usePantryItems();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number | string>('');
  const [unit, setUnit] = useState('piece');
  const [refillCycleDays, setRefillCycleDays] = useState<number | string>('');

  const [editingId, setEditingId] = useState<string | null>(null);

  const addItem = useMutation({
    mutationFn: async () => {
      if (!name || quantity === '' || refillCycleDays === '') throw new Error('Missing fields');
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) throw new Error('Not logged in');

      const { error } = await supabase.from('pantry_items').insert({
        user_id: userData.user.id,
        name,
        quantity: Number(quantity),
        unit,
        refill_cycle_days: Number(refillCycleDays),
        last_refilled_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item added to Smart Pantry');
      setIsOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['pantry_items'] });
    },
    onError: () => toast.error('Failed to add item'),
  });

  const updateItem = useMutation({
    mutationFn: async () => {
      if (!editingId || !name || quantity === '' || refillCycleDays === '') throw new Error('Missing fields');
      const { error } = await supabase
        .from('pantry_items')
        .update({ name, quantity: Number(quantity), unit, refill_cycle_days: Number(refillCycleDays) })
        .eq('id', editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item updated successfully');
      setIsEditOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['pantry_items'] });
    },
    onError: () => toast.error('Failed to update item'),
  });

  const restockItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pantry_items').update({ last_refilled_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item marked as restocked!');
      void queryClient.invalidateQueries({ queryKey: ['pantry_items'] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pantry_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item removed');
      void queryClient.invalidateQueries({ queryKey: ['pantry_items'] });
    },
  });

  function resetForm() {
    setEditingId(null);
    setName('');
    setQuantity('');
    setUnit('piece');
    setRefillCycleDays('');
  }

  function openEdit(item: PantryItem) {
    setEditingId(item.id);
    setName(item.name);
    setQuantity(item.quantity);
    setUnit(item.unit || 'piece');
    setRefillCycleDays(item.refill_cycle_days);
    setIsEditOpen(true);
  }

  const { runningLow, wellStocked } = useMemo(() => {
    const r: PantryItem[] = [];
    const w: PantryItem[] = [];
    const now = new Date().getTime();

    (items || []).sort((a, b) => a.name.localeCompare(b.name)).forEach((item) => {
      const lastRefilled = new Date(item.last_refilled_at).getTime();
      const cycleMs = item.refill_cycle_days * 24 * 60 * 60 * 1000;
      const daysUntilEmpty = Math.ceil((lastRefilled + cycleMs - now) / (24 * 60 * 60 * 1000));

      if (daysUntilEmpty <= 3) r.push(item);
      else w.push(item);
    });
    return { runningLow: r, wellStocked: w };
  }, [items]);

  type OrderItemSel = { checked: boolean; qty: number; unit: string; name: string };
  const [selectedForOrder, setSelectedForOrder] = useState<Record<string, OrderItemSel>>({});
  const [pastOrder, setPastOrder] = useState<{ date: string, items: { name: string, qty: number, unit: string }[] } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pantry_last_order');
      if (saved) setPastOrder(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    setSelectedForOrder((prev) => {
      const next = { ...prev };
      runningLow.forEach((item) => {
        if (!next[item.id]) {
          next[item.id] = { checked: true, qty: item.quantity, unit: item.unit || 'piece', name: item.name };
        } else {
          next[item.id].name = item.name;
        }
      });
      return next;
    });
  }, [runningLow]);

  const handleShareToGrocer = () => {
    const orderItems = runningLow.filter((i) => selectedForOrder[i.id]?.checked).map(i => selectedForOrder[i.id]);
    if (orderItems.length === 0) {
      toast.info('No items selected for replenishment.');
      return;
    }

    try {
      localStorage.setItem('pantry_last_order', JSON.stringify({
        date: new Date().toISOString(),
        items: orderItems
      }));
      setPastOrder({ date: new Date().toISOString(), items: orderItems as any });
    } catch {}

    const text = 'Hello! Please arrange the following items for delivery:\n\n' + orderItems.map((sel) => {
      const s = sel as OrderItemSel;
      const unitLabel = s.unit === 'piece' || s.unit === 'bg' ? '' : ' ' + s.unit;
      return '- ' + s.name + ' (Qty: ' + s.qty + unitLabel + ')';
    }).join('\n') + '\n\nThank you!';
    
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  const handleResendPastOrder = () => {
    if (!pastOrder || pastOrder.items.length === 0) return;
    const text = 'Hello! Please arrange the following items for delivery:\n\n' + pastOrder.items.map((sel) => {
      const unitLabel = sel.unit === 'piece' || sel.unit === 'bg' ? '' : ' ' + sel.unit;
      return '- ' + sel.name + ' (Qty: ' + sel.qty + unitLabel + ')';
    }).join('\n') + '\n\nThank you!';
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  return (
    <AppShell title="Smart Pantry">
      <datalist id="common-pantry-items">
        {COMMON_ITEMS.map(i => <option key={i} value={i} />)}
      </datalist>

      <div className="px-[22px] py-4 space-y-8">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Track your household essentials</p>
          
          <Dialog open={isOpen} onOpenChange={(open) => {
            if (open) resetForm();
            setIsOpen(open);
          }}>
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
                  <Input list="common-pantry-items" placeholder="e.g. Aashirvaad Atta" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quantity</label>
                    <Input type="number" min="1" placeholder="Empty" value={quantity} onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unit</label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => ( <SelectItem key={u} value={u}><span>{u}</span></SelectItem> ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Refill Cycle (Days)</label>
                  <Input type="number" min="1" placeholder="Empty" value={refillCycleDays} onChange={(e) => setRefillCycleDays(e.target.value ? Number(e.target.value) : '')} />
                </div>
              </div>
              <Button disabled={!name || quantity === '' || refillCycleDays === '' || addItem.isPending} onClick={() => addItem.mutate()} className="w-full h-12 rounded-2xl bg-indigo text-indigo-foreground hover:bg-indigo/90">
                Save Item
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-[425px] rounded-3xl">
              <DialogHeader>
                <DialogTitle>Edit Pantry Item</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Item Name</label>
                  <Input list="common-pantry-items" placeholder="e.g. Aashirvaad Atta" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quantity</label>
                    <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unit</label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => ( <SelectItem key={u} value={u}><span>{u}</span></SelectItem> ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Refill Cycle (Days)</label>
                  <Input type="number" min="1" value={refillCycleDays} onChange={(e) => setRefillCycleDays(e.target.value ? Number(e.target.value) : '')} />
                </div>
              </div>
              <Button disabled={!name || quantity === '' || refillCycleDays === '' || updateItem.isPending} onClick={() => updateItem.mutate()} className="w-full h-12 rounded-2xl bg-indigo text-indigo-foreground hover:bg-indigo/90">
                Update Item
              </Button>
            </DialogContent>
          </Dialog>

        </div>

        {runningLow.length > 0 && (
          <div className="animate-mm-rise space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-rose-600 font-bold flex items-center gap-2">
                <ShoppingCart className="size-5" /> Due for Restocking
              </h2>
              <Button onClick={handleShareToGrocer} size="sm" className="bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-md">
                <Share2 className="size-4 mr-2" /> WhatsApp Grocer
              </Button>
            </div>
            
            <div className="bg-white border border-rose-100 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-rose-50 text-rose-800 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3 w-10"></th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 w-32 text-center">Qty / Edit</th>
                      <th className="px-4 py-3 w-24 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {runningLow.map((item) => {
                      const sel = selectedForOrder[item.id] || { checked: true, qty: item.quantity, unit: item.unit || 'piece', name: item.name };
                      return (
                        <tr key={item.id} className={sel.checked ? 'bg-white' : 'bg-gray-50 opacity-60'}>
                          <td className="px-4 py-3">
                            <Checkbox checked={sel.checked} onCheckedChange={(c) => setSelectedForOrder((p) => {
                              const existing = p[item.id] || { checked: true, qty: item.quantity, unit: item.unit || 'piece', name: item.name };
                              return { ...p, [item.id]: { ...existing, checked: c === true } };
                            })} />
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {item.name}
                            <span className="block text-xs text-muted-foreground font-normal mt-0.5">{sel.unit}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="outline" size="icon" className="size-7 rounded-full h-7 w-7" disabled={!sel.checked || sel.qty <= 1} onClick={() => setSelectedForOrder((p) => {
                                const existing = p[item.id] || { checked: true, qty: item.quantity, unit: item.unit || 'piece', name: item.name };
                                return { ...p, [item.id]: { ...existing, qty: existing.qty - 1 } };
                              })}>
                                <Minus className="size-3" />
                              </Button>
                              <span className="text-sm font-semibold w-5 text-center">{sel.qty}</span>
                              <Button variant="outline" size="icon" className="size-7 rounded-full h-7 w-7" disabled={!sel.checked} onClick={() => setSelectedForOrder((p) => {
                                const existing = p[item.id] || { checked: true, qty: item.quantity, unit: item.unit || 'piece', name: item.name };
                                return { ...p, [item.id]: { ...existing, qty: existing.qty + 1 } };
                              })}>
                                <Plus className="size-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button onClick={() => restockItem.mutate(item.id)} size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl h-8 px-2">
                              <CheckCircle2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {pastOrder && pastOrder.items.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-green-800 font-bold flex items-center gap-2 text-sm">
                <History className="size-4" /> Last Sent List
              </h2>
              <span className="text-xs text-green-600 font-semibold">{new Date(pastOrder.date).toLocaleDateString()}</span>
            </div>
            <p className="text-xs text-green-700 leading-relaxed">
              {pastOrder.items.map(i => `${i.name} (${i.qty})`).join(', ')}
            </p>
            <Button onClick={handleResendPastOrder} size="sm" variant="outline" className="w-full text-green-700 border-green-300 bg-white rounded-xl hover:bg-green-100">
              <RotateCcw className="size-4 mr-2" /> Resend Previous List
            </Button>
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
                    <p className="text-xs text-muted-foreground mt-1">Qty: {item.quantity} {item.unit==='piece'||item.unit==='bg'?'':item.unit} &bull; Refills every {item.refill_cycle_days} days</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="text-indigo-500 opacity-60 hover:opacity-100 hover:bg-indigo-50 rounded-full" onClick={() => openEdit(item)}>
                      <Edit3 className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 opacity-50 hover:opacity-100 hover:bg-red-50 rounded-full" onClick={() => {
                      if (confirm(`Delete ${item.name}?`)) deleteItem.mutate(item.id);
                    }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
