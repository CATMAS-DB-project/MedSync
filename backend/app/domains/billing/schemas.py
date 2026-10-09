from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


PaymentMethod = Literal["Cash", "Credit Card", "Insurance"]
InvoiceStatus = Literal["Draft", "Finalized", "Partially Paid", "Paid"]
ClaimStatus = Literal["Pending", "Approved", "Rejected"]


class InvoiceFinalize(BaseModel):
    model_config = ConfigDict(extra="forbid")
    insurance_deduction: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    manual_discount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)


class PaymentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount_paid: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    payment_method: PaymentMethod


class ClaimCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    policy_id: str = Field(min_length=1, max_length=30)
    claimed_amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
