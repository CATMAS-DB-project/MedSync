"""Shared authentication, role authorization, and database connection deps."""

from collections.abc import AsyncIterator, Callable
from typing import Any

import asyncpg
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import InvalidAccessTokenError, decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_conn(request: Request) -> AsyncIterator[asyncpg.Connection]:
    """Acquire a connection from the asyncpg pool installed on app.state."""
    pool: asyncpg.Pool | None = getattr(request.app.state, "db_pool", None)
    if pool is None:
        raise RuntimeError(
            "Database pool is not configured; initialize app.state.db_pool at startup."
        )

    async with pool.acquire() as conn:
        yield conn


def _auth_error(code: str, message: str, http_status: int) -> HTTPException:
    return HTTPException(
        status_code=http_status,
        detail={"code": code, "message": message},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    conn: asyncpg.Connection = Depends(get_conn),
) -> dict[str, Any]:
    """Validate the bearer JWT and load the current, active staff account."""
    if credentials is None:
        raise _auth_error("http_401", "Missing bearer token", status.HTTP_401_UNAUTHORIZED)

    try:
        claims = decode_access_token(credentials.credentials)
    except InvalidAccessTokenError as error:
        raise _auth_error(
            "http_401", "Invalid access token", status.HTTP_401_UNAUTHORIZED
        ) from error

    try:
        staff_id = int(claims["sub"])
    except (KeyError, TypeError, ValueError) as error:
        raise _auth_error(
            "http_401", "Invalid access token", status.HTTP_401_UNAUTHORIZED
        ) from error

    row = await conn.fetchrow(
        """
        SELECT
            ua.staff_id,
            ua.username,
            r.role_name::text AS role_name,
            s.first_name,
            s.last_name,
            s.branch_id,
            s.job_title,
            ua.account_status::text AS account_status
        FROM user_account AS ua
        JOIN role AS r ON r.role_id = ua.role_id
        JOIN staff AS s ON s.staff_id = ua.staff_id
        WHERE ua.staff_id = $1
        """,
        staff_id,
    )

    if row is None or row["account_status"] != "Active":
        raise _auth_error(
            "http_401", "Account is missing or disabled", status.HTTP_401_UNAUTHORIZED
        )

    return dict(row)


def require_role(*allowed_roles: str) -> Callable[..., Any]:
    """Build a dependency that allows only the listed role names."""
    if not allowed_roles:
        raise ValueError("require_role needs at least one allowed role")

    async def role_dependency(
        user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        role_name = user["role_name"]
        if role_name not in allowed_roles:
            allowed = ", ".join(allowed_roles)
            raise _auth_error(
                "http_403",
                f"Requires one of: {allowed}",
                status.HTTP_403_FORBIDDEN,
            )
        return user

    return role_dependency


async def api_http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Render HTTP errors using the API's standard data/error envelope."""
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        code = str(detail["code"])
        message = str(detail["message"])
    else:
        code = f"http_{exc.status_code}"
        message = str(detail)

    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={"data": None, "error": {"code": code, "message": message}},
    )


def install_api_error_handler(app: FastAPI) -> None:
    """Register the error envelope handler; call once during app setup."""
    app.add_exception_handler(HTTPException, api_http_exception_handler)
