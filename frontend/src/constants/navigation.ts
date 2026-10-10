import { ROUTES } from './routes';
import { ROUTE_ROLES, ROLE_HOME } from './roleAccess';
import type { Role } from '../types';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  comingSoon?: boolean;
  group?: string | null;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * Flat list of everything that can appear in the app navigation.
 * `group` drives the sidebar section headings.
 */
export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: ROUTES.DASHBOARD, icon: 'home', group: null },
  { label: 'Appointments', path: ROUTES.APPOINTMENTS, icon: 'calendar_today', group: 'Clinic' },
  { label: 'Walk-in', path: ROUTES.WALK_IN, icon: 'directions_walk', group: 'Clinic' },
  { label: 'Patients', path: ROUTES.PATIENTS, icon: 'group', group: 'Clinic' },
  { label: 'Billing', path: ROUTES.BILLING, icon: 'receipt_long', group: 'Finance' },
  { label: 'Reports', path: ROUTES.REPORTS, icon: 'analytics', group: 'Insights' },
  { label: 'Staff', path: ROUTES.STAFF, icon: 'person', group: 'Administration' },
];

/**
 * Kept for backwards compat. New code should use `getGroupedNavForRole`.
 * Filters by ROLE_ROLES, always allows the Home item, and rewrites the
 * Home label/path per role using ROLE_HOME.
 */
export function filterNavItemsByRole(items: NavItem[], role: Role): NavItem[] {
  return items
    .filter((item) => {
      if (item.comingSoon) return true;
      if (item.label === 'Home') return true;
      const allowedRoles = ROUTE_ROLES[item.path];
      return !allowedRoles || allowedRoles.includes(role);
    })
    .map((item) => {
      if (item.label === 'Home') {
        const label = role === 'Admin' || role === 'Branch Manager' ? 'Dashboard' : 'Home';
        return { ...item, label, path: ROLE_HOME[role] };
      }
      return item;
    });
}

/**
 * Returns the sidebar structure for a given role, grouped by section.
 * Empty groups are removed so we never render a header with no items.
 */
export function getGroupedNavForRole(role: Role): NavGroup[] {
  const filtered = filterNavItemsByRole(SIDEBAR_NAV_ITEMS, role);

  const groups: NavGroup[] = [];
  const lookup = new Map<string | null, NavGroup>();

  for (const item of filtered) {
    const key = item.group ?? null;
    let group = lookup.get(key);
    if (!group) {
      group = { label: key, items: [] };
      lookup.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups.filter((g) => g.items.length > 0);
}

/**
 * Flat list of every nav item a role can see. Used by the mobile bottom
 * sheet to build its "More" list.
 */
export function getNavItemsForRole(role: Role): NavItem[] {
  return filterNavItemsByRole(SIDEBAR_NAV_ITEMS, role);
}