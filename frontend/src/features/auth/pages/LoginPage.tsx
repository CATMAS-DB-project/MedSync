import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { IconButton } from '../../../components/ui/IconButton';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ErrorBanner } from '../../../components/common/ErrorBanner';
import { useAuth } from '../../../context/AuthContext';
import { ApiError } from '../../../services/api/ApiError';
import { ROLE_HOME } from '../../../constants/roleAccess';

interface FieldErrors {
  username?: string;
  password?: string;
}

function classifyLoginError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Incorrect username or password.';
    if (err.status === 0 || err.status >= 500) {
      return "Can't reach the server. Check your connection and try again.";
    }
    return err.message || 'Something went wrong. Please try again.';
  }

  // Axios / fetch errors that were not wrapped in ApiError
  if (err instanceof Error) {
    if (err.name === 'AxiosError' || err.name === 'TypeError') {
      return "Can't reach the server. Check your connection and try again.";
    }
    return 'Something went wrong. Please try again.';
  }

  return 'Something went wrong. Please try again.';
}

export function LoginPage() {
  const { login, currentUser, isBootstrapping } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Already authenticated (either from bootstrap or from a fresh login) → go home.
  if (!isBootstrapping && currentUser) {
    return <Navigate to={ROLE_HOME[currentUser.role]} replace />;
  }

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
    if (error) setError(null);
    if (fieldErrors.username) {
      setFieldErrors((prev) => ({ ...prev, username: undefined }));
    }
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    if (error) setError(null);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const nextFieldErrors: FieldErrors = {};
    if (!username.trim()) nextFieldErrors.username = 'Username is required.';
    if (!password) nextFieldErrors.password = 'Password is required.';
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await login({ username, password });
      // On success, `currentUser` becomes non-null and the top-of-component
      // redirect fires on the next render.
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setError(classifyLoginError(err));
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const canSubmit = username.trim().length > 0 && password.length > 0;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Layered background: photo on top, gradient underneath so a missing
          /images/login-bg.jpg cleanly falls back to the gradient. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "url('/images/login-bg.jpg'), linear-gradient(135deg, #1A46A8 0%, #0F766E 100%)",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Dark-blue → teal translucent overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-on-surface/85 via-on-surface/55 to-on-secondary-container/70"
      />

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        {isBootstrapping ? (
          <Icon
            name="progress_activity"
            size={32}
            className="animate-spin text-white"
            aria-label="Loading"
          />
        ) : (
          <div className="w-full max-w-md animate-scale-in rounded-2xl border border-white/30 bg-white/90 p-6 shadow-modal backdrop-blur-xl sm:p-8">
            <div className="flex flex-col items-center gap-3">
              {/* TODO: replace with logo image */}
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-on-primary shadow-sm"
              >
                M
              </span>
              <span className="text-headline-sm font-bold tracking-tight text-on-surface">
                Medsync
              </span>
            </div>

            <h1 className="mt-6 text-center text-display-sm text-on-surface">Sign in</h1>

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <Input
                label="Username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                autoComplete="username"
                autoFocus
                error={fieldErrors.username}
                disabled={isSubmitting}
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                error={fieldErrors.password}
                disabled={isSubmitting}
                rightAdornment={
                  <IconButton
                    icon={showPassword ? 'visibility_off' : 'visibility'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    size="sm"
                    tabIndex={-1}
                  />
                }
              />

              {error && (
                <div aria-live="polite">
                  <ErrorBanner message={error} />
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="mt-1 w-full"
                isLoading={isSubmitting}
                disabled={!canSubmit}
              >
                Sign in
              </Button>
            </form>
          </div>
        )}
      </div>

      <p className="relative z-10 pb-6 text-center text-label-sm text-white/60">
        © Medsync
      </p>
    </div>
  );
}
