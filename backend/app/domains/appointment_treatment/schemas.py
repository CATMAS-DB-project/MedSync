from pydantic import BaseModel, Field, field_validator


def normalize_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} must not be blank")
    return normalized


class TreatmentLogCreate(BaseModel):
    service_code: str = Field(min_length=1, max_length=10)

    @field_validator("service_code")
    @classmethod
    def normalize_service_code(cls, value: str) -> str:
        return normalize_text(value, "service_code")


class TreatmentAmendCreate(TreatmentLogCreate):
    amendment_reason: str = Field(min_length=1, max_length=255)

    @field_validator("amendment_reason")
    @classmethod
    def normalize_amendment_reason(cls, value: str) -> str:
        return normalize_text(value, "amendment_reason")


class ConsultationNotesUpdate(BaseModel):
    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None
