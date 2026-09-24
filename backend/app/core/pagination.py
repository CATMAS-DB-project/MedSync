"""Shared query-parameter pagination helpers for FastAPI list endpoints."""

from typing import Any, Sequence, TypeVar

from fastapi import Query

T = TypeVar("T")


def pagination(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> dict[str, int]:
    """Validate pagination parameters and calculate SQL LIMIT/OFFSET values."""
    return {
        "page": page,
        "page_size": page_size,
        "offset": (page - 1) * page_size,
        "limit": page_size,
    }


def list_response(
    items: Sequence[T],
    total: int,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """Build the shared list payload (to be wrapped by the API envelope)."""
    return {
        "items": list(items),
        "total": total,
        "page": page,
        "page_size": page_size,
    }
