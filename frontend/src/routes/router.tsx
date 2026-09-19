import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { ROUTES } from '../constants/routes';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { PatientsPage } from '../features/patients/pages/PatientsPage';
import { AppointmentsPage } from '../features/appointments/pages/AppointmentsPage';
import { StaffPage } from '../features/staff/pages/StaffPage';
import { BillingPage } from '../features/billing/pages/BillingPage';
import { ConsultationPage } from '../features/consultation/pages/ConsultationPage';
import { WalkInPage } from '../features/walkin/pages/WalkInPage';
import { ReportsPage } from '../features/reports/pages/ReportsPage';
import { AppointmentBookingPage } from '../features/appointments/pages/AppointmentsBookingPage';

export const router = createBrowserRouter([
  { path: ROUTES.LOGIN, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
          { path: ROUTES.APPOINTMENTS, element: <AppointmentsPage /> },
          { path: ROUTES.APPOINTMENT_BOOKING, element: <AppointmentBookingPage /> },
          { path: ROUTES.PATIENTS, element: <PatientsPage /> },
          { path: ROUTES.STAFF, element: <StaffPage /> },
          { path: ROUTES.BILLING, element: <BillingPage /> },
          { path: ROUTES.CONSULTATION, element: <ConsultationPage /> },
          { path: ROUTES.WALK_IN, element: <WalkInPage /> },
          { path: ROUTES.REPORTS, element: <ReportsPage /> },
        ],
      },
    ],
  },
]);
