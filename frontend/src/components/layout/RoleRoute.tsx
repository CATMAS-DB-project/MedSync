import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessRoute, ROLE_HOME } from '../../constants/roleAccess';

export interface RoleRouteProps {
  children: ReactNode;
}

export function RoleRoute({ children }: RoleRouteProps) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) return null;

  if (!canAccessRoute(currentUser.role, location.pathname)) {
    return <Navigate to={ROLE_HOME[currentUser.role]} replace />;
  }

  return <>{children}</>;
}
