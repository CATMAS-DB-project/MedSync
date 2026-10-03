from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.domains.patients.schemas import PhoneType


class GuardianCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    nic: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)

    @field_validator("first_name", "last_name", "nic")
    @classmethod
    def trim_text(cls, value):
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("value must not be blank")
        return value


class GuardianUpdate(GuardianCreate):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self

    @field_validator("first_name", "last_name")
    @classmethod
    def names_cannot_be_null(cls, value):
        if value is None:
            raise ValueError("name cannot be null")
        return value


class GuardianPhoneCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone_number: str = Field(min_length=1, max_length=20)
    phone_type: PhoneType

    @field_validator("phone_number")
    @classmethod
    def trim_number(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("phone_number must not be blank")
        return value
