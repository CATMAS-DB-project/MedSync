from pydantic import BaseModel, Field, field_validator


class SpecialtyCreate(BaseModel):
    specialty_name: str = Field(min_length=1, max_length=50)

    @field_validator("specialty_name")
    @classmethod
    def normalize(cls, value: str) -> str:
        value = value.strip().lower()
        if not value:
            raise ValueError("specialty_name must not be blank")
        return value


class SpecialtyUpdate(SpecialtyCreate):
    pass
