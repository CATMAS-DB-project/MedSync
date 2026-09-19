import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { RoleRoute } from '../components/layout/RoleRoute';
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
import { AppointmentBookingPage } from '../features/appointments/pages/AppointmentBookingPage';

export const router = createBrowserRouter([
  { path: ROUTES.LOGIN, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: ROUTES.DASHBOARD,
            element: (
              <RoleRoute>
                <DashboardPage />
              </RoleRoute>
            ),
          },
          {
            path: ROUTES.APPOINTMENTS,
            element: (
              <RoleRoute>
                <AppointmentsPage />
              </RoleRoute>
            ),
          },
          {
            path: ROUTES.APPOINTMENT_BOOKING,
            element: (
              <RoleRoute>
                <AppointmentBookingPage />
              </RoleRoute>
            ),
          },
          {
            path: ROUTES.PATIENTS,
            element: (
              <RoleRoute>
                <PatientsPage />
              </RoleRoute>
            ),
          },
          {
            path: ROUTES.STAFF,
            element: (
              <RoleRoute>
                <StaffPage />
              </RoleRoute>
            ),
          },
          {
            path: ROUTES.BILLING,
            element: (
              <RoleRoute>
                <BillingPage />
              </RoleRoute>
            ),
          },
          {
            path: ROUTES.CONSULTATION,
            element: (
              <RoleRoute>
                <ConsultationPage />
              </RoleRoute>
            ),
          },
          {
            path: ROUTES.WALK_IN,
            element: (
              <RoleRoute>
                <WalkInPage />
              </RoleRoute>
            ),
          },
          {
            path: ROUTES.REPORTS,
            element: (
              <RoleRoute>
                <ReportsPage />
              </RoleRoute>
            ),
          },
        ],
      },
    ],
  },
]);
