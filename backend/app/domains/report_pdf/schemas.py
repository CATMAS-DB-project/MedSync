from datetime import UTC, date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ReportMetadata(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    title: str
    subtitle: str
    branch_id: int | None = None
    branch_name: str = "All Branches (Consolidated)"
    from_date: date | None = None
    to_date: date | None = None
    generated_by: str = "System"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    category: str | None = None
    patient_id: int | None = None
    patient_name: str | None = None
