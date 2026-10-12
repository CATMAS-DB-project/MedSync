from unittest.mock import AsyncMock

import pytest

from app.domains.appointment_treatment import router as treatment_router
from app.domains.auth.models import UserIdentity


class Transaction:
    def __init__(self, connection: object) -> None:
        self.connection = connection

    async def __aenter__(self) -> object:
        return self.connection

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None


@pytest.mark.asyncio
async def test_create_treatments_skips_invalid_items(monkeypatch: pytest.MonkeyPatch) -> None:
    connection = object()
    create_treatment = AsyncMock(
        side_effect=[
            {"appointment_treatment_id": 10, "service_code": "CONSULT"},
            None,
        ]
    )
    monkeypatch.setattr(
        treatment_router,
        "with_transaction",
        lambda **_: Transaction(connection),
    )
    monkeypatch.setattr(
        treatment_router.service,
        "create_treatment",
        create_treatment,
    )

    result = await treatment_router.create_appointment_treatment(
        appointment_id=42,
        body=[
            {"service_code": "CONSULT"},
            {"service_code": "   "},
            {"service_code": "MISSING"},
        ],
        user=UserIdentity(staff_id=7, username="doctor", role="Doctor"),
    )

    assert result == {
        "data": {
            "created": [
                {"appointment_treatment_id": 10, "service_code": "CONSULT"}
            ],
            "failed": [
                {
                    "index": 1,
                    "error": "service_code: Value error, service_code must not be blank",
                },
                {
                    "index": 2,
                    "service_code": "MISSING",
                    "error": "Appointment or treatment catalogue item not found",
                },
            ],
        },
        "error": None,
    }
    assert create_treatment.await_count == 2
    assert create_treatment.await_args_list[0].args[2].service_code == "CONSULT"
