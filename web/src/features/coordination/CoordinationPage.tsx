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
import {
  listCandidates,
  createMatch,
  listMatches,
  setMatchStatus,
  type Match,
  type MatchTransitionTarget,
} from '@/lib/api/matches';
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
// "Raise a need" and an ngo_admin's "Post an offer" are created inside their own NGO.
//
// Slice 4 adds the MATCHING LOOP: on an open need you own, "Find candidate offers"
// surfaces shared offers from OTHER NGOs (suggest-only); confirming one proposes a match
// that moves the need + offer in lockstep. The "Active matches" section drives that match
// through accepted → fulfilled (or reject), with both NGOs seeing the linked status.
export function CoordinationPage() {
  const { user } = useAuth();
  const isCoordinator = user?.role === 'field_coordinator';
  const isNgoAdmin = user?.role === 'ngo_admin';
  const canMatch = isCoordinator || isNgoAdmin; // the two roles that drive matches
  const userNgoId = user?.ngoId ?? null;

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
  // Matches the caller's NGO participates in (either side), scoped to this disaster.
  const matchesQuery = useQuery({
    queryKey: ['matches', disasterId],
    queryFn: () => listMatches({ disasterId }),
    enabled: disasterId !== '' && canMatch,
  });
  const matches = matchesQuery.data?.items ?? [];

  // ── Raise-need form (field_coordinator) ──────────────────────────────────────────
  const qc = useQueryClient();
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

            {/* Active matches — the lifecycle once a need + offer are linked. Both NGOs see
                a match they're part of; only the needing NGO sees the action buttons. */}
            {canMatch && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Active matches</h2>
                {matchesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : matchesQuery.isError ? (
                  <p className="text-sm text-destructive">Failed to load matches.</p>
                ) : matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No matches yet. Find candidate offers on one of your open needs below to
                    propose one.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {matches.map((m) => (
                      <MatchCard key={m.id} match={m} userNgoId={userNgoId} regionName={regionName} />
                    ))}
                  </div>
                )}
              </section>
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
                      <NeedCard
                        key={need.id}
                        need={need}
                        regionName={regionName}
                        canMatch={canMatch}
                        userNgoId={userNgoId}
                      />
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

// Open-need card. For a need YOUR NGO owns (and you can match), it expands a cross-NGO
// "candidate offers" panel and lets you propose a match (the human confirm). Proposing
// moves the need off this Open column and into Active matches (status flips in lockstep).
function NeedCard({
  need,
  regionName,
  canMatch,
  userNgoId,
}: {
  need: ResourceNeed;
  regionName: (id: string | null) => string;
  canMatch: boolean;
  userNgoId: string | null;
}) {
  const qc = useQueryClient();
  const owner = need.ngoId === userNgoId;
  const canPropose = canMatch && owner && need.status === 'open';

  const [showCandidates, setShowCandidates] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const candidatesQuery = useQuery({
    queryKey: ['candidates', need.id],
    queryFn: () => listCandidates(need.id),
    enabled: showCandidates,
  });
  const candidates = candidatesQuery.data?.items ?? [];

  const proposeMutation = useMutation({
    mutationFn: (offerId: string) => createMatch({ needId: need.id, offerId }),
    onSuccess: () => {
      setShowCandidates(false);
      // Move both sides + surface the new match — all three queries refetch in lockstep.
      qc.invalidateQueries({ queryKey: ['needs'] });
      qc.invalidateQueries({ queryKey: ['offers'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
    onError: (err) => setMatchError(errorMessage(err)),
  });

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

      {canPropose && (
        <div className="mt-3 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMatchError(null);
              setShowCandidates((v) => !v);
            }}
          >
            {showCandidates ? 'Hide candidate offers' : 'Find candidate offers'}
          </Button>

          {showCandidates && (
            <div className="mt-3 space-y-2">
              {candidatesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Searching other NGOs…</p>
              ) : candidatesQuery.isError ? (
                <p className="text-sm text-destructive">Failed to load candidates.</p>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No matching offers from other NGOs yet.
                </p>
              ) : (
                candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-2"
                  >
                    <div className="text-sm">
                      <div className="font-medium">
                        {c.quantity} × {capitalize(c.type)} ·{' '}
                        <span className="font-normal text-muted-foreground">{c.ngoName}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                        <span>Region: {regionName(c.locationId)}</span>
                        {c.sameRegion && (
                          <span className="rounded bg-emerald-100 px-1.5 text-emerald-800">
                            ✓ same region
                          </span>
                        )}
                        {c.coversQuantity && (
                          <span className="rounded bg-emerald-100 px-1.5 text-emerald-800">
                            ✓ covers quantity
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={proposeMutation.isPending}
                      onClick={() => {
                        setMatchError(null);
                        proposeMutation.mutate(c.id);
                      }}
                    >
                      {proposeMutation.isPending ? 'Proposing…' : 'Propose match'}
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
          {matchError && <p className="mt-2 text-sm text-destructive">{matchError}</p>}
        </div>
      )}
    </div>
  );
}

// A confirmed match: NGO A's need ↔ NGO B's offer, with both sides' live statuses. Only
// the NEEDING NGO drives the lifecycle (accept → fulfilled, or reject) — the offering NGO
// sees the same card read-only. Every action moves the match + need + offer in lockstep.
function MatchCard({
  match,
  userNgoId,
  regionName,
}: {
  match: Match;
  userNgoId: string | null;
  regionName: (id: string | null) => string;
}) {
  const qc = useQueryClient();
  const canManage = match.need.ngoId === userNgoId; // the needing NGO drives
  const [actionError, setActionError] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: (status: MatchTransitionTarget) => setMatchStatus(match.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['needs'] });
      qc.invalidateQueries({ queryKey: ['offers'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const isTerminal = match.status === 'fulfilled' || match.status === 'rejected';

  function act(status: MatchTransitionTarget) {
    setActionError(null);
    statusMutation.mutate(status);
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">
          {match.quantity} × {capitalize(match.need.type)}
        </div>
        <StatusBadge status={match.status} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-muted/40 p-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Need</div>
          <div className="font-medium text-foreground">{match.need.ngoName}</div>
          <div className="text-muted-foreground">Region: {regionName(match.need.locationId)}</div>
          <div className="mt-1">
            <StatusBadge status={match.need.status} />
          </div>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Offer</div>
          <div className="font-medium text-foreground">{match.offer.ngoName}</div>
          <div className="text-muted-foreground">Region: {regionName(match.offer.locationId)}</div>
          <div className="mt-1">
            <StatusBadge status={match.offer.status} />
          </div>
        </div>
      </div>

      {canManage && !isTerminal && (
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          {match.status === 'proposed' && (
            <Button size="sm" disabled={statusMutation.isPending} onClick={() => act('accepted')}>
              Accept
            </Button>
          )}
          {match.status === 'accepted' && (
            <Button size="sm" disabled={statusMutation.isPending} onClick={() => act('fulfilled')}>
              Mark fulfilled
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={statusMutation.isPending}
            onClick={() => act('rejected')}
          >
            Reject
          </Button>
        </div>
      )}
      {!canManage && (
        <p className="mt-2 text-xs text-muted-foreground">
          Driven by {match.need.ngoName} (the needing NGO).
        </p>
      )}
      {actionError && <p className="mt-2 text-sm text-destructive">{actionError}</p>}
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
