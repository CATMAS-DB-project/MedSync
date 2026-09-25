from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import InvalidAccessTokenError, decode_access_token
from app.domains.auth.models import UserIdentity

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> UserIdentity:
    try:
        claims = decode_access_token(token)
    except InvalidAccessTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        ) from error
    return UserIdentity(
        staff_id=int(claims["sub"]),
        username=str(claims.get("username", "")),
        role=claims.get("role"),
        branch_id=claims.get("branch_id"),
    )


def require_role(*allowed_roles: str) -> Callable:
    async def role_dependency(
        current_user: Annotated[UserIdentity, Depends(get_current_user)],
    ) -> UserIdentity:
        if current_user.role not in allowed_roles:
            roles = ", ".join(allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {roles}",
            )
        return current_user

    return role_dependency
