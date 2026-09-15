import { ROUTES } from './routes';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  comingSoon?: boolean;
}

/** Full navigation, shown in the persistent left sidebar on tablet/desktop. */
export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: 'dashboard' },
  { label: 'Appointments', path: ROUTES.APPOINTMENTS, icon: 'calendar_today' },
  { label: 'Patients', path: ROUTES.PATIENTS, icon: 'group' },
  { label: 'Staff Directory', path: ROUTES.STAFF, icon: 'person' },
  { label: 'Billing Queue', path: ROUTES.BILLING, icon: 'receipt_long' },
  { label: 'Inventory', path: ROUTES.INVENTORY, icon: 'inventory_2', comingSoon: true },
  { label: 'Reports', path: ROUTES.REPORTS, icon: 'analytics' },
];

/** Condensed navigation for the mobile bottom bar (4 primary destinations + More). */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: ROUTES.DASHBOARD, icon: 'home' },
  { label: 'Schedule', path: ROUTES.APPOINTMENTS, icon: 'event' },
  { label: 'Patients', path: ROUTES.PATIENTS, icon: 'group' },
  { label: 'More', path: ROUTES.STAFF, icon: 'menu' },
];
