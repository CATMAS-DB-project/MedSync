# Authentication Integration Reminder

## Current Status

The frontend login handler is implemented and the request reaches the backend successfully. The remaining problem is an API contract mismatch between the frontend and backend authentication code.

## Main Mismatch

The backend currently returns direct JSON with snake_case fields:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": {
    "staff_id": 1,
    "username": "dev-admin",
    "role": "Admin",
    "branch_id": 1
  }
}
```

The frontend currently expects an envelope and camelCase fields:

```json
{
  "data": {
    "accessToken": "..."
  },
  "error": null
}
```

Because of this, the frontend does not store the access token correctly after login. The following `/auth/me` request is then sent without valid authentication.

## Required Fixes

### 1. Login response

Align `frontend/src/services/api/auth.ts` and `frontend/src/types/auth.ts` with the backend response, or change the backend to return the frontend envelope contract.

The contract must consistently define:

- `access_token` versus `accessToken`
- Direct response versus `{ data, error }` envelope
- Nested `user` object versus flat user fields

### 2. Refresh response

The backend currently returns the same direct response shape as login. The frontend refresh handler expects:

```json
{
  "data": {
    "accessToken": "..."
  },
  "error": null
}
```

The refresh response handling must be updated to match the selected contract.

### 3. `/auth/me` response

The backend currently returns approximately:

```json
{
  "staff_id": 1,
  "username": "dev-admin",
  "role": "Admin",
  "branch_id": 1
}
```

The frontend currently expects additional fields:

```json
{
  "staff_id": 1,
  "first_name": "...",
  "last_name": "...",
  "role": "Admin",
  "branch_id": 1,
  "branch_name": "..."
}
```

Either the backend must return the complete profile, or the frontend mapper must accept the smaller current response.

### 4. Logout response

The backend returns `204 No Content` from `/auth/logout`.

The frontend API client currently always calls `response.json()`. It must handle `204` without trying to parse an empty response body.

### 5. Cookies

The frontend correctly sends:

```ts
credentials: 'include'
```

The backend refresh token is stored in an HttpOnly cookie, so this behavior must remain enabled for login, refresh, and logout requests.

### 6. API base URL and proxy

The frontend uses:

```text
/api/v1
```

The Vite development proxy forwards `/api` to:

```text
http://backend:8000
```

This works inside the Docker development environment. Direct browser calls to `localhost:8000` from the Vite frontend may require CORS configuration in FastAPI.

## Files Involved

- `frontend/src/services/api/auth.ts`
- `frontend/src/services/api/client.ts`
- `frontend/src/types/auth.ts`
- `frontend/src/types/common.ts`
- `frontend/src/context/AuthContext.tsx`
- `backend/app/domains/auth/router.py`
- `backend/app/domains/auth/models.py`

## Recommended Decision

Use one shared API contract across login, refresh, `/auth/me`, errors, and logout.

The current backend uses direct JSON and snake_case. The frontend should either be adapted to that contract or the backend should consistently provide the frontend envelope and camelCase contract. Do not maintain two response formats.

## Manual Verification

Open the frontend login page and use:

```text
username: dev-admin
password: password
```

Then inspect the browser Network tab:

1. `POST /api/v1/auth/login` should return HTTP 200.
2. The response should contain an access token.
3. A refresh-token cookie should be set.
4. `GET /api/v1/auth/me` should include an Authorization header.
5. `/auth/me` should return the fields expected by the frontend.
6. `POST /api/v1/auth/refresh` should return a new access token after expiry.
7. `POST /api/v1/auth/logout` should return HTTP 204 without a JSON parsing error.

## Validation Commands

```powershell
cd backend
uv run pytest
uv run ruff check .

cd ../frontend
npm run build
```
