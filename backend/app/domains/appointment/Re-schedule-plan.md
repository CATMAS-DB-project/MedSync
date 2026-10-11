# Appointment Rescheduling Implementation Plan: Transition Chain Architecture

**Document Version:** 1.0.0  
**Target Domain:** `backend/app/domains/appointment/`  
**Related Migrations:** 
- `supabase/migrations/20260916171524_kavinda.sql`
- `supabase/migrations/20260918113917_gayan.sql`  
**Related Report Issues:** `report.MD` Issue 8 (`PATCH /appointments/{id}`) & Issue 9 (`GET /appointments/{id}/reschedule-history`)

---

## 1. Architectural Evaluation: Transition Chain vs. In-Place Update

### 1.1 The Proposed Solution
The proposed approach introduces an **immutable transition chain**:
1. Retrieve the existing appointment (`status = 'Scheduled'`).
2. Mark the existing appointment as `'Re-Scheduled'` (using the existing PostgreSQL enum `appointment_status_enum`).
3. Stamp a descriptive reason/reference in `cancel_reschedule_reason`.
4. Atomically insert a brand-new appointment with `status = 'Scheduled'` carrying the new date, new time, same patient, same doctor, and appropriate branch context.

### 1.2 Evaluation & Comparison

| Aspect | In-Place Update (`UPDATE appointment SET date=...`) | Transition Chain (User's Proposal: Old $\rightarrow$ `Re-Scheduled`, New $\rightarrow$ `Scheduled`) | Verdict |
|---|---|---|---|
| **Auditability & History** | ⚠️ Overwrites date/time on the row. Historical schedule is lost unless reconstructed from JSON diffs in `audit_log`. | ✅ **Superior**: Preserves the original booking row permanently. The complete scheduling lifecycle is queryable as distinct entities. | **Transition Chain Wins** |
| **Enum Utilization** | ⚠️ Ignores the `'Re-Scheduled'` enum value defined in `20260916171524_kavinda.sql`. | ✅ **Leverages existing schema**: Directly utilizes `appointment_status_enum.Re-Scheduled`. | **Transition Chain Wins** |
| **Database Constraints & Slot Locking** | ✅ Already supported by `uq_appointment_doctor_active_slot` and `fn_appointment_overlap_update()`. | 🔴 **Critical Schema Trap**: Current partial index `WHERE status != 'Cancelled'` treats `'Re-Scheduled'` as active! *(Requires index & trigger adjustment)*. | **Requires Schema Adjustment (Details below)** |
| **Invoices & Treatments** | ✅ FK `appointment_id` remains constant. | ✅ Safe because only `Completed` visits link to invoices and treatments. A rescheduled visit is still pending. | **Tie** |
| **Client / UI Contract** | Returns updated row with identical `appointment_id`. | Returns newly created appointment row (`new_appointment_id`). Frontend must adopt the new ID. | **Manageable with clear API contract** |

### 1.3 Critical Database Findings & Trap Detection

In `supabase/migrations/20260918113917_gayan.sql`, slot concurrency is guarded by:
```sql
CREATE UNIQUE INDEX uq_appointment_doctor_active_slot
    ON appointment (doctor_staff_id, appointment_date, appointment_time)
    WHERE status != 'Cancelled';
```
And trigger `fn_appointment_overlap_insert()` checks:
```sql
IF NEW.status != 'Cancelled' THEN
    IF EXISTS (
        SELECT 1 FROM appointment
        WHERE doctor_staff_id = NEW.doctor_staff_id
          AND appointment_date = NEW.appointment_date
          AND appointment_time = NEW.appointment_time
          AND status != 'Cancelled'
    ) THEN
        RAISE EXCEPTION ...
```

#### ⚠️ The Slot Lock Problem:
Because the database checks `WHERE status != 'Cancelled'`, any row with `status = 'Re-Scheduled'` is **still considered an active booking** by PostgreSQL.
If appointment #10 at 09:00 AM is updated to `status = 'Re-Scheduled'`, that 09:00 AM slot is **not released**! No other patient could ever book that slot because the unique index and trigger would block it.

#### 💡 The Solution:
We provide two implementation paths:
1. **Primary Path (Recommended):** Apply a lightweight migration to update the partial index, triggers, and availability query so that `status NOT IN ('Cancelled', 'Re-Scheduled')` defines an active slot.
2. **Zero-Migration Fallback Path:** If database migrations cannot be applied to PostgreSQL immediately, the service sets `status = 'Cancelled'` on the old row with `cancel_reschedule_reason = 'Re-scheduled to [YYYY-MM-DD HH:MM]: [reason]'` and creates the new appointment.

---

## 2. Database Schema Adjustments (Primary Path)

To fully enable `'Re-Scheduled'` as a released historical status, the following migration must be applied:

```sql
-- Migration: 20261010_support_rescheduled_status.sql

-- 1. Drop and recreate the partial unique index to exclude both Cancelled and Re-Scheduled
DROP INDEX IF EXISTS uq_appointment_doctor_active_slot;
CREATE UNIQUE INDEX uq_appointment_doctor_active_slot
    ON appointment (doctor_staff_id, appointment_date, appointment_time)
    WHERE status NOT IN ('Cancelled', 'Re-Scheduled');

-- 2. Update insert overlap trigger to release Re-Scheduled slots
CREATE OR REPLACE FUNCTION fn_appointment_overlap_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status NOT IN ('Cancelled', 'Re-Scheduled') THEN
        IF EXISTS (
            SELECT 1 FROM appointment
            WHERE doctor_staff_id = NEW.doctor_staff_id
              AND appointment_date = NEW.appointment_date
              AND appointment_time = NEW.appointment_time
              AND status NOT IN ('Cancelled', 'Re-Scheduled')
        ) THEN
            RAISE EXCEPTION
                'Doctor % already has an appointment at % on %',
                NEW.doctor_staff_id, NEW.appointment_time, NEW.appointment_date
                USING ERRCODE = 'unique_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Update update overlap trigger
CREATE OR REPLACE FUNCTION fn_appointment_overlap_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.appointment_date = OLD.appointment_date
       AND NEW.appointment_time = OLD.appointment_time
       AND NEW.doctor_staff_id = OLD.doctor_staff_id THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'Completed' THEN
        RAISE EXCEPTION
            'Cannot reschedule appointment % — it is already Completed',
            OLD.appointment_id
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.status NOT IN ('Cancelled', 'Re-Scheduled') THEN
        IF EXISTS (
            SELECT 1 FROM appointment
            WHERE doctor_staff_id = NEW.doctor_staff_id
              AND appointment_date = NEW.appointment_date
              AND appointment_time = NEW.appointment_time
              AND status NOT IN ('Cancelled', 'Re-Scheduled')
              AND appointment_id != NEW.appointment_id
        ) THEN
            RAISE EXCEPTION
                'Doctor % already has an appointment at % on %',
                NEW.doctor_staff_id, NEW.appointment_time, NEW.appointment_date
                USING ERRCODE = 'unique_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
```

---

## 3. API Contract Specification

### 3.1 Endpoint Overview
- **Method:** `PATCH`
- **Route:** `/api/v1/appointments/{appointment_id}`
- **Authentication:** Bearer JWT required.
- **Allowed Roles (RBAC):** `Receptionist`
- **Audit Attribution:** Session variable `app.current_staff_id` must be set via `with_transaction(staff_id=user.staff_id)`.

### 3.2 Security & Ownership Rules
1. **Branch Scoping:** The authenticated Receptionist must belong to an active branch (`user.branch_id IS NOT NULL`).
2. **Doctor Scoping:** The appointment's doctor must belong to the Receptionist's branch (`doctor_branch == user.branch_id`).
3. **State Precondition:** The existing appointment **must be** in status `'Scheduled'`. Rescheduling an appointment that is already `'Completed'`, `'Cancelled'`, or `'Re-Scheduled'` is rejected with `409 Conflict`.
4. **Temporal Validation:** The new appointment date and time must not be in the past (`appointment_date >= CURRENT_DATE`).

### 3.3 Request Schema

```json
{
  "appointment_date": "2026-10-15",
  "appointment_time": "10:30:00",
  "reason": "Patient requested morning slot due to work conflict"
}
```

#### Field Specifications:
- `appointment_date` (`string`, format `YYYY-MM-DD`, required): Target visit date. Must be today or future.
- `appointment_time` (`string`, format `HH:MM` or `HH:MM:SS`, required): Target slot time.
- `reason` (`string`, 1–255 characters, required): Reason for the reschedule. Trimmed of whitespace.

### 3.4 Response Schema (Envelope Format)

```json
{
  "data": {
    "appointment_id": 142,
    "patient_id": 18,
    "patient_name": "Kamal Perera",
    "doctor_staff_id": 4,
    "doctor_name": "Dr. Sunil Fernando",
    "branch_id": 1,
    "branch_name": "Colombo Central",
    "booked_by_staff_id": 2,
    "appointment_date": "2026-10-15",
    "appointment_time": "10:30:00",
    "status": "Scheduled",
    "is_walk_in": false,
    "cancel_reschedule_reason": "Rescheduled from visit #120: Patient requested morning slot due to work conflict",
    "consultation_notes": null,
    "created_at": "2026-10-10T17:05:00Z",
    "invoice_id": null,
    "previous_appointment_id": 120
  },
  "error": null
}
```

### 3.5 Error Codes

| Status Code | Code String | Scenario |
|---|---|---|
| `400 Bad Request` | `check_violation` | Validation failure or business rule violation. |
| `401 Unauthorized`| `http_401` | Missing or invalid JWT access token. |
| `403 Forbidden`   | `http_403` | User is not a Receptionist, or receptionist is unassigned to branch. |
| `404 Not Found`   | `http_404` | Appointment ID does not exist. |
| `409 Conflict`    | `http_409` | Appointment is already Completed/Cancelled, OR slot conflict on doctor's calendar (`unique_violation`). |
| `422 Unprocessable` | `validation_error` | Past date provided, empty reason, or malformed time format. |

---

## 4. Backend Implementation Plan

### 4.1 Schema Definition (`backend/app/domains/appointment/schemas.py`)

Add the following Pydantic models:

```python
from datetime import date, time
from typing import Annotated, Literal
from pydantic import BaseModel, Field, field_validator

AppointmentStatus = Literal["Scheduled", "Completed", "Cancelled", "Re-Scheduled"]

class AppointmentReschedule(BaseModel):
    appointment_date: date
    appointment_time: time
    reason: str = Field(min_length=1, max_length=255)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("reason must not be blank")
        return value

    @field_validator("appointment_date")
    @classmethod
    def validate_not_past(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("appointment_date cannot be in the past")
        return value
```

### 4.2 Service Layer Implementation (`backend/app/domains/appointment/service.py`)

Implement the atomic transition function `reschedule_appointment`:

```python
async def reschedule_appointment(
    conn: PoolConnectionProxy,
    appointment_id: int,
    body: AppointmentReschedule,
    staff_id: int,
    branch_id: int,
) -> dict | None:
    """
    Executes the Transition Chain reschedule:
    1. Locks the existing appointment row.
    2. Validates status is 'Scheduled' and branch ownership matches.
    3. Marks the existing row as 'Re-Scheduled'.
    4. Inserts a new appointment row with 'Scheduled' status.
    5. Returns the newly created appointment detail view row.
    """
    # 1. Fetch and lock existing appointment
    old = await conn.fetchrow(
        """
        SELECT appointment_id, patient_id, doctor_staff_id, branch_id,
               status, is_walk_in, consultation_notes
        FROM appointment
        WHERE appointment_id = $1
        FOR UPDATE
        """,
        appointment_id,
    )
    if not old:
        return None

    if old["status"] != "Scheduled":
        raise ValueError(
            f"Cannot reschedule appointment with status '{old['status']}'. "
            "Only 'Scheduled' appointments can be rescheduled."
        )

    # 2. Verify doctor branch matches receptionist branch
    doctor_branch = await conn.fetchval(
        "SELECT s.branch_id FROM doctor d JOIN staff s ON s.staff_id = d.staff_id "
        "WHERE d.staff_id = $1",
        old["doctor_staff_id"],
    )
    if doctor_branch != branch_id:
        raise ValueError("Doctor must belong to your branch")

    # 3. Mark the old appointment as Re-Scheduled
    old_reason = f"Rescheduled to {body.appointment_date} {body.appointment_time.strftime('%H:%M')}: {body.reason}"
    await conn.execute(
        """
        UPDATE appointment
        SET status = 'Re-Scheduled',
            cancel_reschedule_reason = $2
        WHERE appointment_id = $1
        """,
        appointment_id,
        old_reason,
    )

    # 4. Insert the new appointment row
    new_reason = f"Rescheduled from visit #{appointment_id}: {body.reason}"
    new_row = await conn.fetchrow(
        """
        INSERT INTO appointment (
            patient_id, doctor_staff_id, branch_id, booked_by_staff_id,
            appointment_date, appointment_time, is_walk_in,
            status, cancel_reschedule_reason, consultation_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Scheduled', $8, $9)
        RETURNING appointment_id
        """,
        old["patient_id"],
        old["doctor_staff_id"],
        branch_id,
        staff_id,
        body.appointment_date,
        body.appointment_time,
        old["is_walk_in"],
        new_reason,
        old["consultation_notes"],
    )

    # 5. Fetch hydrated view of the newly created appointment
    new_appointment = await get_appointment(conn, new_row["appointment_id"])
    assert new_appointment is not None
    new_appointment["previous_appointment_id"] = appointment_id
    return new_appointment
```

### 4.3 Availability Slot Query Update (`backend/app/domains/appointment/service.py`)

Ensure availability queries ignore both `'Cancelled'` and `'Re-Scheduled'` rows:

```python
async def list_availability(
    conn: PoolConnectionProxy,
    *,
    doctor_id: int,
    appointment_date: date,
    opening_time: time,
    closing_time: time,
    slot_minutes: int,
) -> list[dict] | None:
    rows = await conn.fetch(
        """
        SELECT d.staff_id, a.appointment_time
        FROM doctor d
        LEFT JOIN appointment a
          ON a.doctor_staff_id = d.staff_id
         AND a.appointment_date = $2
         AND a.status NOT IN ('Cancelled', 'Re-Scheduled')
        WHERE d.staff_id = $1
        ORDER BY a.appointment_time
        """,
        doctor_id,
        appointment_date,
    )
    ...
```

### 4.4 Router Endpoint Registration (`backend/app/domains/appointment/router.py`)

Add the `@router.patch("/{appointment_id}")` endpoint wrapped with transaction audit context:

```python
from app.domains.appointment.schemas import AppointmentReschedule

@router.patch("/appointments/{appointment_id}")
async def reschedule_appointment_endpoint(
    appointment_id: int,
    body: AppointmentReschedule,
    user: Annotated[UserIdentity, Depends(require_role("Receptionist"))],
) -> dict:
    if user.branch_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated user is not assigned to a branch",
        )

    async with with_transaction(staff_id=user.staff_id) as conn:
        try:
            data = await service.reschedule_appointment(
                conn,
                appointment_id,
                body,
                staff_id=user.staff_id,
                branch_id=user.branch_id,
            )
        except ValueError as exc:
            # Check for conflict conditions
            if "status" in str(exc).lower():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled appointment not found",
        )

    return {"data": data, "error": None}
```

---

## 5. Reschedule History Strategy (Resolving Issue 9)

### 5.1 The Requirement
The specification defines `GET /appointments/{appointment_id}/reschedule-history`.

### 5.2 Implementation Strategy
Because each reschedule links the previous visit via `cancel_reschedule_reason` and records a mutation in `audit_log`, history can be retrieved in one of two ways:

#### Option A: Query Centralized Audit Logs (Recommended)
Query the existing `audit_log` table:
```sql
SELECT log_id, staff_id, action_type, log_timestamp, details
FROM audit_log
WHERE table_affected = 'appointment'
  AND record_id_affected = $1::text
ORDER BY log_timestamp DESC;
```

#### Option B: Follow the Appointment Chain Query
Query backwards and forwards across the chain:
```python
@router.get("/appointments/{appointment_id}/reschedule-history")
async def get_reschedule_history(
    appointment_id: int,
    conn: Annotated[PoolConnectionProxy, Depends(get_conn)],
    _user: Annotated[UserIdentity, Depends(require_role("Receptionist", "Doctor", "Admin"))],
) -> dict:
    rows = await conn.fetch(
        """
        SELECT a.appointment_id, a.appointment_date, a.appointment_time,
               a.status, a.cancel_reschedule_reason, a.created_at,
               s.first_name || ' ' || s.last_name AS booked_by_name
        FROM appointment a
        JOIN staff s ON s.staff_id = a.booked_by_staff_id
        WHERE a.cancel_reschedule_reason ILIKE '%' || $1 || '%'
           OR a.appointment_id = $1
        ORDER BY a.created_at ASC
        """,
        appointment_id,
    )
    return {"data": [dict(r) for r in rows], "error": None}
```

---

## 6. Frontend Integration & Contract Alignment

### 6.1 Type System Updates (`frontend/src/types/appointment.ts`)

Update the TypeScript union to include `'Re-Scheduled'`:

```typescript
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Re-Scheduled';

export interface Appointment {
  appointmentId: number;
  patientId: number;
  patientName?: string;
  doctorStaffId: number;
  doctorName?: string;
  branchId: number;
  branchName?: string;
  bookedByStaffId: number;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  isWalkIn: boolean;
  cancelRescheduleReason?: string;
  consultationNotes?: string;
  createdAt: string;
  previousAppointmentId?: number;
}
```

### 6.2 Status Badge Styling (`frontend/src/features/appointments/statusStyles.ts`)

```typescript
export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  Scheduled: 'primary',
  Completed: 'success',
  Cancelled: 'error',
  'Re-Scheduled': 'secondary',
};
```

### 6.3 Service Client Alignment (`frontend/src/services/api/appointments.ts`)

```typescript
export async function rescheduleAppointment(
  appointmentId: number,
  input: {
    appointmentDate: string;
    appointmentTime: string;
    reason: string;
  },
): Promise<Appointment> {
  return apiPatch<Appointment>(`/appointments/${appointmentId}`, input);
}
```

---

## 7. Edge Cases & Validation Matrix

| # | Edge Case | Expected System Behavior |
|---|---|---|
| 1 | Target time slot is already booked for that doctor | `unique_violation` captured by global exception handler $\rightarrow$ returns structured `409 Conflict`. |
| 2 | Rescheduling an appointment that is already `Completed` | Service throws `ValueError` $\rightarrow$ returns `409 Conflict` ("Cannot reschedule appointment... already Completed"). |
| 3 | Rescheduling an appointment that is `Cancelled` or `Re-Scheduled` | Service throws `ValueError` $\rightarrow$ returns `409 Conflict`. |
| 4 | Receptionist attempts to reschedule an appointment for a doctor in another branch | Service validates doctor's branch $\rightarrow$ returns `422 Unprocessable Entity` ("Doctor must belong to your branch"). |
| 5 | Target date is in the past | Pydantic validation fails $\rightarrow$ returns `422 Unprocessable Content`. |
| 6 | Blank or whitespace-only reason string | Pydantic validator `normalize_reason` fails $\rightarrow$ returns `422 Unprocessable Content`. |
| 7 | Doctor availability lookup on date where previous visit was rescheduled | Slot where visit was marked `Re-Scheduled` is rendered as `available: true` for other patients. |

---

## 8. Verification & Test Plan

### 8.1 Automated Unit/Integration Tests (`backend/tests/test_appointment.py`)

1. `test_reschedule_success_creates_chain()`:
   - Create initial appointment #1.
   - Reschedule to tomorrow 14:00.
   - Verify appointment #1 status is `'Re-Scheduled'`.
   - Verify new appointment #2 status is `'Scheduled'`.
   - Verify old slot is free in `list_availability()`.
2. `test_reschedule_slot_collision_returns_409()`:
   - Create appointment #1 (Doctor A, Day X, 09:00).
   - Create appointment #2 (Doctor A, Day X, 10:00).
   - Attempt to reschedule #2 to 09:00 $\rightarrow$ assert `HTTP 409 Conflict`.
3. `test_cannot_reschedule_completed_or_cancelled()`:
   - Mark appointment #1 as `Completed`.
   - Attempt reschedule $\rightarrow$ assert `HTTP 409 Conflict`.

### 8.2 End-to-End Manual Verification (cURL / HTTP Client)

```bash
# 1. Reschedule Appointment #1
curl -X PATCH http://localhost:8000/api/v1/appointments/1 \
  -H "Authorization: Bearer <RECEPTIONIST_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_date": "2026-10-15",
    "appointment_time": "11:00:00",
    "reason": "Doctor rescheduled clinic hours"
  }'

# Expected Response:
# 200 OK -> { "data": { "appointment_id": 2, "status": "Scheduled", ... }, "error": null }

# 2. Verify Old Appointment Status
curl -X GET http://localhost:8000/api/v1/appointments/1 \
  -H "Authorization: Bearer <RECEPTIONIST_JWT>"

# Expected Response:
# 200 OK -> { "data": { "appointment_id": 1, "status": "Re-Scheduled", ... }, "error": null }
```

---

*Plan complete and ready for execution.*
