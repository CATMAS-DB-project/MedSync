from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt
from pwdlib import PasswordHash

from app.core.config import Settings, get_settings

password_hash = PasswordHash.recommended()


class InvalidAccessTokenError(ValueError):
    """Raised when an access token cannot authenticate a request."""


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(
    subject: str,
    settings: Settings | None = None,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    config = settings or get_settings()
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": subject,
        "iss": config.jwt_issuer,
        "aud": config.jwt_audience,
        "iat": now,
        "exp": now + timedelta(minutes=config.access_token_expire_minutes),
        "jti": str(uuid4()),
    }
    if additional_claims:
        claims.update(additional_claims)
    return jwt.encode(claims, config.jwt_secret, algorithm=config.jwt_algorithm)


def decode_access_token(
    token: str,
    settings: Settings | None = None,
) -> dict[str, Any]:
    config = settings or get_settings()
    try:
        claims = jwt.decode(
            token,
            config.jwt_secret,
            algorithms=[config.jwt_algorithm],
            issuer=config.jwt_issuer,
            audience=config.jwt_audience,
            options={"require": ["sub", "iss", "aud", "iat", "exp", "jti"]},
        )
    except jwt.PyJWTError as error:
        raise InvalidAccessTokenError from error

    if not claims.get("sub"):
        raise InvalidAccessTokenError
    return claims