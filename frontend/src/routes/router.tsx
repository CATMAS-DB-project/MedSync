import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ROUTES } from '../constants/routes';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { PatientsPage } from '../features/patients/pages/PatientsPage';
import { AppointmentsPage } from '../features/appointments/pages/AppointmentsPage';
import { StaffPage } from '../features/staff/pages/StaffPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
      { path: ROUTES.APPOINTMENTS, element: <AppointmentsPage /> },
      { path: ROUTES.PATIENTS, element: <PatientsPage /> },
      { path: ROUTES.STAFF, element: <StaffPage /> },
      // Remaining routes (billing, consultation, walk-in, reports) will be
      // added here as each feature page is built.
    ],
  },
]);
