# CATMS Backend & API Integration Reminder

## 1. Overview & Current Status

A complete backend scan was conducted against the specification in [`app/domains/CATMS_API_Endpoints.md`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/CATMS_API_Endpoints.md).

### Completed Fixes
- [x] **Registered 5 Unmounted Routers in [`app/main.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/main.py):**
  - `branches_router` (`/api/v1/branches`)
  - `patients_router` (`/api/v1/patients`)
  - `guardians_router` (`/api/v1/guardians`)
  - `billing_router` (`/api/v1/invoices`, `/api/v1/payments`, `/api/v1/insurance-claims`)
  - `audit_router` (`/api/v1/audit-logs`)
- [x] **Removed Duplicate Router Import in [`app/main.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/main.py):**
  - Removed duplicate `from app.domains.report.router import router as report_router`.
- [x] **Verified Code Quality:**
  - Ran `uv run ruff check app/main.py` (0 errors).
- [x] **Task 4: Update `user_account.last_login` on Login:**
  - Implemented in [`DatabaseCredentialValidator.authenticate`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/auth/service.py) to atomically execute `UPDATE user_account SET last_login = NOW() WHERE staff_id = $1` in the same transaction as credential verification.
- [x] **Task 5: Return Linked Staff Record in `GET /auth/me`:**
  - Added [`StaffProfile`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/auth/models.py) and [`UserProfile`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/auth/models.py).
  - Updated [`DatabaseCredentialValidator.get_user_profile`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/auth/service.py) and [`GET /auth/me`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/auth/router.py) to query and return linked staff record fields (`first_name`, `last_name`, `job_title`, `email`, `branch_name`, and nested `staff`).
  - Unit tests added in [`tests/test_auth.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/tests/test_auth.py) (all 8 tests passing).

---

## 2. Outstanding Route & Logic TODOs

### High Priority: Missing Endpoints

#### [ ] 1. Appointment Reschedule (`PATCH /appointments/{appointment_id}`)
- **Specification:** Role `Receptionist`. Updates date and time, triggers BR-7 overlap check and records reason.
- **Database Trigger:** [`trg_appointment_overlap_update`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/supabase/migrations/20260918113917_gayan.sql#L104) is already active in Postgres:
  - Raises `unique_violation` on time collision.
  - Raises `check_violation` if appointment is already marked `Completed`.
- **Action Required:**
  1. Add `AppointmentReschedule` schema in [`app/domains/appointment/schemas.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/appointment/schemas.py) with fields: `appointment_date`, `appointment_time`, `reason`.
  2. Implement `reschedule_appointment()` in [`app/domains/appointment/service.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/appointment/service.py) setting date, time, and `cancel_reschedule_reason`.
  3. Add `@router.patch("/appointments/{appointment_id}")` in [`app/domains/appointment/router.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/appointment/router.py) restricted to `Receptionist`.

#### [ ] 2. Appointment Reschedule History (`GET /appointments/{appointment_id}/reschedule-history`)
- **Specification:** Role `Receptionist, Doctor, Admin`.
- **Database Note:** Per migration comments ([`20260918113917_gayan.sql:216`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/supabase/migrations/20260918113917_gayan.sql#L216)), the standalone `appointment_reschedule_log` table was removed from the final ERD.
- **Action Required:**
  - Either query the centralized `audit_log` table for `table_affected = 'appointment'` and `action_type = 'UPDATE'`, OR return the latest reschedule reason from `appointment.cancel_reschedule_reason`.

---

### Medium Priority: Authentication & Envelope Alignment

#### [ ] 3. Standard Response Envelope on Auth Routes
- **Specification:** All endpoints should follow `{ "data": ..., "error": null }`.
- **Current Status:**
  - `POST /auth/login` returns `LoginResponse` directly without `{ "data": ... }`.
  - `POST /auth/refresh` returns `LoginResponse` directly without `{ "data": ... }`.
  - `GET /auth/me` returns `UserIdentity` directly without `{ "data": ... }`.
  - `POST /auth/logout` returns `204 No Content` without JSON body.
- **Action Required:**
  - Align with frontend expectations in `frontend/src/services/api/auth.ts` or wrap auth endpoints with standard envelope helper `_success(...)`.

#### [x] 4. Update `user_account.last_login` on Login
- **Specification:** *"login updates `user_account.last_login` — do this as part of the same query/transaction that verifies the password hash, not a separate round trip."*
- **Current Status:** Completed. [`DatabaseCredentialValidator.authenticate`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/auth/service.py) executes `UPDATE user_account SET last_login = NOW() WHERE staff_id = $1` in the same transaction as credential verification.
- **Action Required:**
  - Update `user_account.last_login = NOW()` in `authenticate()` after validating password hash.

#### [x] 5. Return Linked Staff Record in `GET /auth/me`
- **Specification:** *"current user's profile + role + linked staff record"*.
- **Current Status:** Completed. Added [`StaffProfile`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/auth/models.py) and [`UserProfile`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/auth/models.py). [`GET /auth/me`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/auth/router.py) queries and returns staff profile details (`first_name`, `last_name`, `job_title`, `email`, `branch_name`, and nested `staff`).
- **Action Required:**
  - Query and return staff profile details (`first_name`, `last_name`, `job_title`, `email`, `branch_name`) in `GET /auth/me`.

---

### Audit Attribution Context (`app.current_staff_id`)

Database audit triggers ([`trg_audit_patient`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/supabase/migrations/20260918204343_arun.sql#L283), `trg_audit_appointment_treatment`, `trg_audit_invoice`) require session variable `app.current_staff_id` to be populated via `with_transaction(staff_id=...)`.

- [x] Correctly configured:
  - Patient creations/updates: [`patients/service.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/patients/service.py)
  - Invoice finalization & payments: [`billing/router.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/billing/router.py)
  - Treatments logging & amending: [`appointment_treatment/router.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/appointment_treatment/router.py)
  - Appointment completion: [`appointment/router.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/appointment/router.py)
- [ ] Needs transaction context wrapping:
  - [ ] `create_branch` and `patch_branch` in [`branches/router.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/branches/router.py)
  - [ ] `create_appointment` and `cancel_appointment` in [`appointment/router.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/domains/appointment/router.py)

---

## 3. Frontend-Backend Contract Alignment

Ensure frontend and backend agree on the following conventions:

1. **Token Field Naming:**
   - Backend returns `access_token` (snake_case).
   - Frontend API client may expect `accessToken` (camelCase) or `access_token`. Confirm alignment in `frontend/src/types/auth.ts`.
2. **Cookie Handling:**
   - Refresh token is stored in an `HttpOnly` cookie (`catms_refresh_token`).
   - Frontend fetch calls must include `credentials: 'include'`.
3. **Error Payload Structure:**
   - Global handler in [`app/core/exceptions.py`](file:///C:/Users/gthar/OneDrive/Documents/Uni_Tutes/Projects/DB/MedSync/backend/app/core/exceptions.py) formats all errors as:
     ```json
     {
       "data": null,
       "error": {
         "code": "unique_violation",
         "message": "..."
       }
     }
     ```
   - For duplicate patient NIC, response includes structured `patient_id`:
     ```json
     {
       "data": null,
       "error": {
         "code": "patient_already_registered",
         "message": "...",
         "patient_id": 12
       }
     }
     ```

---

## 4. Verification & Testing Commands

### Backend Validation
```powershell
# In backend directory
cd backend

# Run Ruff linter
uv run ruff check .

# Run pytest (requires running PostgreSQL instance)
uv run pytest
```

### Frontend Validation
```powershell
# In frontend directory
cd frontend

# Build frontend to check for type and API contract errors
npm run build
```
