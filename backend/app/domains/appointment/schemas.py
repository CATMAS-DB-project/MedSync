from datetime import date, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator

AppointmentStatus = Literal["Scheduled", "Completed", "Cancelled"]


class AppointmentCreate(BaseModel):
    patient_id: int = Field(gt=0)
    doctor_staff_id: int = Field(gt=0)
    branch_id: int = Field(gt=0)
    appointment_date: date
    appointment_time: time
    is_walk_in: bool = False


class AppointmentCancel(BaseModel):
    reason: str = Field(min_length=1, max_length=255)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("reason must not be blank")
        return value


class AppointmentAvailabilityQuery(BaseModel):
    doctor_id: int = Field(gt=0)
    date: date