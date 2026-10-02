"""End-to-end tests for Lahiru's sections (3.1–3.3).

Prerequisites:
- Supabase local Postgres running
- Seed data applied (admin, bm, reception, doctor, qa)
- Run from `backend/`: `uv run pytest tests/test_staff.py -v`

Test data uses a unique prefix per run and is cleaned up at module teardown.
"""

import asyncio
import uuid

import asyncpg
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

BASE = "/api/v1"
PREFIX = f"T{uuid.uuid4().hex[:6].upper()}"
PASSWORD = "testpass123"

_counter = 0


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture(scope="module")
def client():
    # Context-manager form triggers FastAPI lifespan → initializes DB pool
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def tokens(client):
    """Login as all 5 seed users. Returns {username: jwt}."""
    result = {}
    for user in ("admin", "bm", "reception", "doctor", "qa"):
        r = client.post(
            f"{BASE}/auth/login",
            json={"username": user, "password": "admin123"},
        )
        assert r.status_code == 200, f"login failed for {user}: {r.text}"
        body = r.json()
        # Auth responses are currently unwrapped
        result[user] = body.get("access_token") or body["data"]["access_token"]
    return result


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    """Delete every test row at module teardown."""
    yield

    async def _clean():
        conn = await asyncpg.connect(get_settings().database_url)
        try:
            await conn.execute(
                "DELETE FROM user_account WHERE username LIKE $1",
                f"{PREFIX.lower()}%",
            )
            await conn.execute(
                "DELETE FROM doctor_specialty WHERE staff_id IN "
                "(SELECT staff_id FROM staff WHERE nic LIKE $1)",
                f"{PREFIX}%",
            )
            await conn.execute(
                "DELETE FROM doctor WHERE staff_id IN "
                "(SELECT staff_id FROM staff WHERE nic LIKE $1)",
                f"{PREFIX}%",
            )
            await conn.execute(
                "DELETE FROM staff_phone WHERE staff_id IN "
                "(SELECT staff_id FROM staff WHERE nic LIKE $1)",
                f"{PREFIX}%",
            )
            await conn.execute("DELETE FROM staff WHERE nic LIKE $1", f"{PREFIX}%")
        finally:
            await conn.close()

    asyncio.run(_clean())


def h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_staff(client: TestClient, tokens: dict, tag: str = "") -> int:
    """Create a fresh staff row with a unique NIC. Returns staff_id."""
    global _counter
    _counter += 1
    nic = f"{PREFIX}-{tag}{_counter}"
    r = client.post(
        f"{BASE}/staff",
        headers=h(tokens["admin"]),
        json={
            "nic": nic,
            "first_name": "Test",
            "last_name": f"{tag}{_counter}",
            "date_of_birth": "1990-01-01",
            "gender": "Male",
            "branch_id": 1,
            "job_title": "Nurse",
            "hire_date": "2024-01-01",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]["staff_id"]


# =============================================================================
# 3.1 — Roles
# =============================================================================

class TestRoles:
    def test_no_token_401(self, client):
        assert client.get(f"{BASE}/roles").status_code == 401

    def test_receptionist_403(self, client, tokens):
        r = client.get(f"{BASE}/roles", headers=h(tokens["reception"]))
        assert r.status_code == 403

    def test_admin_200(self, client, tokens):
        r = client.get(f"{BASE}/roles", headers=h(tokens["admin"]))
        assert r.status_code == 200
        body = r.json()
        assert body["error"] is None
        assert body["data"]["total"] == 5
        assert len(body["data"]["items"]) == 5


# =============================================================================
# 3.2 — Specialties
# =============================================================================

class TestSpecialties:
    def test_no_token_401(self, client):
        assert client.get(f"{BASE}/specialties").status_code == 401

    def test_receptionist_can_read(self, client, tokens):
        r = client.get(f"{BASE}/specialties", headers=h(tokens["reception"]))
        assert r.status_code == 200

    def test_bm_cannot_create_403(self, client, tokens):
        r = client.post(
            f"{BASE}/specialties",
            headers=h(tokens["bm"]),
            json={"specialty_name": f"test-{PREFIX}"},
        )
        assert r.status_code == 403

    def test_admin_create_and_patch(self, client, tokens):
        name = f"sp-{PREFIX.lower()}"
        r = client.post(
            f"{BASE}/specialties",
            headers=h(tokens["admin"]),
            json={"specialty_name": f"  {name.upper()}  "},
        )
        assert r.status_code == 201
        sid = r.json()["data"]["specialty_id"]
        assert r.json()["data"]["specialty_name"] == name  # normalized

        r = client.patch(
            f"{BASE}/specialties/{sid}",
            headers=h(tokens["admin"]),
            json={"specialty_name": f"{name}-x"},
        )
        assert r.status_code == 200
        assert r.json()["data"]["specialty_name"] == f"{name}-x"

    def test_duplicate_409(self, client, tokens):
        name = f"dup-{PREFIX.lower()}"
        client.post(f"{BASE}/specialties", headers=h(tokens["admin"]),
                    json={"specialty_name": name})
        r = client.post(f"{BASE}/specialties", headers=h(tokens["admin"]),
                        json={"specialty_name": name})
        assert r.status_code == 409

    def test_blank_after_trim_422(self, client, tokens):
        r = client.post(f"{BASE}/specialties", headers=h(tokens["admin"]),
                        json={"specialty_name": "   "})
        assert r.status_code == 422

    def test_patch_404(self, client, tokens):
        r = client.patch(f"{BASE}/specialties/9999999",
                         headers=h(tokens["admin"]),
                         json={"specialty_name": "ghost"})
        assert r.status_code == 404


# =============================================================================
# 3.3.1 — Staff CRUD
# =============================================================================

class TestStaffList:
    def test_no_token_401(self, client):
        assert client.get(f"{BASE}/staff").status_code == 401

    def test_receptionist_403(self, client, tokens):
        r = client.get(f"{BASE}/staff", headers=h(tokens["reception"]))
        assert r.status_code == 403

    def test_admin_200_paginated(self, client, tokens):
        r = client.get(f"{BASE}/staff", headers=h(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()["data"]
        assert {"items", "total", "page", "page_size"} <= set(d)
        assert d["page"] == 1
        assert d["page_size"] == 25

    def test_filter_branch(self, client, tokens):
        r = client.get(f"{BASE}/staff?branch_id=1", headers=h(tokens["admin"]))
        assert r.status_code == 200
        for item in r.json()["data"]["items"]:
            assert item["branch_id"] == 1

    def test_search_by_name(self, client, tokens):
        r = client.get(f"{BASE}/staff?search=nimal", headers=h(tokens["admin"]))
        assert r.status_code == 200
        assert any(
            "nimal" in item["first_name"].lower()
            for item in r.json()["data"]["items"]
        )

    def test_invalid_enum_query_422(self, client, tokens):
        r = client.get(f"{BASE}/staff?employment_status=Bogus",
                       headers=h(tokens["admin"]))
        assert r.status_code == 422

    def test_branch_id_zero_422(self, client, tokens):
        r = client.get(f"{BASE}/staff?branch_id=0", headers=h(tokens["admin"]))
        assert r.status_code == 422


class TestStaffCreate:
    def test_receptionist_403(self, client, tokens):
        r = client.post(
            f"{BASE}/staff", headers=h(tokens["reception"]),
            json={"nic": f"{PREFIX}-REC", "first_name": "R", "last_name": "L",
                  "date_of_birth": "1990-01-01", "gender": "Male",
                  "branch_id": 1, "job_title": "Nurse",
                  "hire_date": "2024-01-01"},
        )
        assert r.status_code == 403

    def test_create_201_normalized(self, client, tokens):
        r = client.post(
            f"{BASE}/staff", headers=h(tokens["admin"]),
            json={"nic": f"  {PREFIX}-CR1  ", "first_name": "Create",
                  "last_name": "Test", "date_of_birth": "1990-01-01",
                  "gender": "Male", "branch_id": 1, "job_title": "Nurse",
                  "hire_date": "2024-01-01"},
        )
        assert r.status_code == 201
        d = r.json()["data"]
        assert d["nic"] == f"{PREFIX}-CR1"
        assert d["is_doctor"] is False
        assert d["has_account"] is False
        assert d["phones"] == []

    def test_duplicate_nic_409(self, client, tokens):
        payload = {"nic": f"{PREFIX}-DUP", "first_name": "D", "last_name": "O",
                   "date_of_birth": "1990-01-01", "gender": "Male",
                   "branch_id": 1, "job_title": "Nurse",
                   "hire_date": "2024-01-01"}
        assert client.post(f"{BASE}/staff", headers=h(tokens["admin"]),
                           json=payload).status_code == 201
        assert client.post(f"{BASE}/staff", headers=h(tokens["admin"]),
                           json=payload).status_code == 409

    def test_bad_branch_400(self, client, tokens):
        r = client.post(
            f"{BASE}/staff", headers=h(tokens["admin"]),
            json={"nic": f"{PREFIX}-FK", "first_name": "F", "last_name": "K",
                  "date_of_birth": "1990-01-01", "gender": "Male",
                  "branch_id": 999999, "job_title": "Nurse",
                  "hire_date": "2024-01-01"},
        )
        assert r.status_code == 400

    def test_future_dob_422(self, client, tokens):
        r = client.post(
            f"{BASE}/staff", headers=h(tokens["admin"]),
            json={"nic": f"{PREFIX}-FUT", "first_name": "F", "last_name": "T",
                  "date_of_birth": "2099-01-01", "gender": "Male",
                  "branch_id": 1, "job_title": "Nurse",
                  "hire_date": "2024-01-01"},
        )
        assert r.status_code == 422

    def test_future_hire_date_422(self, client, tokens):
        r = client.post(
            f"{BASE}/staff", headers=h(tokens["admin"]),
            json={"nic": f"{PREFIX}-FH", "first_name": "F", "last_name": "H",
                  "date_of_birth": "1990-01-01", "gender": "Male",
                  "branch_id": 1, "job_title": "Nurse",
                  "hire_date": "2099-01-01"},
        )
        assert r.status_code == 422


class TestStaffGetAndPatch:
    def test_get_admin_200(self, client, tokens):
        sid = _create_staff(client, tokens, "G")
        r = client.get(f"{BASE}/staff/{sid}", headers=h(tokens["admin"]))
        assert r.status_code == 200
        assert r.json()["data"]["staff_id"] == sid

    def test_get_404(self, client, tokens):
        r = client.get(f"{BASE}/staff/9999999", headers=h(tokens["admin"]))
        assert r.status_code == 404

    def test_self_access_allowed(self, client, tokens):
        me = client.get(f"{BASE}/auth/me", headers=h(tokens["reception"])).json()
        recep_id = me.get("staff_id") or me["data"]["staff_id"]
        r = client.get(f"{BASE}/staff/{recep_id}",
                       headers=h(tokens["reception"]))
        assert r.status_code == 200

    def test_other_staff_403(self, client, tokens):
        me = client.get(f"{BASE}/auth/me", headers=h(tokens["admin"])).json()
        admin_id = me.get("staff_id") or me["data"]["staff_id"]
        r = client.get(f"{BASE}/staff/{admin_id}",
                       headers=h(tokens["reception"]))
        assert r.status_code == 403

    def test_patch_partial(self, client, tokens):
        sid = _create_staff(client, tokens, "P")
        r = client.patch(f"{BASE}/staff/{sid}",
                         headers=h(tokens["admin"]),
                         json={"job_title": "Senior Nurse"})
        assert r.status_code == 200
        assert r.json()["data"]["job_title"] == "Senior Nurse"

    def test_patch_explicit_null_filtered(self, client, tokens):
        sid = _create_staff(client, tokens, "N")
        original = client.get(f"{BASE}/staff/{sid}",
                              headers=h(tokens["admin"])).json()["data"]
        r = client.patch(f"{BASE}/staff/{sid}",
                         headers=h(tokens["admin"]),
                         json={"first_name": None, "job_title": "Updated"})
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["first_name"] == original["first_name"]
        assert d["job_title"] == "Updated"

    def test_patch_404(self, client, tokens):
        r = client.patch(f"{BASE}/staff/9999999",
                         headers=h(tokens["admin"]),
                         json={"job_title": "X"})
        assert r.status_code == 404


# =============================================================================
# 3.3.2 — Staff Phones
# =============================================================================

class TestStaffPhones:
    def test_add_and_list(self, client, tokens):
        sid = _create_staff(client, tokens, "PH")
        r = client.post(f"{BASE}/staff/{sid}/phones",
                        headers=h(tokens["admin"]),
                        json={"phone_number": "+94771112222",
                              "phone_type": "Mobile"})
        assert r.status_code == 201
        assert r.json()["data"]["phone_number"] == "+94771112222"

        r = client.get(f"{BASE}/staff/{sid}/phones",
                       headers=h(tokens["admin"]))
        assert r.status_code == 200
        assert len(r.json()["data"]) == 1

    def test_invalid_type_422(self, client, tokens):
        sid = _create_staff(client, tokens, "PHT")
        r = client.post(f"{BASE}/staff/{sid}/phones",
                        headers=h(tokens["admin"]),
                        json={"phone_number": "+9477", "phone_type": "Fax"})
        assert r.status_code == 422

    def test_blank_number_422(self, client, tokens):
        sid = _create_staff(client, tokens, "PHB")
        r = client.post(f"{BASE}/staff/{sid}/phones",
                        headers=h(tokens["admin"]),
                        json={"phone_number": "   ", "phone_type": "Mobile"})
        assert r.status_code == 422

    def test_bad_fk_400(self, client, tokens):
        r = client.post(f"{BASE}/staff/9999999/phones",
                        headers=h(tokens["admin"]),
                        json={"phone_number": "+94771113333",
                              "phone_type": "Mobile"})
        assert r.status_code == 400

    def test_delete_204_then_404(self, client, tokens):
        sid = _create_staff(client, tokens, "PHD")
        pid = client.post(
            f"{BASE}/staff/{sid}/phones", headers=h(tokens["admin"]),
            json={"phone_number": "+94771114444", "phone_type": "Home"},
        ).json()["data"]["phone_id"]

        assert client.delete(f"{BASE}/staff/{sid}/phones/{pid}",
                             headers=h(tokens["admin"])).status_code == 204
        assert client.delete(f"{BASE}/staff/{sid}/phones/{pid}",
                             headers=h(tokens["admin"])).status_code == 404


# =============================================================================
# 3.3.3 — Doctor Subtype
# =============================================================================

class TestDoctorSubtype:
    def test_list_doctors(self, client, tokens):
        r = client.get(f"{BASE}/doctors", headers=h(tokens["reception"]))
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)

    def test_promote_201_normalized(self, client, tokens):
        sid = _create_staff(client, tokens, "DOC")
        r = client.post(f"{BASE}/staff/{sid}/doctor",
                        headers=h(tokens["admin"]),
                        json={"license_no": f"  slmc-{PREFIX}-d1  ",
                              "years_of_experience": 5,
                              "consultation_fee": 2500.0,
                              "qualifications": "MBBS"})
        assert r.status_code == 201
        assert r.json()["data"]["license_no"] == f"SLMC-{PREFIX}-D1"

    def test_promote_twice_409(self, client, tokens):
        sid = _create_staff(client, tokens, "D2")
        payload = {"license_no": f"SLMC-{PREFIX}-D2",
                   "years_of_experience": 3, "consultation_fee": 2000.0}
        assert client.post(f"{BASE}/staff/{sid}/doctor",
                           headers=h(tokens["admin"]),
                           json=payload).status_code == 201
        assert client.post(f"{BASE}/staff/{sid}/doctor",
                           headers=h(tokens["admin"]),
                           json=payload).status_code == 409

    def test_duplicate_license_409(self, client, tokens):
        s1 = _create_staff(client, tokens, "D3")
        s2 = _create_staff(client, tokens, "D4")
        lic = f"SLMC-{PREFIX}-SHARED"
        assert client.post(f"{BASE}/staff/{s1}/doctor",
                           headers=h(tokens["admin"]),
                           json={"license_no": lic,
                                 "years_of_experience": 1,
                                 "consultation_fee": 1000.0}
                           ).status_code == 201
        assert client.post(f"{BASE}/staff/{s2}/doctor",
                           headers=h(tokens["admin"]),
                           json={"license_no": lic,
                                 "years_of_experience": 1,
                                 "consultation_fee": 1000.0}
                           ).status_code == 409

    def test_negative_fee_422(self, client, tokens):
        sid = _create_staff(client, tokens, "D5")
        r = client.post(f"{BASE}/staff/{sid}/doctor",
                        headers=h(tokens["admin"]),
                        json={"license_no": f"SLMC-{PREFIX}-D5",
                              "years_of_experience": 0,
                              "consultation_fee": -100})
        assert r.status_code == 422

    def test_get_404_for_non_doctor(self, client, tokens):
        sid = _create_staff(client, tokens, "ND")
        r = client.get(f"{BASE}/staff/{sid}/doctor",
                       headers=h(tokens["admin"]))
        assert r.status_code == 404

    def test_link_and_unlink_specialty(self, client, tokens):
        sid = _create_staff(client, tokens, "LNK")
        client.post(f"{BASE}/staff/{sid}/doctor",
                    headers=h(tokens["admin"]),
                    json={"license_no": f"SLMC-{PREFIX}-LNK",
                          "years_of_experience": 1,
                          "consultation_fee": 1000.0})

        assert client.post(f"{BASE}/staff/{sid}/doctor/specialties",
                           headers=h(tokens["admin"]),
                           json={"specialty_id": 1}).status_code == 201
        # Idempotent
        assert client.post(f"{BASE}/staff/{sid}/doctor/specialties",
                           headers=h(tokens["admin"]),
                           json={"specialty_id": 1}).status_code == 201
        # Unlink
        assert client.delete(
            f"{BASE}/staff/{sid}/doctor/specialties/1",
            headers=h(tokens["admin"]),
        ).status_code == 204
        # Unlink again
        assert client.delete(
            f"{BASE}/staff/{sid}/doctor/specialties/1",
            headers=h(tokens["admin"]),
        ).status_code == 404

    def test_link_specialty_to_non_doctor_400(self, client, tokens):
        sid = _create_staff(client, tokens, "NL")
        r = client.post(f"{BASE}/staff/{sid}/doctor/specialties",
                        headers=h(tokens["admin"]),
                        json={"specialty_id": 1})
        assert r.status_code == 400


# =============================================================================
# 3.3.4 — User Account Subtype
# =============================================================================

class TestUserAccount:
    def test_non_admin_403(self, client, tokens):
        sid = _create_staff(client, tokens, "A1")
        r = client.post(f"{BASE}/staff/{sid}/account",
                        headers=h(tokens["bm"]),
                        json={"username": f"{PREFIX.lower()}a1",
                              "password": PASSWORD,
                              "role_name": "Receptionist"})
        assert r.status_code == 403

    def test_create_201_normalized(self, client, tokens):
        sid = _create_staff(client, tokens, "A2")
        username = f"{PREFIX.lower()}a2"
        r = client.post(f"{BASE}/staff/{sid}/account",
                        headers=h(tokens["admin"]),
                        json={"username": f"  {username.upper()}  ",
                              "password": PASSWORD,
                              "role_name": "Receptionist"})
        assert r.status_code == 201
        assert r.json()["data"]["username"] == username

    def test_weak_password_422(self, client, tokens):
        sid = _create_staff(client, tokens, "A3")
        r = client.post(f"{BASE}/staff/{sid}/account",
                        headers=h(tokens["admin"]),
                        json={"username": f"{PREFIX.lower()}a3",
                              "password": "123",
                              "role_name": "Receptionist"})
        assert r.status_code == 422

    def test_invalid_role_422(self, client, tokens):
        sid = _create_staff(client, tokens, "A4")
        r = client.post(f"{BASE}/staff/{sid}/account",
                        headers=h(tokens["admin"]),
                        json={"username": f"{PREFIX.lower()}a4",
                              "password": PASSWORD,
                              "role_name": "InvalidRole"})
        assert r.status_code == 422

    def test_doctor_role_on_non_doctor_400(self, client, tokens):
        """trg_user_role_doctor_consistency must reject this."""
        sid = _create_staff(client, tokens, "A5")
        r = client.post(f"{BASE}/staff/{sid}/account",
                        headers=h(tokens["admin"]),
                        json={"username": f"{PREFIX.lower()}a5",
                              "password": PASSWORD,
                              "role_name": "Doctor"})
        assert r.status_code == 400
        assert "Doctor" in r.json()["error"]["message"]

    def test_doctor_role_on_real_doctor_201(self, client, tokens):
        sid = _create_staff(client, tokens, "A6")
        client.post(f"{BASE}/staff/{sid}/doctor",
                    headers=h(tokens["admin"]),
                    json={"license_no": f"SLMC-{PREFIX}-A6",
                          "years_of_experience": 2,
                          "consultation_fee": 1500.0})
        r = client.post(f"{BASE}/staff/{sid}/account",
                        headers=h(tokens["admin"]),
                        json={"username": f"{PREFIX.lower()}a6",
                              "password": PASSWORD,
                              "role_name": "Doctor"})
        assert r.status_code == 201

    def test_duplicate_username_409(self, client, tokens):
        s1 = _create_staff(client, tokens, "A7")
        s2 = _create_staff(client, tokens, "A8")
        username = f"{PREFIX.lower()}dup"
        assert client.post(f"{BASE}/staff/{s1}/account",
                           headers=h(tokens["admin"]),
                           json={"username": username, "password": PASSWORD,
                                 "role_name": "Receptionist"}
                           ).status_code == 201
        assert client.post(f"{BASE}/staff/{s2}/account",
                           headers=h(tokens["admin"]),
                           json={"username": username, "password": PASSWORD,
                                 "role_name": "Receptionist"}
                           ).status_code == 409

    def test_disable_enable_login_flow(self, client, tokens):
        sid = _create_staff(client, tokens, "A9")
        username = f"{PREFIX.lower()}a9"
        client.post(f"{BASE}/staff/{sid}/account",
                    headers=h(tokens["admin"]),
                    json={"username": username, "password": PASSWORD,
                          "role_name": "Receptionist"})

        # Login works
        assert client.post(f"{BASE}/auth/login",
                           json={"username": username, "password": PASSWORD}
                           ).status_code == 200

        # Disable
        assert client.patch(f"{BASE}/staff/{sid}/account",
                            headers=h(tokens["admin"]),
                            json={"account_status": "Disabled"}
                            ).status_code == 200

        # Login now rejected
        assert client.post(f"{BASE}/auth/login",
                           json={"username": username, "password": PASSWORD}
                           ).status_code == 401

        # Re-enable
        client.patch(f"{BASE}/staff/{sid}/account",
                     headers=h(tokens["admin"]),
                     json={"account_status": "Active"})

        # Login works again
        assert client.post(f"{BASE}/auth/login",
                           json={"username": username, "password": PASSWORD}
                           ).status_code == 200

    def test_reset_password_flow(self, client, tokens):
        sid = _create_staff(client, tokens, "A10")
        username = f"{PREFIX.lower()}a10"
        client.post(f"{BASE}/staff/{sid}/account",
                    headers=h(tokens["admin"]),
                    json={"username": username, "password": PASSWORD,
                          "role_name": "Receptionist"})

        new_pw = "newpass456"
        assert client.post(f"{BASE}/staff/{sid}/account/reset-password",
                           headers=h(tokens["admin"]),
                           json={"new_password": new_pw}
                           ).status_code == 204

        assert client.post(f"{BASE}/auth/login",
                           json={"username": username, "password": new_pw}
                           ).status_code == 200
        assert client.post(f"{BASE}/auth/login",
                           json={"username": username, "password": PASSWORD}
                           ).status_code == 401

    def test_patch_to_doctor_on_non_doctor_400(self, client, tokens):
        sid = _create_staff(client, tokens, "A11")
        username = f"{PREFIX.lower()}a11"
        client.post(f"{BASE}/staff/{sid}/account",
                    headers=h(tokens["admin"]),
                    json={"username": username, "password": PASSWORD,
                          "role_name": "Receptionist"})

        r = client.patch(f"{BASE}/staff/{sid}/account",
                         headers=h(tokens["admin"]),
                         json={"role_name": "Doctor"})
        assert r.status_code == 400

    def test_reset_password_404(self, client, tokens):
        r = client.post(f"{BASE}/staff/9999999/account/reset-password",
                        headers=h(tokens["admin"]),
                        json={"new_password": "whatever123"})
        assert r.status_code == 404