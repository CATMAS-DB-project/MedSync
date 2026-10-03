from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BranchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    branch_name: str = Field(min_length=1, max_length=50)
    address: str = Field(min_length=1, max_length=255)
    contact_number: str | None = Field(default=None, max_length=20)
    manager_staff_id: int | None = Field(default=None, ge=1)

    @field_validator("branch_name", "address")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value must not be blank")
        return value

    @field_validator("contact_number")
    @classmethod
    def trim_contact_number(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None


class BranchUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    branch_name: str | None = Field(default=None, min_length=1, max_length=50)
    address: str | None = Field(default=None, min_length=1, max_length=255)
    contact_number: str | None = Field(default=None, max_length=20)
    manager_staff_id: int | None = Field(default=None, ge=1)

    @field_validator("branch_name", "address")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
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
