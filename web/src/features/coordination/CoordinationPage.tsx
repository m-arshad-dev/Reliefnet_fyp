import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  createNeed,
  createOffer,
  listNeeds,
  listOffers,
  RESOURCE_TYPES,
  NEED_PRIORITIES,
  OFFER_VISIBILITY,
  type ResourceNeed,
  type ResourceOffer,
  type ResourceType,
  type NeedPriority,
  type OfferVisibility,
} from '@/lib/api/coordination';
import { listDisasters } from '@/lib/api/disasters';
import { listLocations, buildLocationOptions } from '@/lib/api/locations';
import { useAuth } from '@/lib/auth/AuthContext';
import { AppHeader } from '@/components/AppHeader';
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The Coordination Board — the project's first CROSS-TENANT screen. Scoped to one
// disaster, it shows Open Needs and Available Offers raised by ALL NGOs (the server
// reads across tenants on purpose). Writes stay tenant-owned: a field_coordinator's
// "Raise a need" and an ngo_admin's "Post an offer" are created inside their own NGO
// (the server forces ngo_id from the JWT — there is no NGO picker by design).
export function CoordinationPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isCoordinator = user?.role === 'field_coordinator';
  const isNgoAdmin = user?.role === 'ngo_admin';

  // Shared board scope + filters.
  const [disasterId, setDisasterId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const disastersQuery = useQuery({ queryKey: ['disasters'], queryFn: () => listDisasters() });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: () => listLocations() });

  const disasters = disastersQuery.data?.items ?? [];
  const locations = locationsQuery.data ?? [];
  const locationOptions = buildLocationOptions(locations);
  const regionName = (id: string | null) =>
    id ? (locations.find((l) => l.id === id)?.name ?? '—') : '—';

  const boardParams = {
    disasterId,
    type: typeFilter || undefined,
    locationId: locationFilter || undefined,
  };

  const needsQuery = useQuery({
    queryKey: ['needs', disasterId, typeFilter, locationFilter],
    queryFn: () => listNeeds(boardParams),
    enabled: disasterId !== '',
  });
  const offersQuery = useQuery({
    queryKey: ['offers', disasterId, typeFilter, locationFilter],
    queryFn: () => listOffers(boardParams),
    enabled: disasterId !== '',
  });

  // ── Raise-need form (field_coordinator) ──────────────────────────────────────────
  const [needType, setNeedType] = useState<ResourceType>('shelter');
  const [needQuantity, setNeedQuantity] = useState('');
  const [needLocationId, setNeedLocationId] = useState('');
  const [needPriority, setNeedPriority] = useState<NeedPriority>('moderate');
  const [needDescription, setNeedDescription] = useState('');
  const [needError, setNeedError] = useState<string | null>(null);
  const [needOk, setNeedOk] = useState<string | null>(null);

  const needMutation = useMutation({
    mutationFn: createNeed,
    onSuccess: (n) => {
      setNeedOk(`Raised a need for ${n.quantity} ${n.type}.`);
      setNeedQuantity('');
      setNeedLocationId('');
      setNeedDescription('');
      qc.invalidateQueries({ queryKey: ['needs'] });
    },
    onError: (err) => setNeedError(errorMessage(err)),
  });

  function onRaiseNeed(e: FormEvent) {
    e.preventDefault();
    setNeedError(null);
    setNeedOk(null);
    needMutation.mutate({
      disasterId,
      type: needType,
      quantity: Number(needQuantity),
      locationId: needLocationId || undefined,
      priority: needPriority,
      description: needDescription || undefined,
    });
  }

  // ── Post-offer form (ngo_admin) ──────────────────────────────────────────────────
  const [offerType, setOfferType] = useState<ResourceType>('shelter');
  const [offerQuantity, setOfferQuantity] = useState('');
  const [offerLocationId, setOfferLocationId] = useState('');
  const [offerFrom, setOfferFrom] = useState('');
  const [offerUntil, setOfferUntil] = useState('');
  const [offerVisibility, setOfferVisibility] = useState<OfferVisibility>('shared');
  const [offerDescription, setOfferDescription] = useState('');
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerOk, setOfferOk] = useState<string | null>(null);

  const offerMutation = useMutation({
    mutationFn: createOffer,
    onSuccess: (o) => {
      setOfferOk(
        o.visibility === 'shared'
          ? `Posted ${o.quantity} ${o.type} to the shared board.`
          : `Saved a private offer for ${o.quantity} ${o.type} (not shown on the shared board).`,
      );
      setOfferQuantity('');
      setOfferLocationId('');
      setOfferFrom('');
      setOfferUntil('');
      setOfferDescription('');
      qc.invalidateQueries({ queryKey: ['offers'] });
    },
    onError: (err) => setOfferError(errorMessage(err)),
  });

  function onPostOffer(e: FormEvent) {
    e.preventDefault();
    setOfferError(null);
    setOfferOk(null);
    offerMutation.mutate({
      disasterId,
      type: offerType,
      quantity: Number(offerQuantity),
      locationId: offerLocationId || undefined,
      availableFrom: offerFrom || undefined,
      availableUntil: offerUntil || undefined,
      visibility: offerVisibility,
      description: offerDescription || undefined,
    });
  }

  const noDisasterSelected = disasterId === '';

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-8 p-8">
        {/* Scope + filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Coordination Board</CardTitle>
            <CardDescription>
              Pick a disaster to see open needs and available offers from{' '}
              <span className="font-medium">every NGO</span> responding to it. Filter by
              resource type or region.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="disaster">Disaster</Label>
                <select
                  id="disaster"
                  value={disasterId}
                  onChange={(e) => setDisasterId(e.target.value)}
                  className={selectClass}
                >
                  <option value="" disabled>
                    Select a disaster…
                  </option>
                  {disasters.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="typeFilter">Type</Label>
                <select
                  id="typeFilter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="">All types</option>
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {capitalize(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="regionFilter">Region</Label>
                <select
                  id="regionFilter"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="">All regions</option>
                  {locationOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {noDisasterSelected ? (
          <p className="text-sm text-muted-foreground">
            Select a disaster above to view the coordination board.
          </p>
        ) : (
          <>
            {/* Role-gated raise forms (write to YOUR NGO under the selected disaster) */}
            {isCoordinator && (
              <Card>
                <CardHeader>
                  <CardTitle>Raise a need</CardTitle>
                  <CardDescription>
                    Posted for your NGO and visible to every NGO on this disaster's board.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onRaiseNeed} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="needType">Resource type</Label>
                      <select
                        id="needType"
                        value={needType}
                        onChange={(e) => setNeedType(e.target.value as ResourceType)}
                        className={selectClass}
                      >
                        {RESOURCE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {capitalize(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="needQuantity">Quantity</Label>
                      <Input
                        id="needQuantity"
                        type="number"
                        min={1}
                        value={needQuantity}
                        onChange={(e) => setNeedQuantity(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="needPriority">Priority</Label>
                      <select
                        id="needPriority"
                        value={needPriority}
                        onChange={(e) => setNeedPriority(e.target.value as NeedPriority)}
                        className={selectClass}
                      >
                        {NEED_PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {capitalize(p)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="needRegion">Region</Label>
                      <select
                        id="needRegion"
                        value={needLocationId}
                        onChange={(e) => setNeedLocationId(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">— none —</option>
                        {locationOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="needDescription">Details (optional)</Label>
                      <Input
                        id="needDescription"
                        placeholder="e.g. Family tents"
                        value={needDescription}
                        onChange={(e) => setNeedDescription(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end md:col-span-3">
                      <Button type="submit" disabled={needMutation.isPending}>
                        {needMutation.isPending ? 'Raising…' : 'Raise need'}
                      </Button>
                    </div>
                    {needError && <p className="text-sm text-destructive md:col-span-3">{needError}</p>}
                    {needOk && <p className="text-sm text-emerald-600 md:col-span-3">{needOk}</p>}
                  </form>
                </CardContent>
              </Card>
            )}

            {isNgoAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Post an offer</CardTitle>
                  <CardDescription>
                    Shared offers appear on every NGO's board; private offers stay with your
                    NGO.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onPostOffer} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="offerType">Resource type</Label>
                      <select
                        id="offerType"
                        value={offerType}
                        onChange={(e) => setOfferType(e.target.value as ResourceType)}
                        className={selectClass}
                      >
                        {RESOURCE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {capitalize(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offerQuantity">Quantity</Label>
                      <Input
                        id="offerQuantity"
                        type="number"
                        min={1}
                        value={offerQuantity}
                        onChange={(e) => setOfferQuantity(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offerVisibility">Visibility</Label>
                      <select
                        id="offerVisibility"
                        value={offerVisibility}
                        onChange={(e) => setOfferVisibility(e.target.value as OfferVisibility)}
                        className={selectClass}
                      >
                        {OFFER_VISIBILITY.map((v) => (
                          <option key={v} value={v}>
                            {capitalize(v)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offerRegion">Region</Label>
                      <select
                        id="offerRegion"
                        value={offerLocationId}
                        onChange={(e) => setOfferLocationId(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">— none —</option>
                        {locationOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offerFrom">Available from</Label>
                      <Input
                        id="offerFrom"
                        type="date"
                        value={offerFrom}
                        onChange={(e) => setOfferFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="offerUntil">Available until</Label>
                      <Input
                        id="offerUntil"
                        type="date"
                        value={offerUntil}
                        onChange={(e) => setOfferUntil(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="offerDescription">Details (optional)</Label>
                      <Input
                        id="offerDescription"
                        placeholder="e.g. Family tents, ready to dispatch"
                        value={offerDescription}
                        onChange={(e) => setOfferDescription(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end md:col-span-3">
                      <Button type="submit" disabled={offerMutation.isPending}>
                        {offerMutation.isPending ? 'Posting…' : 'Post offer'}
                      </Button>
                    </div>
                    {offerError && <p className="text-sm text-destructive md:col-span-3">{offerError}</p>}
                    {offerOk && <p className="text-sm text-emerald-600 md:col-span-3">{offerOk}</p>}
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Two columns: Open Needs / Available Offers — rows from ALL NGOs */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Open needs</h2>
                {needsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : needsQuery.isError ? (
                  <p className="text-sm text-destructive">Failed to load needs.</p>
                ) : (needsQuery.data?.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open needs on this board.</p>
                ) : (
                  <div className="space-y-3">
                    {needsQuery.data!.items.map((need) => (
                      <NeedCard key={need.id} need={need} regionName={regionName} />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Available offers</h2>
                {offersQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : offersQuery.isError ? (
                  <p className="text-sm text-destructive">Failed to load offers.</p>
                ) : (offersQuery.data?.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shared offers on this board.</p>
                ) : (
                  <div className="space-y-3">
                    {offersQuery.data!.items.map((offer) => (
                      <OfferCard key={offer.id} offer={offer} regionName={regionName} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function NeedCard({
  need,
  regionName,
}: {
  need: ResourceNeed;
  regionName: (id: string | null) => string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">
          {need.quantity} × {capitalize(need.type)}
        </div>
        <div className="flex gap-1.5">
          <StatusBadge status={need.priority} />
          <StatusBadge status={need.status} />
        </div>
      </div>
      {need.description && <p className="mt-1 text-sm text-muted-foreground">{need.description}</p>}
      <div className="mt-2 text-xs text-muted-foreground">
        Region: {regionName(need.locationId)} · Posted by{' '}
        <span className="font-medium text-foreground">{need.ngoName}</span>
      </div>
    </div>
  );
}

function OfferCard({
  offer,
  regionName,
}: {
  offer: ResourceOffer;
  regionName: (id: string | null) => string;
}) {
  const window =
    offer.availableFrom || offer.availableUntil
      ? `${offer.availableFrom ?? '…'} → ${offer.availableUntil ?? '…'}`
      : null;
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">
          {offer.quantity} × {capitalize(offer.type)}
        </div>
        <StatusBadge status={offer.status} />
      </div>
      {offer.description && (
        <p className="mt-1 text-sm text-muted-foreground">{offer.description}</p>
      )}
      <div className="mt-2 text-xs text-muted-foreground">
        Region: {regionName(offer.locationId)}
        {window && <> · Available {window}</>} · Posted by{' '}
        <span className="font-medium text-foreground">{offer.ngoName}</span>
      </div>
    </div>
  );
}
