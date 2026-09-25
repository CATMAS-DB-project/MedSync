import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { login as apiLogin, logout as apiLogout, fetchCurrentUser } from '../services/api/auth';
import { refreshAccessToken, setSessionExpiredHandler } from '../services/api/client';
import { ApiError } from '../services/api/ApiError';
import { DEV_BYPASS_AUTH } from '../constants/api';
import { mockCurrentUser } from '../services/mock/currentUser';
import type { CurrentUser, LoginCredentials } from '../types';

interface AuthContextValue {
  currentUser: CurrentUser | null;
  /** True only during the initial silent-refresh-on-load check. */
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const logout = useCallback(async () => {
    if (DEV_BYPASS_AUTH) {
      setCurrentUser(null);
      return;
    }
    try {
      await apiLogout();
    } finally {
      setCurrentUser(null);
    }
  }, []);

  // On first load (including a hard refresh), try to silently resume a
  // session using the httpOnly refresh cookie. No token is ever read from
  // localStorage - if there's no valid cookie, this just fails quietly and
  // the app falls through to the login screen.
  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      // No backend yet - log straight in as the mock user, skip the
      // network entirely. See constants/api.ts for how to turn this off.
      setCurrentUser(mockCurrentUser);
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        await refreshAccessToken();
        const user = await fetchCurrentUser();
        if (!cancelled) setCurrentUser(user);
      } catch {
        if (!cancelled) setCurrentUser(null);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Registered with the API client so a refresh failure mid-session (not
  // just on load) also clears the logged-in state here.
  useEffect(() => {
    setSessionExpiredHandler(() => setCurrentUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    if (DEV_BYPASS_AUTH) {
      setCurrentUser(mockCurrentUser);
      return;
    }
    await apiLogin(credentials);
    const user = await fetchCurrentUser();
    setCurrentUser(user);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isBootstrapping,
        isAuthenticated: currentUser !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { ApiError };
