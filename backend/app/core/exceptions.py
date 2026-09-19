import logging

import asyncpg
from fastapi import FastAPI, Request, status
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("catms.errors")


def _envelope(code: str, message: str) -> dict:
    """Standard error body per CATMS_API_Endpoints.md."""
    return {
        "data": None,
        "error": {"code": code, "message": message},
    }


def register_exception_handlers(app: FastAPI) -> None:
    """
    Register global exception handlers. Every error becomes:
        {"data": null, "error": {"code": "...", "message": "..."}}
    with the appropriate HTTP status.

    Postgres errors are mapped to their semantic equivalents:
      UniqueViolationError      -> 409 Conflict   (UNIQUE constraint, BR-1 overlap)
      CheckViolationError       -> 400 Bad Request (trigger / CHECK rejections)
      ForeignKeyViolationError  -> 400 Bad Request
      NotNullViolationError     -> 400 Bad Request
      InvalidTextRepresentation -> 400 Bad Request (bad ENUM value)
    """

    @app.exception_handler(HTTPException)
    async def _handle_http(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(f"http_{exc.status_code}", str(exc.detail)),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Pydantic validation failed — flatten the message for humans.
        errors = exc.errors()
        message = "; ".join(
            f"{'.'.join(str(x) for x in e['loc'])}: {e['msg']}"
            for e in errors
        ) or "Invalid request payload"
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope("validation_error", message),
        )

    @app.exception_handler(asyncpg.exceptions.UniqueViolationError)
    async def _handle_unique(
        request: Request, exc: asyncpg.exceptions.UniqueViolationError
    ) -> JSONResponse:
        # Our triggers use ERRCODE 'unique_violation' for overlap checks;
        # genuine UNIQUE constraints (nic, username) also surface here.
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=_envelope("unique_violation", str(exc)),
        )

    @app.exception_handler(asyncpg.exceptions.CheckViolationError)
    async def _handle_check(
        request: Request, exc: asyncpg.exceptions.CheckViolationError
    ) -> JSONResponse:
        # Our triggers use ERRCODE 'check_violation' for business-rule
        # rejections (SAFE-1, BR-2, BR-4, audit attribution failure).
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_envelope("check_violation", str(exc)),
        )

    @app.exception_handler(asyncpg.exceptions.ForeignKeyViolationError)
    async def _handle_fk(
        request: Request, exc: asyncpg.exceptions.ForeignKeyViolationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_envelope("foreign_key_violation", str(exc)),
        )

    @app.exception_handler(asyncpg.exceptions.NotNullViolationError)
    async def _handle_not_null(
        request: Request, exc: asyncpg.exceptions.NotNullViolationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_envelope("not_null_violation", str(exc)),
        )

    @app.exception_handler(asyncpg.exceptions.InvalidTextRepresentationError)
    async def _handle_enum(
        request: Request,
        exc: asyncpg.exceptions.InvalidTextRepresentationError,
    ) -> JSONResponse:
        # e.g. inserting 'WrongStatus' into an ENUM column.
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_envelope("invalid_enum_value", str(exc)),
        )

    @app.exception_handler(asyncpg.exceptions.PostgresError)
    async def _handle_pg_generic(
        request: Request, exc: asyncpg.exceptions.PostgresError
    ) -> JSONResponse:
        # Any other Postgres error — usually a bug, not user input.
        log.exception("Unhandled Postgres error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(
                "database_error", "An unexpected database error occurred"
            ),
        )

    @app.exception_handler(Exception)
    async def _handle_unhandled(
        request: Request, exc: Exception
    ) -> JSONResponse:
        log.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(
                "internal_error", "An unexpected error occurred"
            ),
        )