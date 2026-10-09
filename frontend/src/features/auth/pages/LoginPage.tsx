import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { ApiError } from '../../../services/api/ApiError';
import { ROUTES } from '../../../constants/routes';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? ROUTES.DASHBOARD;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ username, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === 'SESSION_EXPIRED'
            ? 'Session expired. Please log in again.'
            : err.message
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-50 via-slate-50 to-slate-100"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-blue-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-200/30 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-[26rem] rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-900/5 sm:p-10">
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-teal-500 shadow-lg shadow-blue-500/20">
            <Icon name="clinical_notes" size={30} className="text-white" />
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            MedSync
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Clinical &amp; Administrative Management
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="text"
            aria-label="Username"
            placeholder="Enter Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            className="w-full rounded-full border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              aria-label="Password"
              placeholder="Enter Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-5 pr-12 text-sm text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              tabIndex={-1}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={18} />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <Icon name="error" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="mt-2 w-full rounded-full py-3.5 text-sm font-medium shadow-md shadow-blue-600/20 transition-all hover:shadow-lg hover:shadow-blue-600/30"
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-2">
          <Icon name="lock" size={14} className="text-slate-400" />
          <p className="text-xs text-slate-500">
            Secure access for authorized medical staff.
          </p>
        </div>
      </div>
    </div>
  );
}
