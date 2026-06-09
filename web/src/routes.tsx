import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [{ path: '/dashboard', element: <DashboardPage /> }],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
