// Pulled from Vite's env (define VITE_API_BASE_URL in a .env file, or it
// falls back to the local dev default). Never hardcode a deployed URL here.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/**
 * When true, AuthContext skips real network calls entirely and logs in as
 * the mock user immediately - for building/testing UI before the backend
 * exists. Automatically OFF in a production build (import.meta.env.DEV is
 * false there no matter what), so this can never accidentally ship.
 * To turn it off in dev while testing against a real local backend, set
 * VITE_DEV_BYPASS_AUTH=false in a .env file.
 */
export const DEV_BYPASS_AUTH: boolean =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH !== 'false';
