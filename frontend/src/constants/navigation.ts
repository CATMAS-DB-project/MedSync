import { ROUTES } from './routes';
import { ROUTE_ROLES, ROLE_HOME } from './roleAccess';
import type { Role } from '../types';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  comingSoon?: boolean;
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: ROUTES.DASHBOARD, icon: 'home' },
  { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: 'dashboard' },
  { label: 'Appointments', path: ROUTES.APPOINTMENTS, icon: 'calendar_today' },
  { label: 'Patients', path: ROUTES.PATIENTS, icon: 'group' },
  { label: 'Staff Directory', path: ROUTES.STAFF, icon: 'person' },
  { label: 'Billing Queue', path: ROUTES.BILLING, icon: 'receipt_long' },
  { label: 'Inventory', path: ROUTES.INVENTORY, icon: 'inventory_2', comingSoon: true },
  { label: 'Reports', path: ROUTES.REPORTS, icon: 'analytics' },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: ROUTES.DASHBOARD, icon: 'home' },
  { label: 'Schedule', path: ROUTES.APPOINTMENTS, icon: 'event' },
  { label: 'Patients', path: ROUTES.PATIENTS, icon: 'group' },
  { label: 'More', path: ROUTES.STAFF, icon: 'menu' },
];

export function filterNavItemsByRole(items: NavItem[], role: Role): NavItem[] {
  return items
    .filter((item) => {
      if (item.comingSoon) return true;
      const allowedRoles = ROUTE_ROLES[item.path];
      return !allowedRoles || allowedRoles.includes(role);
    })
    .map((item) => {
      if (item.label === 'Home') {
        return { ...item, path: ROLE_HOME[role] };
      }
      return item;
    });
}
