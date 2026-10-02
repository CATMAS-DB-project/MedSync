from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Gender = Literal["Male", "Female", "Other"]
EmploymentStatus = Literal["Active", "OnLeave", "Terminated"]
PhoneType = Literal["Mobile", "Home", "Work"]
AccountStatus = Literal["Active", "Disabled"]
RoleName = Literal[
    "Admin", "Branch Manager", "Receptionist",
    "Doctor", "QA Tester",
]


class StaffCreate(BaseModel):
    nic: str = Field(min_length=1, max_length=20)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    date_of_birth: date
    gender: Gender
    address: str | None = Field(None, max_length=255)
    branch_id: int
    job_title: str = Field(min_length=1, max_length=50)
    employment_status: EmploymentStatus = "Active"
    hire_date: date

    @field_validator("nic")
    @classmethod
    def normalize_nic(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("nic must not be blank")
        return value

    @field_validator("date_of_birth", "hire_date")
    @classmethod
    def reject_future_dates(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("date must not be in the future")
        return value


class StaffUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    address: str | None = Field(None, max_length=255)
    branch_id: int | None = None
    job_title: str | None = Field(None, min_length=1, max_length=50)
    employment_status: EmploymentStatus | None = None
    hire_date: date | None = None

    @field_validator("hire_date")
    @classmethod
    def reject_future_hire_date(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("hire_date must not be in the future")
        return value


class PhoneCreate(BaseModel):
    phone_number: str = Field(min_length=1, max_length=20)
    phone_type: PhoneType

    @field_validator("phone_number")
    @classmethod
    def normalize_number(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("phone_number must not be blank")
        return value


class DoctorPromote(BaseModel):
    license_no: str = Field(min_length=1, max_length=50)
    years_of_experience: int = Field(default=0, ge=0)
    consultation_fee: float = Field(default=0.0, ge=0)
    qualifications: str | None = None

    @field_validator("license_no")
    @classmethod
    def normalize_license(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("license_no must not be blank")
        return value


class SpecialtyLink(BaseModel):
    specialty_id: int = Field(gt=0)


class AccountCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=72)
    role_name: RoleName

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        value = value.strip().lower()
        if len(value) < 3:
            raise ValueError("username must be at least 3 characters")
        return value


class AccountUpdate(BaseModel):
    role_name: RoleName | None = None
    account_status: AccountStatus | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=6, max_length=72)
