# CATMS Authentication Implementation Log

## Scope

This log records the CATMS authentication work completed for phases 0 through 12 of the authentication plan.

The current implementation is intentionally database-free and does not implement RBAC. Credentials and refresh sessions are held in memory so the authentication flow can be developed and tested before PostgreSQL/Supabase integration.

## Completed Work

### Phase 0: Security model

- Established versioned authentication routes under `/api/v1/auth`.
- Access tokens use short-lived signed JWTs.
- Refresh tokens are opaque, random, hashed before storage, and sent through an HttpOnly cookie.
- Refresh-token rotation and reuse detection are implemented.
- Authentication identifies the user but does not make authorization decisions.

### Phase 1: Configuration

Added typed settings in `backend/app/core/config.py` using `pydantic-settings`.

Configured values include:

- `JWT_SECRET`
- `JWT_ALGORITHM`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- Refresh-cookie name, path, security, and SameSite settings

The root `.env.example` contains placeholders for these values. Real secrets must remain in `.env` or the deployment environment.

### Phase 2: Password hashing

- Replaced the direct `bcrypt` dependency with `pwdlib[argon2]`.
- Added Argon2 password hashing and verification helpers.
- Passwords are never stored or returned as plaintext by the authentication service.

### Phase 3: Credential validation

Added an `InMemoryCredentialValidator` abstraction.

The current development credential is:

```text
username: dev-admin
password: change-me-before-sharing
```

This credential is temporary and must be replaced with environment-provided or database-backed credentials before sharing or deployment.

The validator returns a temporary identity shaped to match the future `user_account` model:

```text
staff_id: staff-001
username: dev-admin
role: Admin
branch_id: central
```

### Phases 4 and 5: Token services

JWT access tokens include:

- `sub`
- `iss`
- `aud`
- `iat`
- `exp`
- `jti`

JWT validation checks the signature, configured algorithm, issuer, audience, required claims, subject, and expiration.

Refresh tokens are generated with a cryptographically secure random generator and stored using a SHA-256 hash.

### Phase 6: In-memory refresh-token store

Added `InMemoryRefreshTokenStore` with support for:

- Saving refresh-token records
- Expiration checks
- Individual revocation
- Refresh-token replacement
- Session-family revocation
- Async locking around store mutations

Each record tracks the user, expiry, family ID, replacement token, and revocation timestamp.

### Phases 7 through 10: Authentication API

Added these routes:

| Method | Route | Behavior |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Validates credentials, returns an access token, and sets the refresh cookie |
| `POST` | `/api/v1/auth/refresh` | Rotates the refresh token and returns a new access token |
| `POST` | `/api/v1/auth/logout` | Revokes the refresh token and clears the cookie |
| `GET` | `/api/v1/auth/me` | Returns the identity from a valid access token |

A reusable `get_current_user` dependency protects authenticated routes.

The existing `/api/health` endpoint was preserved.

### Phases 9 and 11: Rotation and reuse detection

Normal refresh flow:

```text
refresh token A -> revoke A -> issue refresh token B
```

If token A is used again after rotation:

1. Reuse is detected.
2. The relevant token family is revoked.
3. The request receives HTTP 401.
4. No replacement token is issued.

### Phase 12: Tests

Added API tests covering:

- Invalid credentials return HTTP 401.
- Protected profile access without a token returns HTTP 401.
- Refresh-token rotation issues a different token.
- Reuse of a rotated token returns HTTP 401.
- Logout prevents subsequent refresh.

Each test uses an isolated `TestClient` to prevent cookie state leaking between tests.

## Files Added or Updated

### Added

- `backend/app/__init__.py`
- `backend/app/core/__init__.py`
- `backend/app/core/config.py`
- `backend/app/core/security.py`
- `backend/app/domains/__init__.py`
- `backend/app/domains/auth/__init__.py`
- `backend/app/domains/auth/models.py`
- `backend/app/domains/auth/service.py`
- `backend/app/domains/auth/router.py`
- `backend/tests/test_auth.py`
- `AUTH_IMPLEMENTATION_LOG.md`

### Updated

- `backend/app/main.py`
- `backend/pyproject.toml`
- `backend/uv.lock`
- `.env.example`

The backend `pyproject.toml` also configures pytest to import the local `app` package consistently.

## Validation

Commands used:

```powershell
cd backend
uv sync
uv run pytest
uv run ruff check .
```

Latest result:

```text
4 passed
All Ruff checks passed
```

The test run emits dependency deprecation warnings from the installed FastAPI/Starlette test client stack, but no test or lint failures remain.

## Not Included Yet

The following are deliberately deferred:

- PostgreSQL/Supabase credential validation
- Persistent refresh-token storage
- `/auth/me` database profile joins
- Frontend login and token handling
- RBAC and permission checks
- Rate limiting
- Production multi-worker refresh storage
- CSRF strategy for deployment environments
- Account recovery and password reset

## Next Planned Step

Replace the in-memory credential validator and refresh-token store behind their existing interfaces with PostgreSQL/Supabase adapters after the authentication behavior is stable and the database contract is finalized.
