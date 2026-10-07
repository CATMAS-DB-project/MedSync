```markdown
# CATMS Backend — Authorization & Ownership Audit

**Scope:** All backend endpoints across domains.
**Policy source:** SRS (SEC-1, SEC-5, REQ-PM-2, SAFE-5, BR-5) — *not* the generic "all non-Admin roles restricted to own branch" policy that a code-review audit suggested.
**Guiding principle:**
- **Reads** of patient/guardian/doctor/reference data remain **cross-branch** (required by REQ-PM-2 and SAFE-5).
- **Writes** that create or modify branch-owned records must **derive branch from the caller's session**, not from the request body.
- **Ownership checks** apply where the SRS requires them (SEC-1): a doctor acts only on their own appointments and treatments.
- **Role checks** follow the API spec's RBAC legend.

---

## 1. Executive Summary

| Category | Count | Effort |
|---|---|---|
| 🔴 Critical — ownership violations | 6 | ~2 hrs |
| 🟠 High — server-side branch derivation on writes | 3 | ~1 hr |
| 🟡 Medium — cross-branch write scoping for Receptionist | 8 | ~3 hrs |
| 🟢 Low — documentation / decision record | 1 | ~30 min |
| **Total** | **18** | **~1 day** |

---

## 2. Issue Catalogue

### 🔴 Category A — Ownership Violations (Doctor acting on another doctor's appointments)

These directly violate SRS SEC-1 ("Doctors enter only their own notes").

| # | Endpoint | File | Problem | Fix |
|---|---|---|---|---|
| A1 | `GET /appointments` | `appointment/router.py` | Doctor can list every appointment in the system | Scope `doctor_staff_id = user.staff_id` when role is Doctor |
| A2 | `GET /appointments/{id}` | `appointment/router.py` | Doctor can view any appointment | 404 (not 403) if appointment's doctor != caller and role is Doctor |
| A3 | `POST /appointments/{id}/complete` | `appointment/router.py` | Doctor can complete any appointment | Reject if `appointment.doctor_staff_id != user.staff_id` |
| A4 | `GET /appointments/{id}/treatments` | `appointment_treatment/router.py` | Doctor can read any appointment's treatments | Same check as A2 |
| A5 | `POST /appointments/{id}/treatments` | `appointment_treatment/router.py` | Doctor can log a treatment on another doctor's appointment | Reject if doctor mismatch |
| A6 | `PATCH /appointments/{id}/notes` | `appointment_treatment/router.py` | Doctor can overwrite another doctor's consultation notes | Reject if doctor mismatch |

**Note:** Use **404** rather than 403 for these. A 403 leaks that the appointment exists. A 404 tells the caller "not yours, not visible."

---

### 🟠 Category B — Body-Supplied Branch on Writes

Client can lie about which branch they're acting on.

| # | Endpoint | File | Problem | Fix |
|---|---|---|---|---|
| B1 | `POST /patients` | `patients/router.py` | `registered_branch_id` taken from request body | Ignore the body value; use the authenticated Receptionist's `user.branch_id` |
| B2 | `POST /appointments` | `appointment/router.py` | `branch_id` taken from request body | Derive from the authenticated Receptionist's `user.branch_id` |
| B3 | `POST /staff` | `staff/router.py` | `branch_id` accepted from any Admin/BM | **BM only**: force `branch_id = user.branch_id`; Admin may set freely |

---

### 🟡 Category C — Cross-Branch Write Scoping (Receptionist)

Receptionists should be able to **read** any patient (per SAFE-5) but should only **write** to records within their own branch. This is a defensible middle ground: emergency cross-branch lookup works, but day-to-day data entry is branch-local.

| # | Endpoint | File | Current | Fix |
|---|---|---|---|---|
| C1 | `PATCH /patients/{id}` | `patients/router.py` | Any receptionist can update any patient | Reject if `patient.registered_branch_id != user.branch_id` |
| C2 | `POST /patients/{id}/phones` | `patients/router.py` | Same | Same predicate |
| C3 | `DELETE /patients/{id}/phones/{pid}` | `patients/router.py` | Same | Same |
| C4 | `POST /patients/{id}/guardians` | `patients/router.py` | Same | Same |
| C5 | `DELETE /patients/{id}/guardians/{gid}` | `patients/router.py` | Same | Same |
| C6 | `POST /patients/{id}/insurance` | `patients/router.py` | Same | Same |
| C7 | `PATCH /patients/{id}/insurance/{pid}` | `patients/router.py` | Same | Same |
| C8 | `PATCH /guardians/{id}` + phones | `guardians/router.py` | No branch check on guardian writes | Reject if guardian is linked to any patient outside caller's branch |

**Decision needed on C8:** a guardian may be linked to patients in two different branches (e.g., blended family). Options:
- (a) **Reject write** if guardian has any link outside caller's branch.
- (b) **Allow write** but only if caller shares at least one branch with the guardian.
- **Recommendation: (b)** — more permissive, avoids blocking legitimate edits.

Patient subresource writes C1-C7 are implemented with the same predicate.
These routes are Receptionist-only, so Admin is not implicitly added where the
SRS role list excludes Admin. Standalone guardian writes (C8) are unchanged
because they are not patient subresource routes.

---

### 🟢 Category D — Documentation

| # | Item | Action |
|---|---|---|
| D1 | Branch-scoping policy | Add `Decision #N` to `DECISIONS.md` explaining reads remain cross-branch, writes are branch-derived, ownership checks are role-scoped |

---

## 3. Endpoints Explicitly NOT Changed

Documenting these so reviewers know they were considered and rejected.

| Endpoint family | Reason not changed |
|---|---|
| `GET /branches`, `GET /branches/{id}` | Every authenticated user needs branch names for dropdowns and branch-switch UIs |
| `GET /patients`, `GET /patients/{id}`, subresource reads | REQ-PM-2 + SAFE-5 require cross-branch reads |
| `GET /guardians/*` (reads) | Same, tied to patients |
| `GET /doctors`, `GET /staff/{id}/doctor` | Booking needs cross-branch doctor lookup |
| `GET /treatments`, `GET /specialties`, `GET /roles` | Global reference data |
| `GET /audit-logs`, `GET /audit-logs/{id}` | QA testers need broad visibility; restricting breaks their purpose |
| `POST /invoices/*`, `POST /insurance-claims/*` | See Category E below if you want billing scoped — decide separately |

---

## 4. Billing Write Decision

Billing reads remain cross-branch where the RBAC table permits them, but
Receptionist billing writes are scoped to the branch of the related
appointment/invoice. This prevents an arbitrary invoice or claim ID from
redirecting a write to another branch while leaving read access available for
patient-service workflows.

Implemented checks cover invoice finalization, payment creation, claim
creation, and claim verification. This is a deliberate defense-in-depth
decision; the SRS does not require blanket branch isolation for patient reads.

---

## 5. Implementation Plan

### Phase 1 — Ownership Checks (Category A) ~2 hrs

**File: `backend/app/domains/appointment/service.py`**

Add helper:

```python
async def assert_doctor_owns_appointment(
    conn, appointment_id: int, user: UserIdentity
) -> None:
    """Raise 404 if the appointment doesn't exist or isn't this doctor's."""
    if user.role != "Doctor":
        return
    row = await conn.fetchrow(
        "SELECT doctor_staff_id FROM appointment WHERE appointment_id = $1",
        appointment_id,
    )
    if row is None or row["doctor_staff_id"] != user.staff_id:
        raise HTTPException(status_code=404, detail="Appointment not found")
```

Call it from:
- `appointment/router.py::get_appointment` (A2)
- `appointment/router.py::complete_appointment` (A3)
- `appointment_treatment/router.py::list_treatments` (A4)
- `appointment_treatment/router.py::log_treatment` (A5)
- `appointment_treatment/router.py::update_notes` (A6)

**For `list_appointments` (A1):** add a WHERE clause in the service:

```python
if user.role == "Doctor":
    where.append(f"a.doctor_staff_id = ${len(args) + 1}")
    args.append(user.staff_id)
```

---

### Phase 2 — Server-Side Branch Derivation (Category B) ~1 hr

**`patients/router.py::create_patient`:**

```python
data = body.model_dump()
if user.role != "Admin":
    data["registered_branch_id"] = user.branch_id
```

Also change the schema so `registered_branch_id` is optional in the request body — the server always overrides it for non-Admin, and for Admin it's required.

**`appointment/router.py::create_appointment`:**

```python
data = body.model_dump()
if user.role != "Admin":
    data["branch_id"] = user.branch_id
```

Optionally: verify the doctor belongs to the same branch as the caller for non-Admin (a Colombo receptionist shouldn't book for a Kandy doctor unless cross-branch booking is explicitly allowed).

**`staff/router.py::create_staff`:**

```python
if user.role == "Branch Manager":
    body.branch_id = user.branch_id  # force override
```

---

### Phase 3 — Cross-Branch Write Scoping (Category C) ~3 hrs *(optional)*

**`patients/service.py`** — add helper:

```python
async def assert_patient_in_caller_branch(
    conn, patient_id: int, user: UserIdentity
) -> None:
    if user.role == "Admin":
        return
    row = await conn.fetchrow(
        "SELECT registered_branch_id FROM patient WHERE patient_id = $1",
        patient_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    if row["registered_branch_id"] != user.branch_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify patient from another branch",
        )
```

Call it from every write endpoint in `patients/router.py`:
- `update_patient`
- `add_patient_phone` / `delete_patient_phone`
- `link_guardian` / `unlink_guardian`
- `add_insurance` / `update_insurance`

**`guardians/service.py`** — helper:

```python
async def assert_guardian_shared_with_caller_branch(
    conn, guardian_id: int, user: UserIdentity
) -> None:
    if user.role == "Admin":
        return
    # Allow if guardian is linked to at least one patient in caller's branch
    row = await conn.fetchrow(
        """
        SELECT 1 FROM patient_guardian pg
        JOIN patient p ON p.patient_id = pg.patient_id
        WHERE pg.guardian_id = $1 AND p.registered_branch_id = $2
        LIMIT 1
        """,
        guardian_id, user.branch_id,
    )
    if row is None:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify guardian not linked to your branch",
        )
```

Call it from `guardians/router.py` PATCH and phone endpoints.

---

### Phase 4 — Testing ~2 hrs

Run `backend/scripts/authorization_test.sh` against a running API and database.
The script takes real tokens and record IDs through environment variables so
it does not invent fixture data. It covers:

**Test matrix:**

| # | Scenario | Expected |
|---|---|---|
| T1 | Doctor A tries to complete Doctor B's appointment | 404 |
| T2 | Doctor A lists appointments (should only see own) | Only own rows returned |
| T3 | Doctor A logs treatment on Doctor B's appointment | 404 |
| T4 | Doctor A updates notes on Doctor B's appointment | 404 |
| T5 | Receptionist creates patient with `registered_branch_id=99` | Row saved with `user.branch_id`, not 99 |
| T6 | BM creates staff with `branch_id=99` | Row saved with BM's branch |
| T7 | Receptionist patches patient in another branch | 403 |
| T8 | Receptionist adds phone to other-branch patient | 403 |
| T9 | Receptionist patches guardian linked only to other-branch patient | 403 |
| T10 | Admin patches patient in any branch | 200 |
| T11 | Admin creates patient with explicit `registered_branch_id=2` | Row saved with 2 |

Also verify existing `backend/scripts/integration_test.sh` still passes as a
regression check.

---

## 6. Files to Modify

| File | Changes |
|---|---|
| `app/domains/appointment/service.py` | Add `assert_doctor_owns_appointment`; add doctor WHERE clause in `list_appointments` |
| `app/domains/appointment/router.py` | Call ownership check on GET by id, complete |
| `app/domains/appointment_treatment/service.py` | Add ownership check |
| `app/domains/appointment_treatment/router.py` | Call ownership check on list, log, notes |
| `app/domains/patients/service.py` | Add `assert_patient_in_caller_branch` |
| `app/domains/patients/router.py` | Derive `registered_branch_id`; call branch check on writes |
| `app/domains/patients/schemas.py` | Make `registered_branch_id` optional in `PatientCreate` |
| `app/domains/guardians/service.py` | Add `assert_guardian_shared_with_caller_branch` |
| `app/domains/guardians/router.py` | Call branch check on writes |
| `app/domains/staff/router.py` | Force BM's branch on create_staff |
| `DECISIONS.md` | Add branch-scoping + billing policy entries |
| `backend/scripts/authorization_test.sh` | New test script |

---

## 7. Order of Execution

| # | Task | Blocked by |
|---|---|---|
| 1 | Write `DECISIONS.md` entries (D1 + billing decision) | — |
| 2 | Phase 1 — ownership checks (A1–A6) | — |
| 3 | Manual test A1–A6 via curl | Phase 1 |
| 4 | Phase 2 — branch derivation (B1–B3) | — |
| 5 | Manual test B1–B3 | Phase 2 |
| 6 | Phase 3 — cross-branch writes (C1–C8) | — |
| 7 | Manual test C1–C8 | Phase 3 |
| 8 | Write `authorization_test.sh` covering all | Phases 1–3 |
| 9 | Re-run `integration_test.sh` (regression) | Phases 1–3 |
| 10 | PR review + merge | Step 9 |

**Steps 2, 4, 6 can be done in parallel by different owners if needed** — they touch different files with minimal overlap.

---

## 8. Acceptance Criteria

- [ ] Doctor cannot view, complete, log treatment on, or write notes for another doctor's appointment (all return 404)
- [ ] Doctor's `GET /appointments` returns only their own rows
- [ ] Non-Admin `POST /patients` stores `user.branch_id`, ignoring client-supplied value
- [ ] Non-Admin `POST /appointments` stores `user.branch_id`, ignoring client-supplied value
- [ ] BM `POST /staff` forces `branch_id = user.branch_id`
- [ ] Receptionist `PATCH /patients/{id}` on another branch returns 403
- [ ] Receptionist can still `GET` any patient across branches (SAFE-5 not regressed)
- [ ] Admin can still operate on all branches
- [x] Focused authorization tests pass
- [ ] `authorization_test.sh` passes against a running database
- [ ] Existing integration test still passes
- [x] `AUTHORIZATION_IMPLEMENTATION.md` documents the policy
```

---

## Notes on what I deliberately left out

The audit report also flagged:
- Branch reads being cross-role
- Patient/guardian/doctor **reads** being cross-branch
- QA seeing all audit logs

Those are **not issues** — they're required behavior. Including them would break REQ-PM-2, SAFE-5, and QA's ability to test. I've listed them in §3 as explicitly reviewed and rejected.

If your lecturer specifically asks "why can a receptionist read a Kandy patient from Colombo?", the answer is SAFE-5 and BR-5 (cross-branch emergency care). That's a strong, cited answer.