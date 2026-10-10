import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME, canAccessRoute } from '../../constants/roleAccess';
import { PageSkeleton } from '../common/PageSkeleton';
import type { Role } from '../../types';

export interface RoleRouteProps {
  children?: ReactNode;
  /**
   * Optional explicit allow-list. If omitted, the guard falls back to the
   * centralized ROUTE_ROLES map via `canAccessRoute`, matching the pattern
   * used by the router (`<Route element={<RoleRoute>…</RoleRoute>} path=…>`).
   */
  allowed?: Role[];
}

export function RoleRoute({ children, allowed }: RoleRouteProps) {
  const { currentUser, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
        <PageSkeleton />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const permitted = allowed
    ? allowed.includes(currentUser.role)
    : canAccessRoute(currentUser.role, location.pathname);

  if (!permitted) {
    return <Navigate to={ROLE_HOME[currentUser.role]} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}