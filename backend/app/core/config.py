from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    log_level: str = "INFO"
    database_url: str | None = None
    db_pool_min_size: int = Field(default=2, ge=1)
    db_pool_max_size: int = Field(default=10, ge=1)

    jwt_secret: str = Field(
        default="development-only-change-this-secret",
        min_length=32,
    )
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "catms"
    jwt_audience: str = "catms-api"
    access_token_expire_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_expire_days: int = Field(default=14, ge=1, le=90)

    refresh_cookie_name: str = "catms_refresh_token"
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    refresh_cookie_path: str = "/api/v1/auth"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]