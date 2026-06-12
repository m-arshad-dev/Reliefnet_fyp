// The single source of truth for RBAC: role -> set of permission strings,
// transcribed from the v2 §3.2 permission matrix. The authorize() middleware
// checks against this map so authorization lives in ONE place, never as
// scattered `if (role === ...)` branches across controllers.
//
// The full matrix is seeded here forward-looking; only `ngo:manage` (system_admin)
// and `user:manage` (ngo_admin) are wired to routes in Slice 1. The rest light up
// as their slices land (disasters, inventory, tasks, beneficiaries, audit).
export const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  system_admin: new Set([
    'ngo:manage',
    'disaster:create',
    'audit:read',
    'board:read',
    'match:read',
    'reports:read',
  ]),
  ngo_admin: new Set([
    'user:manage',
    'inventory:manage',
    'inventory:correct',
    'campaign:create',
    'campaign:read',
    'beneficiary:read',
    'beneficiary:override_flag',
    'task:create',
    'task:escalate',
    'task:read',
    'offer:create',
    'board:read',
    'match:propose',
    'match:confirm',
    'match:read',
    'reports:read',
    'sync:resolve',
  ]),
  field_coordinator: new Set([
    'campaign:read',
    'task:create',
    'task:escalate',
    'task:read',
    'beneficiary:register',
    'beneficiary:verify',
    'beneficiary:read',
    'need:create',
    'board:read',
    'match:propose',
    'match:confirm',
    'match:read',
    'reports:read',
    'sync:push',
    'sync:pull',
    'sync:resolve',
  ]),
  volunteer: new Set([
    'task:execute',
    'task:read',
    'beneficiary:register',
    'beneficiary:read',
    'sync:push',
    'sync:pull',
  ]),
  data_entry: new Set(['beneficiary:register', 'beneficiary:read', 'sync:push', 'sync:pull']),
  auditor: new Set(['audit:read', 'compliance:read']),
};

export function hasPermission(role: string, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
