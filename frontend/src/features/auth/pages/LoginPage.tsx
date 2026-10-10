import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { ApiError } from '../../../services/api/ApiError';
import { ROUTES } from '../../../constants/routes';
import { ROLE_HOME } from '../../../constants/roleAccess';

export function LoginPage() {
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginSucceeded, setLoginSucceeded] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? ROUTES.DASHBOARD;

  useEffect(() => {
    if (!loginSucceeded || !currentUser) return;
    navigate(ROLE_HOME[currentUser.role] ?? redirectTo, { replace: true });
  }, [currentUser, loginSucceeded, navigate, redirectTo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setLoginSucceeded(false);

    try {
      await login({ username, password });
      setLoginSucceeded(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === 'SESSION_EXPIRED'
            ? 'Session expired. Please log in again.'
            : err.message,
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-fixed/40 via-background to-secondary-fixed/30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-secondary/10 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-[28rem] overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-elevated">
        <div className="h-1.5 bg-gradient-to-r from-primary via-primary-container to-secondary" />
        <div className="p-7 sm:p-10">
        <div className="mb-7 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg">
            <Icon name="clinical_notes" size={30} />
          </div>
        </div>

        <div className="mb-8 text-center">
          <p className="mb-2 text-label-md font-semibold uppercase tracking-[0.16em] text-primary">Welcome back</p>
          <h1 className="text-2xl font-semibold tracking-tight text-on-surface">
            MedSync
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Clinical &amp; Administrative Management
          </p>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label htmlFor="login-username" className="text-label-md font-medium text-on-surface-variant">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              aria-label="Username"
              placeholder="Enter your username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              className="h-11 w-full rounded-lg border border-outline-variant bg-background px-4 text-body-md text-on-surface placeholder:text-outline transition-colors focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="login-password" className="text-label-md font-medium text-on-surface-variant">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                aria-label="Password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="h-11 w-full rounded-lg border border-outline-variant bg-background py-2.5 pl-4 pr-12 text-body-md text-on-surface placeholder:text-outline transition-colors focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={18} />
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-error/30 bg-error-container/50 px-4 py-3 text-body-sm text-on-error-container"
            >
              <Icon name="error" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="mt-1 h-11 w-full rounded-lg text-body-md font-semibold shadow-elevated transition-all hover:bg-secondary hover:text-on-secondary hover:shadow-lg"
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-7 flex items-center justify-center gap-2 border-t border-outline-variant pt-5">
          <Icon name="lock" size={14} className="text-primary" />
          <p className="text-xs text-on-surface-variant">
            Secure access for authorized medical staff.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
