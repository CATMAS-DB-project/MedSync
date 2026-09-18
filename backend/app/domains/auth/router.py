from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash

from app.core.config import Settings, get_settings
from app.core.security import (
    InvalidAccessTokenError,
    create_access_token,
    decode_access_token,
)
from app.domains.auth.models import LoginRequest, LoginResponse, UserIdentity
from app.domains.auth.service import (
    InMemoryCredentialValidator,
    InMemoryRefreshTokenStore,
    create_refresh_record,
    hash_refresh_token,
)

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
password_hash = PasswordHash.recommended()
credential_validator = InMemoryCredentialValidator(
    username="dev-admin",
    password_hash=password_hash.hash("password"),
    user=UserIdentity(staff_id="staff-001", username="dev-admin", role="Admin", branch_id="central"),
)
refresh_store = InMemoryRefreshTokenStore()
router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, raw_token: str, config: Settings) -> None:
    response.set_cookie(
        key=config.refresh_cookie_name,
        value=raw_token,
        httponly=True,
        secure=config.refresh_cookie_secure,
        samesite=config.refresh_cookie_samesite,
        max_age=config.refresh_token_expire_days * 86400,
        path=config.refresh_cookie_path,
    )


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> UserIdentity:
    try:
        claims = decode_access_token(token)
    except InvalidAccessTokenError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from error
    return UserIdentity(
        staff_id=str(claims["sub"]),
        username=str(claims.get("username", "")),
        role=claims.get("role"),
        branch_id=claims.get("branch_id"),
    )


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, response: Response) -> LoginResponse:
    user = await credential_validator.authenticate(payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    raw_refresh_token, refresh_record = create_refresh_record(user, settings)
    await refresh_store.save(refresh_record)
    _set_refresh_cookie(response, raw_refresh_token, settings)
    access_token = create_access_token(
        user.staff_id,
        settings,
        {"username": user.username, "role": user.role, "branch_id": user.branch_id},
    )
    return LoginResponse(access_token=access_token, user=user)


@router.post("/refresh", response_model=LoginResponse)
async def refresh(
    response: Response,
    refresh_token: Annotated[str | None, Cookie(alias=settings.refresh_cookie_name)] = None,
) -> LoginResponse:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    token_hash = hash_refresh_token(refresh_token)
    record = await refresh_store.get(token_hash)
    if record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if record.revoked_at is not None or record.replaced_by is not None:
        await refresh_store.revoke_family(record.family_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reuse detected")

    new_raw_token, replacement = create_refresh_record(record.user, settings)
    replacement = replacement.model_copy(update={"family_id": record.family_id})
    if await refresh_store.rotate(token_hash, replacement) is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    _set_refresh_cookie(response, new_raw_token, settings)
    access_token = create_access_token(
        record.user.staff_id,
        settings,
        {"username": record.user.username, "role": record.user.role, "branch_id": record.user.branch_id},
    )
    return LoginResponse(access_token=access_token, user=record.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: Annotated[str | None, Cookie(alias=settings.refresh_cookie_name)] = None,
) -> None:
    if refresh_token:
        await refresh_store.revoke(hash_refresh_token(refresh_token))
    response.delete_cookie(settings.refresh_cookie_name, path=settings.refresh_cookie_path)


@router.get("/me", response_model=UserIdentity)
async def me(current_user: Annotated[UserIdentity, Depends(get_current_user)]) -> UserIdentity:
    return current_user