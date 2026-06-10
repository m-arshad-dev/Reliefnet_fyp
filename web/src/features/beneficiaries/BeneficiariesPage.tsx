import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ColumnDef } from '@tanstack/react-table';
import {
  registerBeneficiary,
  checkDuplicate,
  listBeneficiaries,
  verifyBeneficiary,
  AID_TYPES,
  type Beneficiary,
  type DuplicateFlag,
  type AidType,
} from '@/lib/api/beneficiaries';
import { listCampaigns } from '@/lib/api/campaigns';
import { listLocations, buildLocationOptions } from '@/lib/api/locations';
import { useAuth } from '@/lib/auth/AuthContext';
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The cross-NGO duplicate flag (v2 §5.4). It FLAGS, never blocks — the write already
// succeeded; this banner just surfaces masked identity + prior aid so a human decides.
function DuplicateBanner({ flag }: { flag: DuplicateFlag }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 md:col-span-2">
      <p className="text-sm font-semibold text-amber-900">
        ⚠ Possible duplicate — identity {flag.maskedIdentity}
      </p>
      <p className="mt-1 text-sm text-amber-800">
        This CNIC already has aid on record. Registration still succeeded — review the prior
        aid below before delivering more.
      </p>
      <ul className="mt-2 space-y-1 text-sm text-amber-800">
        {flag.priorAid.map((p, i) => (
          <li key={i}>
            • <span className="font-medium">{p.ngo}</span> — {p.aidType},{' '}
            {new Date(p.deliveredAt).toLocaleDateString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Verify is field_coordinator-only and tenant-owned. Each row owns its mutation so a
// verify on one beneficiary doesn't block the rest.
function VerifyButton({ beneficiary }: { beneficiary: Beneficiary }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => verifyBeneficiary(beneficiary.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['beneficiaries'] }),
    onError: (e) => setErr(errorMessage(e)),
  });

  if (beneficiary.verified) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setErr(null);
          mutation.mutate();
        }}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Verifying…' : 'Verify'}
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}

// Slice 5 — a THIN web screen for beneficiary registration + the duplicate-flag banner.
// Registration ultimately lives on the mobile field client (Slice 11); this exists so the
// cross-NGO flag is testable/demoable web-first, calling the same API the app will. Writes
// are tenant-owned (the NGO is forced from the JWT); the flag is a cross-NGO read.
export function BeneficiariesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const isRegistrar =
    !!user && ['field_coordinator', 'volunteer', 'data_entry'].includes(user.role);
  const canVerify = user?.role === 'field_coordinator';

  // Campaign picker needs campaign:read (ngo_admin + field_coordinator hold it). For
  // volunteer/data_entry the list may come back empty — their full flow is the mobile app.
  const campaignsQuery = useQuery({ queryKey: ['campaigns'], queryFn: () => listCampaigns() });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: () => listLocations() });
  const beneficiariesQuery = useQuery({
    queryKey: ['beneficiaries'],
    queryFn: () => listBeneficiaries(),
  });

  const campaigns = campaignsQuery.data?.items ?? [];
  const locationOptions = buildLocationOptions(locationsQuery.data ?? []);

  // Form state (plain useState, mirroring CoordinationPage).
  const [campaignId, setCampaignId] = useState('');
  const [aidType, setAidType] = useState<AidType>('food');
  const [cnic, setCnic] = useState('');
  const [fullName, setFullName] = useState('');
  const [householdSize, setHouseholdSize] = useState('');
  const [contactMasked, setContactMasked] = useState('');
  const [locationId, setLocationId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);
  // The most recent flag (from a pre-check OR a register response). null = not checked yet.
  const [flag, setFlag] = useState<DuplicateFlag | null>(null);

  const registerMutation = useMutation({
    mutationFn: registerBeneficiary,
    onSuccess: (result) => {
      setFormOk(`Registered ${result.beneficiary.fullName}.`);
      setFlag(result.duplicateFlag);
      // Reset identity fields; keep campaign + aid type for batch entry.
      setCnic('');
      setFullName('');
      setHouseholdSize('');
      setContactMasked('');
      setLocationId('');
      qc.invalidateQueries({ queryKey: ['beneficiaries'] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const checkMutation = useMutation({
    mutationFn: () => checkDuplicate(cnic),
    onSuccess: (f) => setFlag(f),
    onError: (err) => setFormError(errorMessage(err)),
  });

  function onRegister(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    if (!campaignId) {
      setFormError('Select a campaign first.');
      return;
    }
    registerMutation.mutate({
      cnic,
      fullName,
      householdSize: householdSize ? Number(householdSize) : undefined,
      contactMasked: contactMasked || undefined,
      locationId: locationId || undefined,
      campaignId,
      aidType,
    });
  }

  const columns: ColumnDef<Beneficiary, unknown>[] = [
    { accessorKey: 'fullName', header: 'Name' },
    {
      accessorKey: 'householdSize',
      header: 'Household',
      cell: ({ getValue }) => (getValue() as number | null) ?? '—',
    },
    {
      accessorKey: 'contactMasked',
      header: 'Contact',
      cell: ({ getValue }) => (getValue() as string | null) ?? '—',
    },
    {
      accessorKey: 'verified',
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge status={(getValue() as boolean) ? 'verified' : 'unverified'} />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Registered',
      cell: ({ getValue }) => new Date(String(getValue())).toLocaleDateString(),
    },
    ...(canVerify
      ? [
          {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => <VerifyButton beneficiary={row.original} />,
          } as ColumnDef<Beneficiary, unknown>,
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 p-8">
        {isRegistrar && (
          <Card>
            <CardHeader>
              <CardTitle>Register a beneficiary</CardTitle>
              <CardDescription>
                The CNIC is hashed server-side (never stored) and checked across all NGOs for
                prior aid. A match flags — it never blocks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onRegister} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {flag?.flagged && <DuplicateBanner flag={flag} />}
                {flag && !flag.flagged && (
                  <p className="text-sm text-emerald-600 md:col-span-2">
                    No prior aid on record for this CNIC.
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cnic">CNIC</Label>
                  <div className="flex gap-2">
                    <Input
                      id="cnic"
                      placeholder="12345-1234567-1"
                      value={cnic}
                      onChange={(e) => {
                        setCnic(e.target.value);
                        setFlag(null); // a new CNIC invalidates the last flag
                      }}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFormError(null);
                        checkMutation.mutate();
                      }}
                      disabled={!cnic || checkMutation.isPending}
                    >
                      {checkMutation.isPending ? 'Checking…' : 'Check'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="campaign">Campaign</Label>
                  <select
                    id="campaign"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className={selectClass}
                    required
                  >
                    <option value="">Select a campaign…</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aidType">Aid type</Label>
                  <select
                    id="aidType"
                    value={aidType}
                    onChange={(e) => setAidType(e.target.value as AidType)}
                    className={selectClass}
                  >
                    {AID_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {capitalize(t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="householdSize">Household size (optional)</Label>
                  <Input
                    id="householdSize"
                    type="number"
                    min={1}
                    value={householdSize}
                    onChange={(e) => setHouseholdSize(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactMasked">Contact, masked (optional)</Label>
                  <Input
                    id="contactMasked"
                    placeholder="03**-***4567"
                    value={contactMasked}
                    onChange={(e) => setContactMasked(e.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="region">Region (optional)</Label>
                  <select
                    id="region"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
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

                <div className="flex items-end md:col-span-2">
                  <Button type="submit" disabled={registerMutation.isPending}>
                    {registerMutation.isPending ? 'Registering…' : 'Register beneficiary'}
                  </Button>
                </div>

                {formError && <p className="text-sm text-destructive md:col-span-2">{formError}</p>}
                {formOk && <p className="text-sm text-emerald-600 md:col-span-2">{formOk}</p>}
              </form>
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Registered beneficiaries</h2>
          {beneficiariesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : beneficiariesQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load beneficiaries.</p>
          ) : (
            <DataTable
              columns={columns}
              data={beneficiariesQuery.data?.items ?? []}
              emptyMessage="No beneficiaries registered yet."
            />
          )}
        </section>
      </main>
    </div>
  );
}
