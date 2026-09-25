from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=256)


class UserIdentity(BaseModel):
    model_config = ConfigDict(frozen=True)

    staff_id: int
    username: str
    role: str | None = None
    branch_id: int | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserIdentity


class RefreshRecord(BaseModel):
    token_hash: str
    user: UserIdentity
    expires_at: datetime
    family_id: str
    replaced_by: str | None = None
    revoked_at: datetime | None = None
