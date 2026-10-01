from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


def normalize_text(value: str, field_name: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError(f"{field_name} must not be blank")
    return value


class TreatmentCreate(BaseModel):
    service_code: str = Field(min_length=1, max_length=10)
    treatment_name: str = Field(min_length=1, max_length=100)
    unit_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    category: str = Field(min_length=1, max_length=50)

    @field_validator("service_code", "treatment_name", "category")
    @classmethod
    def normalize_strings(cls, value: str, info) -> str:
        return normalize_text(value, info.field_name)


class TreatmentUpdate(BaseModel):
    treatment_name: str | None = Field(default=None, min_length=1, max_length=100)
    unit_price: Decimal | None = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    category: str | None = Field(default=None, min_length=1, max_length=50)

    @field_validator("treatment_name", "category")
    @classmethod
    def normalize_strings(cls, value: str, info) -> str:
        return normalize_text(value, info.field_name)

    @model_validator(mode="after")
    def require_update_field(self) -> TreatmentUpdate:
        if not any(value is not None for value in self.model_dump().values()):
            raise ValueError("At least one treatment field is required")
        return self
