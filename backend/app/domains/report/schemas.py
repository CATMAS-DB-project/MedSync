from datetime import date

from pydantic import BaseModel, Field, model_validator


class ReportDateRange(BaseModel):
    branch_id: int | None = Field(default=None, gt=0)
    from_date: date | None = None
    to_date: date | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "ReportDateRange":
        if (
            self.from_date is not None
            and self.to_date is not None
            and self.from_date > self.to_date
        ):
            raise ValueError("from must be on or before to")
        return self
