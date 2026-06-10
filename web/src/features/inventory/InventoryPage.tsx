import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ColumnDef } from '@tanstack/react-table';
import {
  listItems,
  createItem,
  listMovements,
  createMovement,
  ITEM_UNITS,
  MOVEMENT_ACTIONS,
  type InventoryItem,
  type StockMovement,
  type ItemUnit,
} from '@/lib/api/inventory';
import { AppHeader } from '@/components/AppHeader';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function errorMessage(err: unknown): string {
  return err instanceof AxiosError
    ? (err.response?.data?.error?.message ?? 'Something went wrong')
    : 'Something went wrong';
}

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// Add-item form — name + unit. A fresh item starts with every balance at 0.
function AddItemForm() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<ItemUnit>('pack');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createItem,
    onSuccess: (item) => {
      setOk(`Added "${item.name}".`);
      setName('');
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    mutation.mutate({ name, unit });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add an inventory item</CardTitle>
        <CardDescription>
          A catalogue entry. Stock arrives later via a "Receive" movement — quantity on hand is
          always derived from the movement history, never stored.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="itemName">Name</Label>
            <Input
              id="itemName"
              placeholder="Food ration pack"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="itemUnit">Unit</Label>
            <select
              id="itemUnit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as ItemUnit)}
              className={selectClass}
            >
              {ITEM_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end md:col-span-3">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding…' : 'Add item'}
            </Button>
          </div>
          {err && <p className="text-sm text-destructive md:col-span-3">{err}</p>}
          {ok && <p className="text-sm text-emerald-600 md:col-span-3">{ok}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

// Movement form — pick an item + quantity + a legal forward action. Each action encodes a
// (prevState -> toState) pair from the FSM, so the UI only offers legal moves; the server
// re-validates and rejects anything illegal or over-drawn.
function MovementForm({ items }: { items: InventoryItem[] }) {
  const qc = useQueryClient();
  const [itemId, setItemId] = useState('');
  const [actionIdx, setActionIdx] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createMovement,
    onSuccess: () => {
      const action = MOVEMENT_ACTIONS[actionIdx];
      setOk(`Recorded "${action.label}" of ${quantity}.`);
      setQuantity('');
      // Refresh derived on-hand + any open movement history.
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'movements'] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!itemId) {
      setErr('Select an item first.');
      return;
    }
    const action = MOVEMENT_ACTIONS[actionIdx];
    mutation.mutate({
      itemId,
      quantity: Number(quantity),
      toState: action.toState,
      prevState: action.prevState ?? undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record a movement</CardTitle>
        <CardDescription>
          Stock flows stock in → allocated → dispatched → delivered → consumed. Each step is an
          immutable, append-only entry.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="moveItem">Item</Label>
            <select
              id="moveItem"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className={selectClass}
              required
            >
              <option value="">Select an item…</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="moveAction">Action</Label>
            <select
              id="moveAction"
              value={actionIdx}
              onChange={(e) => setActionIdx(Number(e.target.value))}
              className={selectClass}
            >
              {MOVEMENT_ACTIONS.map((a, i) => (
                <option key={a.label} value={i}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="moveQty">Quantity</Label>
            <Input
              id="moveQty"
              type="number"
              min={0}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end md:col-span-3">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Recording…' : 'Record movement'}
            </Button>
          </div>
          {err && <p className="text-sm text-destructive md:col-span-3">{err}</p>}
          {ok && <p className="text-sm text-emerald-600 md:col-span-3">{ok}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

// Correction form — ngo_admin-only (the whole page is). A signed adjustment to the available
// pool with a MANDATORY note. The server enforces the role (403) and the note (422); the
// client blocks an empty note as a courtesy.
function CorrectionForm({ items }: { items: InventoryItem[] }) {
  const qc = useQueryClient();
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createMovement,
    onSuccess: () => {
      setOk('Correction recorded.');
      setQuantity('');
      setNote('');
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'movements'] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!itemId) {
      setErr('Select an item first.');
      return;
    }
    if (!note.trim()) {
      setErr('A correction note is required.');
      return;
    }
    mutation.mutate({
      itemId,
      quantity: Number(quantity),
      toState: 'correction',
      correctionNote: note.trim(),
    });
  }

  return (
    <Card className="border-purple-200">
      <CardHeader>
        <CardTitle>Issue a correction</CardTitle>
        <CardDescription>
          NGO-admin only. A signed adjustment (negative to write off, positive to add back) with a
          mandatory audit note. Written as a new row — it never edits history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="corrItem">Item</Label>
            <select
              id="corrItem"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className={selectClass}
              required
            >
              <option value="">Select an item…</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="corrQty">Signed quantity</Label>
            <Input
              id="corrQty"
              type="number"
              step="any"
              placeholder="-5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="corrNote">Note (required)</Label>
            <Input
              id="corrNote"
              placeholder="5 packs water-damaged in transit"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end md:col-span-3">
            <Button type="submit" variant="outline" disabled={mutation.isPending}>
              {mutation.isPending ? 'Recording…' : 'Record correction'}
            </Button>
          </div>
          {err && <p className="text-sm text-destructive md:col-span-3">{err}</p>}
          {ok && <p className="text-sm text-emerald-600 md:col-span-3">{ok}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

// Movement history for one item (GET /inventory/movements?itemId=).
function MovementHistory({ item }: { item: InventoryItem }) {
  const query = useQuery({
    queryKey: ['inventory', 'movements', item.id],
    queryFn: () => listMovements(item.id),
  });

  const columns: ColumnDef<StockMovement, unknown>[] = [
    {
      accessorKey: 'createdAt',
      header: 'When',
      cell: ({ getValue }) => new Date(String(getValue())).toLocaleString(),
    },
    {
      id: 'flow',
      header: 'Flow',
      cell: ({ row }) => {
        const m = row.original;
        return (
          <span className="flex items-center gap-1 text-xs">
            {m.prevState && (
              <>
                <span className="text-muted-foreground">{m.prevState.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">→</span>
              </>
            )}
            <StatusBadge status={m.state} />
          </span>
        );
      },
    },
    { accessorKey: 'quantity', header: 'Qty' },
    {
      accessorKey: 'correctionNote',
      header: 'Note',
      cell: ({ getValue }) => (getValue() as string | null) ?? '—',
    },
  ];

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">
        History — {item.name}{' '}
        <span className="text-sm font-normal text-muted-foreground">
          (on hand {item.quantityOnHand} {item.unit})
        </span>
      </h3>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive">Failed to load movements.</p>
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          emptyMessage="No movements yet — record a 'Receive' to add stock."
        />
      )}
    </section>
  );
}

// Slice 6 — a THIN ngo_admin inventory screen. Items list shows DERIVED quantity-on-hand;
// a movement form drives the FSM; an ngo_admin-only correction form (required note) files
// signed adjustments. Movement-authoritative: nothing here stores a quantity counter.
export function InventoryPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const itemsQuery = useQuery({ queryKey: ['inventory', 'items'], queryFn: () => listItems() });
  const items = itemsQuery.data?.items ?? [];
  const selected = items.find((it) => it.id === selectedId) ?? null;

  const columns: ColumnDef<InventoryItem, unknown>[] = [
    { accessorKey: 'name', header: 'Item' },
    { accessorKey: 'unit', header: 'Unit' },
    {
      accessorKey: 'quantityOnHand',
      header: 'On hand',
      cell: ({ getValue }) => <span className="font-semibold">{getValue() as number}</span>,
    },
    { accessorFn: (r) => r.byState.allocated, id: 'allocated', header: 'Allocated' },
    { accessorFn: (r) => r.byState.dispatched, id: 'dispatched', header: 'Dispatched' },
    { accessorFn: (r) => r.byState.delivered, id: 'delivered', header: 'Delivered' },
    { accessorFn: (r) => r.byState.consumed, id: 'consumed', header: 'Consumed' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setSelectedId((cur) => (cur === row.original.id ? null : row.original.id))
          }
        >
          {selectedId === row.original.id ? 'Hide' : 'History'}
        </Button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-8">
        <AddItemForm />
        <MovementForm items={items} />
        <CorrectionForm items={items} />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Inventory</h2>
          {itemsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : itemsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load inventory.</p>
          ) : (
            <DataTable
              columns={columns}
              data={items}
              emptyMessage="No items yet — add one above."
            />
          )}
        </section>

        {selected && <MovementHistory item={selected} />}
      </main>
    </div>
  );
}
