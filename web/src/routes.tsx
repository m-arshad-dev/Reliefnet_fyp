import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { RequireRole } from '@/lib/auth/RequireRole';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { NgosPage } from '@/features/ngos/NgosPage';
import { StaffPage } from '@/features/users/StaffPage';
import { DisastersPage } from '@/features/disasters/DisastersPage';
import { CampaignsPage } from '@/features/campaigns/CampaignsPage';
import { CoordinationPage } from '@/features/coordination/CoordinationPage';
import { BeneficiariesPage } from '@/features/beneficiaries/BeneficiariesPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { TasksPage } from '@/features/tasks/TasksPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      {
        // The Coordination Board is the shared, cross-tenant screen — readable by the
        // three roles holding `board:read` (system_admin reads, field_coordinator raises
        // needs, ngo_admin posts offers). It is the first field_coordinator-facing screen.
        element: <RequireRole allow={['system_admin', 'ngo_admin', 'field_coordinator']} />,
        children: [{ path: '/coordination', element: <CoordinationPage /> }],
      },
      {
        // Beneficiaries — registrars (field_coordinator/volunteer/data_entry) register and
        // see the duplicate flag; ngo_admin can view the tenant's registry. The web screen
        // is thin; the full field flow is the mobile client (Slice 11).
        element: (
          <RequireRole allow={['ngo_admin', 'field_coordinator', 'volunteer', 'data_entry']} />
        ),
        children: [{ path: '/beneficiaries', element: <BeneficiariesPage /> }],
      },
      {
        // Tasks — coordinators/admins create, assign and verify; volunteers execute
        // (start / submit). The escalated queue (3+ rejections) shows only to the managers.
        element: <RequireRole allow={['ngo_admin', 'field_coordinator', 'volunteer']} />,
        children: [{ path: '/tasks', element: <TasksPage /> }],
      },
      {
        element: <RequireRole allow={['system_admin']} />,
        children: [
          { path: '/ngos', element: <NgosPage /> },
          { path: '/disasters', element: <DisastersPage /> },
        ],
      },
      {
        element: <RequireRole allow={['ngo_admin']} />,
        children: [
          { path: '/staff', element: <StaffPage /> },
          { path: '/campaigns', element: <CampaignsPage /> },
          // Inventory is ngo_admin-only and private per NGO (no cross-tenant read seam).
          { path: '/inventory', element: <InventoryPage /> },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
