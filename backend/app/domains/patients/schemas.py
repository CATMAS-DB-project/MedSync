from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Gender = Literal["Male", "Female", "Other"]
PhoneType = Literal["Mobile", "Home", "Work"]
InsuranceStatus = Literal["Active", "Inactive"]


class PatientCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nic_passport_no: str = Field(min_length=1, max_length=20)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    date_of_birth: date
    gender: Gender
    address: str | None = Field(default=None, max_length=255)
    registered_branch_id: int = Field(ge=1)

    @field_validator("nic_passport_no", "first_name", "last_name")
    @classmethod
    def non_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value must not be blank")
        return value


class PatientUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nic_passport_no: str | None = Field(default=None, min_length=1, max_length=20)
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    date_of_birth: date | None = None
    gender: Gender | None = None
    address: str | None = Field(default=None, max_length=255)

    @field_validator("nic_passport_no", "first_name", "last_name")
    @classmethod
    def non_blank_if_set(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("value must not be blank")
        return value

    @model_validator(mode="after")
    def require_a_change(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class PhoneCreate(BaseModel):
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


class GuardianInline(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    nic: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)


class PatientGuardianLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    relationship: str = Field(min_length=1, max_length=50)
    guardian_id: int | None = Field(default=None, ge=1)
    new_guardian: GuardianInline | None = None

    @field_validator("relationship")
    @classmethod
    def trim_relationship(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("relationship must not be blank")
        return value

    @model_validator(mode="after")
    def exactly_one_guardian_source(self):
        if (self.guardian_id is None) == (self.new_guardian is None):
            raise ValueError("Provide either guardian_id or new_guardian")
        return self


class InsuranceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    policy_id: str = Field(min_length=1, max_length=30)
    provider_name: str = Field(min_length=1, max_length=100)
    coverage_level: str = Field(min_length=1, max_length=50)
    status: InsuranceStatus = "Active"

    @field_validator("policy_id", "provider_name", "coverage_level")
    @classmethod
    def trim_required_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value must not be blank")
        return value


class InsuranceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: InsuranceStatus | None = None
    coverage_level: str | None = Field(default=None, min_length=1, max_length=50)

    @field_validator("coverage_level")
    @classmethod
    def trim_coverage(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("coverage_level must not be blank")
        return value

    @model_validator(mode="after")
    def require_a_change(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self
