import { matchPath } from 'react-router-dom';
import { ROUTES } from './routes';
import type { Role } from '../types';

export const ROUTE_ROLES: Record<string, Role[]> = {
  [ROUTES.DASHBOARD]: ['Admin', 'Branch Manager', 'QA Tester'],
  [ROUTES.APPOINTMENTS]: ['Admin', 'Branch Manager', 'Receptionist', 'Doctor'],
  [ROUTES.APPOINTMENT_BOOKING]: ['Admin', 'Branch Manager', 'Receptionist'],
  [ROUTES.PATIENTS]: ['Admin', 'Branch Manager', 'Receptionist', 'Doctor', 'Cashier'],
  [ROUTES.STAFF]: ['Admin', 'Branch Manager'],
  [ROUTES.BILLING]: ['Admin', 'Branch Manager', 'Receptionist', 'Cashier'],
  [ROUTES.CONSULTATION]: ['Admin', 'Doctor'],
  [ROUTES.WALK_IN]: ['Admin', 'Branch Manager', 'Receptionist'],
  [ROUTES.REPORTS]: ['Admin', 'Branch Manager'],
};

export const ROLE_HOME: Record<Role, string> = {
  Admin: ROUTES.DASHBOARD,
  'Branch Manager': ROUTES.DASHBOARD,
  Receptionist: ROUTES.APPOINTMENTS,
  Doctor: ROUTES.APPOINTMENTS,
  Cashier: ROUTES.BILLING,
  'QA Tester': ROUTES.DASHBOARD,
};

export function canAccessRoute(role: Role, pathname: string): boolean {
  const matchedRoutePattern = Object.keys(ROUTE_ROLES).find((pattern) =>
    matchPath(pattern, pathname),
  );
  if (!matchedRoutePattern) return true;
  return ROUTE_ROLES[matchedRoutePattern].includes(role);
}
