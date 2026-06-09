import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { RequireRole } from '@/lib/auth/RequireRole';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { NgosPage } from '@/features/ngos/NgosPage';
import { StaffPage } from '@/features/users/StaffPage';
import { DisastersPage } from '@/features/disasters/DisastersPage';
import { CampaignsPage } from '@/features/campaigns/CampaignsPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
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
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
