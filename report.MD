# MedSync API & Type Contract Comparison Report

**Generated:** October 2026  
**Scope:**
- **Frontend API Services:** `frontend/src/services/api/`
- **Frontend Type Definitions:** `frontend/src/types/`
- **Backend API Domains & Routers:** `backend/app/domains/`
- **Backend Core & Specifications:** `backend/app/core/`, `backend/app/domains/CATMS_API_Endpoints.md`

---

## 1. Executive Summary

A comprehensive architectural and contract audit was performed comparing the **MedSync** frontend client application with the **CATMS** FastAPI backend service. 

### Key Findings
1. **Resolved Endpoints:**
   - ✅ `PATCH /api/v1/appointments/{appointment_id}` (Rescheduling): **RESOLVED** via Transition Chain architecture (`AppointmentReschedule`, atomic update of old row to `'Re-Scheduled'` + insert of new `'Scheduled'` appointment).
   - ✅ `GET /api/v1/appointments/{appointment_id}/reschedule-history`: **RESOLVED** via chronological chain history query.
2. **Remaining Missing Backend Endpoints:**
   - `GET /api/v1/staff/{staff_id}/account` (User Account Detail): Called by frontend `fetchUserAccount()`, service function exists but route is not exposed in `staff/router.py`.
3. **Critical Return Shape & Pagination Mismatches:**
   - `GET /api/v1/audit-logs`: Frontend `fetchAuditLogs()` expects an unpaginated array (`AuditLog[]`), but backend returns a paginated envelope (`PagedResult`). Furthermore, field names are mismatched (`log_timestamp` vs `createdAt`, `record_id_affected` vs `recordId`), forcing UI components to use ugly `any`/`unknown` casting workarounds.
   - `GET /api/v1/doctors`: Frontend `doctor.ts` claims to return full `Doctor[]`, but the endpoint returns a specialized booking dropdown shape (`DoctorOption[]`) without `yearsOfExperience`, `qualifications`, or nested `Specialty` objects.
3. **Type & Property Name Inconsistencies:**
   - In `UserAccount`, backend returns `role_name` (`roleName`), but frontend expects `role`.
   - In `AppointmentTreatment`, frontend parameter interfaces enforce snake_case (`service_code`, `amendment_reason`) rather than standard camelCase (`serviceCode`, `amendmentReason`).
   - In `StaffRecord`, frontend models full nested `doctor?: Doctor` and `userAccount?: UserAccount`, while backend `GET /staff/{id}` only returns boolean flags (`is_doctor`, `has_account`).
   - In `POST /staff/{id}/doctor/specialties`, frontend expects `Specialty` (`{ specialtyId, specialtyName }`), but backend only returns `{ staff_id, specialty_id }`.
4. **Endpoint Parameter & Role Contract Mismatches:**
   - In `GET /reports/outstanding-balances`, backend strictly requires `patient_id` when called by a Receptionist, but frontend `fetchOutstandingBalances` typing excludes `patientId`, making receptionist access throw an unrecoverable `422 Unprocessable Entity`.
   - In `GET /reports/treatment-frequency`, frontend typing omits `branchId`, preventing branch-filtered queries by managers and admins.
   - In `GET /insurance-claims`, frontend lacks a filter parameter for `invoiceId`, forcing the billing drawer to fetch a page of 100 claims and filter client-side.
5. **Envelope & Infrastructure Inconsistencies:**
   - All backend routers wrap success responses in `{"data": ..., "error": null}` except for `auth/router.py`, which returns bare Pydantic models (`LoginResponse`, `UserProfile`). While the Axios interceptor handles both, this violates the uniform envelope standard.
   - Five complete PDF report generation endpoints (`/reports/pdf/*`) exist on the backend with ReportLab builders, but the frontend has zero service wrappers for them (relying solely on client-side CSV downloads).

---

## 2. Global Architecture & Convention Alignment

### 2.1 Base URL & Routing
- **Base URL:** Frontend defaults to `/api/v1` via `API_BASE_URL` (`frontend/src/constants/api.ts`).
- **Backend Prefix:** `backend/app/main.py` mounts all routers under prefix `/api/v1`.
- **Verdict:** Fully aligned.

### 2.2 Payload Casing & Transformers
- **Mechanism:** `frontend/src/services/api/transformers.ts` uses Axios interceptors to automatically convert:
  - Request body keys: `camelCase` $\rightarrow$ `snake_case`
  - Query parameter keys: `camelCase` $\rightarrow$ `snake_case`
  - Response body keys: `snake_case` $\rightarrow$ `camelCase`
- **Caveat:** Pydantic schemas configured with `extra = "forbid"` will reject unexpected parameters. Any mismatch in expected property names after transformation triggers a 422 validation failure.

### 2.3 Response Enveloping
- **Specification Standard (`CATMS_API_Endpoints.md`):**
  - Success: `{ "data": <payload>, "error": null }`
  - Error: `{ "data": null, "error": { "code": "<str>", "message": "<str>", ... } }`
- **Current State:**
  - Standard routers (`branches`, `reference`, `treatment_catalogue`, `staff`, `patients`, `guardians`, `appointment`, `appointment_treatment`, `billing`, `report`, `audit`) wrap responses using `_success(...)`.
  - **Exception:** `auth/router.py` returns bare JSON models (`LoginResponse`, `UserProfile`).
  - **Exception:** `report_pdf/router.py` returns binary `StreamingResponse` (appropriate for PDF downloads).
- **Client Handling:** `frontend/src/services/api/client.ts` contains `isEnvelope()` detection. If an envelope is found, it extracts `body.data`; otherwise it leaves `body` intact. While resilient, unifying backend auth responses into standard envelopes improves contract purity.

### 2.4 Pagination
- **Shared Backend Schema:**
  ```json
  { "items": [...], "total": 100, "page": 1, "page_size": 25 }
  ```
- **Shared Frontend Schema (`PagedResult<T>`):**
  ```typescript
  export interface PagedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
  }
  ```
  *(Transformed from `page_size` $\rightarrow$ `pageSize`)*.
- **Verdict:** Standardized, but broken in `auditLogs.ts` where frontend expected a bare array.

---

## 3. Comprehensive Endpoint & Type Mapping Matrix

The following table provides an exhaustive side-by-side comparison of every endpoint in the MedSync / CATMS ecosystem.

| # | HTTP Method | Endpoint Path | Backend Router & Handler | Frontend Service Function | Request Body / Params Mismatch | Response / Type Mismatch | Issue Severity & Summary |
|---|---|---|---|---|---|---|---|
| **Auth** | | | | | | | |
| 1 | `POST` | `/auth/login` | `auth/router.py`: `login` | `auth.ts`: `login` | Aligned (`LoginCredentials`) | Backend does not wrap in `{data, error}` envelope. | 🟡 Low: Works via client unwrapper heuristic, but violates envelope standard. |
| 2 | `POST` | `/auth/refresh` | `auth/router.py`: `refresh` | `client.ts`: `requestNewAccessToken` | Cookie `catms_refresh_token` used. | Backend does not wrap in envelope. | 🟡 Low: Bare model returned. |
| 3 | `POST` | `/auth/logout` | `auth/router.py`: `logout` | `auth.ts`: `logout` | None. Returns 204. | None. | 🟢 Aligned. |
| 4 | `GET` | `/auth/me` | `auth/router.py`: `me` | `auth.ts`: `fetchCurrentUser` | None. | Frontend `AuthUser` types only 4 fields; frontend makes redundant call to `/staff/{id}` to get names. | 🟠 Medium: Backend already returns `first_name`, `last_name`, `branch_name`, `job_title`. |
| **Branches** | | | | | | | |
| 5 | `GET` | `/branches` | `branches/router.py`: `list_branches` | `branches.ts`: `fetchBranches` | Query: `page`, `page_size`. | Aligned (`PagedResult<Branch>`). | 🟢 Aligned. (Note: Small reference table, paginated by default). |
| 6 | `POST` | `/branches` | `branches/router.py`: `create_branch` | `branches.ts`: `createBranch` | Aligned (`BranchCreate`). | Aligned (`Branch`). | 🟡 Medium: Missing `with_transaction(staff_id=...)` for audit attribution. |
| 7 | `GET` | `/branches/{id}` | `branches/router.py`: `get_branch` | `branches.ts`: `fetchBranchById` | Path `branch_id`. | Aligned (`Branch`). | 🟢 Aligned. |
| 8 | `PATCH` | `/branches/{id}` | `branches/router.py`: `patch_branch` | `branches.ts`: `updateBranch` | Aligned (`BranchUpdate`). | Aligned (`Branch`). | 🟡 Medium: Missing `with_transaction(staff_id=...)` for audit attribution. |
| **Reference** | | | | | | | |
| 9 | `GET` | `/roles` | `reference/router.py`: `list_roles` | `roles.ts`: `fetchRoles` | Query: `page`, `page_size`. | Aligned (`PagedResult<RoleOption>`). | 🟡 Medium: Backend enforces `require_role("Admin")`. Non-admin screens cannot query roles. |
| 10 | `GET` | `/specialties` | `reference/router.py`: `list_specialties` | `specialties.ts`: `fetchSpecialties` | Query: `page`, `page_size`. | Aligned (`PagedResult<Specialty>`). | 🟢 Aligned. |
| 11 | `POST` | `/specialties` | `reference/router.py`: `create_specialty` | `specialties.ts`: `createSpecialty` | Aligned (`SpecialtyCreate`). | Aligned (`Specialty`). | 🟢 Aligned. |
| 12 | `PATCH` | `/specialties/{id}`| `reference/router.py`: `rename_specialty` | `specialties.ts`: `updateSpecialty` | Aligned (`SpecialtyUpdate`). | Aligned (`Specialty`). | 🟢 Aligned. |
| **Treatments** | | | | | | | |
| 13 | `GET` | `/treatments` | `treatment_catalogue/router.py`: `list_treatments` | `treatments.ts`: `fetchTreatments` | Query: `category`, `page`, `page_size`. | Aligned (`PagedResult<TreatmentCatalogueItem>`). | 🟢 Aligned. |
| 14 | `POST` | `/treatments` | `treatment_catalogue/router.py`: `create_treatment` | `treatments.ts`: `createTreatment` | Aligned (`TreatmentCreate`). | Aligned (`TreatmentCatalogueItem`). | 🟢 Aligned. |
| 15 | `GET` | `/treatments/{code}`| `treatment_catalogue/router.py`: `get_treatment` | `treatments.ts`: `fetchTreatmentByCode` | Path `service_code`. | Aligned (`TreatmentCatalogueItem`). | 🟢 Aligned. |
| 16 | `PATCH` | `/treatments/{code}`| `treatment_catalogue/router.py`: `update_treatment` | `treatments.ts`: `updateTreatment` | Aligned (`TreatmentUpdate`). | Aligned (`TreatmentCatalogueItem`). | 🟢 Aligned. |
| **Staff & Doctors** | | | | | | | |
| 17 | `GET` | `/staff` | `staff/router.py`: `list_staff` | `staff.ts`: `fetchStaff` | Query: `branch_id`, `job_title`, `employment_status`, `search`, paging. | Aligned (`PagedResult<Staff>`). | 🟡 Low: `list_staff` does not return `phones` array; table in `StaffPage.tsx` shows blank phone. |
| 18 | `POST` | `/staff` | `staff/router.py`: `create_staff` | `staff.ts`: `createStaff` | Aligned (`StaffCreate`). | Aligned (`Staff`). | 🟢 Aligned. |
| 19 | `GET` | `/staff/{id}` | `staff/router.py`: `get_staff` | `staff.ts`: `fetchStaffById` | Path `staff_id`. | Backend returns `is_doctor` & `has_account` booleans, NOT nested `Doctor` or `UserAccount` objects. | 🟠 Medium: Frontend `StaffRecord` interface assumes nested objects exist. |
| 20 | `PATCH` | `/staff/{id}` | `staff/router.py`: `update_staff` | `staff.ts`: `updateStaff` | Aligned (`StaffUpdate`). | Aligned (`Staff`). | 🟢 Aligned. |
| 21 | `GET` | `/staff/{id}/phones`| `staff/router.py`: `list_phones` | `staffPhones.ts`: `fetchStaffPhones` | Path `staff_id`. | Aligned (`Phone[]`). | 🟢 Aligned. |
| 22 | `POST` | `/staff/{id}/phones`| `staff/router.py`: `add_phone` | `staffPhones.ts`: `addStaffPhone` | Aligned (`PhoneCreate`). | Aligned (`Phone`). | 🟢 Aligned. |
| 23 | `DELETE`| `/staff/{id}/phones/{pid}`| `staff/router.py`: `delete_phone` | `staffPhones.ts`: `deleteStaffPhone` | Path params. Returns 204. | None. | 🟢 Aligned. |
| 24 | `POST` | `/staff/{id}/doctor`| `staff/router.py`: `promote_to_doctor` | `doctor.ts`: `promoteStaffToDoctor` | Aligned (`DoctorPromote`). | Aligned (`Doctor`). | 🟢 Aligned. |
| 25 | `GET` | `/staff/{id}/doctor`| `staff/router.py`: `get_doctor` | `doctor.ts`: `fetchDoctorByStaffId` | Path `staff_id`. | Aligned (`Doctor` with specialties object array). | 🟢 Aligned. |
| 26 | `POST` | `/staff/{id}/doctor/specialties` | `staff/router.py`: `link_specialty` | `doctor.ts`: `linkDoctorSpecialty` | Aligned (`SpecialtyLink`). | Backend returns `{ staff_id, specialty_id }`, NOT `Specialty` (`{ specialtyId, specialtyName }`). | 🟠 Medium: Type mismatch on return value. |
| 27 | `DELETE`| `/staff/{id}/doctor/specialties/{sid}` | `staff/router.py`: `unlink_specialty` | `doctor.ts`: `unlinkDoctorSpecialty` | Path params. Returns 204. | None. | 🟢 Aligned. |
| 28 | `GET` | `/doctors` | `staff/router.py`: `list_doctors` | `doctorOptions.ts`: `fetchDoctorOptions` vs `doctor.ts`: `fetchDoctors` | Query: `branch_id`, `specialty_id` (unpaginated). | Backend returns array of `{ doctorName, specialties: string[] }`. `doctor.ts` incorrectly expects `Doctor[]`. | 🔴 High: Conflicting services. `doctor.ts` types are inaccurate and can cause runtime bugs. |
| 29 | `GET` | `/staff/{id}/account`| **MISSING IN ROUTER** | `accounts.ts`: `fetchUserAccount` | Service has `get_account`, but route is not registered! | 404 / 405 error on call. | 🔴 Critical: Endpoint completely missing in backend router. |
| 30 | `POST` | `/staff/{id}/account`| `staff/router.py`: `create_account` | `accounts.ts`: `createUserAccount` | Aligned (`AccountCreate`). | Backend returns `role_name` (`roleName`), frontend `UserAccount` expects `role`. | 🟠 Medium: Field naming mismatch on return type. |
| 31 | `PATCH` | `/staff/{id}/account`| `staff/router.py`: `update_account` | `accounts.ts`: `updateUserAccount` | Aligned (`AccountUpdate`). | Same: `roleName` vs `role`. | 🟠 Medium: Field naming mismatch on return type. |
| 32 | `POST` | `/staff/{id}/account/reset-password` | `staff/router.py`: `reset_password` | `accounts.ts`: `resetStaffPassword` | Backend requires `new_password` (min 6 chars); frontend typed input as optional `{}`. | None (returns 204). | 🟠 Medium: Calling with default `{}` triggers 422 error. |
| **Patients & Guardians** | | | | | | | |
| 33 | `GET` | `/patients` | `patients/router.py`: `list_patients` | `patients.ts`: `fetchPatients` | Query: `search`, `branch_id`, paging. | Aligned via `toPatient` mapper. | 🟢 Aligned. |
| 34 | `POST` | `/patients` | `patients/router.py`: `create_patient` | `patients.ts`: `registerPatient` | Frontend sends `registeredBranchId`; backend overwrites with caller's branch. | Conflict returns structured `patient_id` in error details. | 🟢 Aligned (handled by `rethrowUniqueViolation`). |
| 35 | `GET` | `/patients/{id}` | `patients/router.py`: `get_patient` | `patients.ts`: `fetchPatientById` | Path `patient_id`. | Aligned via `toPatient` mapper. | 🟢 Aligned. |
| 36 | `PATCH` | `/patients/{id}` | `patients/router.py`: `patch_patient` | `patients.ts`: `updatePatient` | Aligned (`PatientUpdate`). | Aligned via `toPatient` mapper. | 🟢 Aligned. |
| 37 | `GET` | `/patients/{id}/phones` | `patients/router.py`: `list_patient_phones` | `patientPhones.ts`: `fetchPatientPhones` | Path `patient_id`, paging. | Aligned (`Phone[]`). | 🟢 Aligned. |
| 38 | `POST` | `/patients/{id}/phones` | `patients/router.py`: `add_patient_phone` | `patientPhones.ts`: `addPatientPhone` | Aligned (`PhoneCreate`). | Aligned (`Phone`). | 🟢 Aligned. |
| 39 | `DELETE`| `/patients/{id}/phones/{pid}` | `patients/router.py`: `delete_patient_phone` | `patientPhones.ts`: `deletePatientPhone` | Path params. | None. | 🟢 Aligned. |
| 40 | `GET` | `/patients/{id}/guardians` | `patients/router.py`: `list_linked_guardians` | `patientGuardians.ts`: `fetchPatientGuardians` | Path `patient_id`, paging. | Aligned (`PatientGuardianLink[]`). | 🟢 Aligned. |
| 41 | `POST` | `/patients/{id}/guardians` | `patients/router.py`: `link_guardian` | `patientGuardians.ts`: `linkGuardianToPatient` | Aligned (supports ID or inline new guardian). | Aligned (`PatientGuardianLink`). | 🟢 Aligned. |
| 42 | `DELETE`| `/patients/{id}/guardians/{gid}`| `patients/router.py`: `unlink_guardian` | `patientGuardians.ts`: `unlinkGuardianFromPatient` | Path params. | None. | 🟢 Aligned. |
| 43 | `GET` | `/patients/{id}/insurance` | `patients/router.py`: `list_patient_insurance` | `insurance.ts`: `fetchPatientInsurance` | Path `patient_id`, paging. | Aligned (`InsurancePolicy[]`). | 🟢 Aligned. |
| 44 | `POST` | `/patients/{id}/insurance` | `patients/router.py`: `add_patient_insurance` | `insurance.ts`: `addPatientInsurance` | Aligned (`InsuranceCreate`). | Aligned (`InsurancePolicy`). | 🟢 Aligned. |
| 45 | `PATCH` | `/patients/{id}/insurance/{pid}`| `patients/router.py`: `patch_patient_insurance` | `insurance.ts`: `updatePatientInsurance` | Aligned (`InsuranceUpdate`). | Aligned (`InsurancePolicy`). | 🟢 Aligned. |
| 46 | `GET` | `/guardians` | `guardians/router.py`: `list_guardians` | `guardians.ts`: `fetchGuardians` | Query: `search`, paging. | Aligned via `toGuardian` mapper. | 🟢 Aligned. |
| 47 | `POST` | `/guardians` | `guardians/router.py`: `create_guardian` | `guardians.ts`: `createGuardian` | Aligned (`GuardianCreate`). | Aligned (`Guardian`). | 🟢 Aligned. |
| 48 | `GET` | `/guardians/{id}`| `guardians/router.py`: `get_guardian` | `guardians.ts`: `fetchGuardianById` | Path `guardian_id`. | Aligned (`GuardianDetail`). | 🟢 Aligned. |
| 49 | `PATCH` | `/guardians/{id}`| `guardians/router.py`: `update_guardian` | `guardians.ts`: `updateGuardian` | Aligned (`GuardianUpdate`). | Aligned (`Guardian`). | 🟢 Aligned. |
| 50 | `GET` | `/guardians/{id}/phones` | `guardians/router.py`: `list_guardian_phones` | `guardians.ts`: `fetchGuardianPhones` | Path `guardian_id`, paging. | Aligned (`Phone[]`). | 🟢 Aligned. |
| 51 | `POST` | `/guardians/{id}/phones` | `guardians/router.py`: `add_guardian_phone` | `guardians.ts`: `addGuardianPhone` | Aligned (`GuardianPhoneCreate`). | Aligned (`Phone`). | 🟢 Aligned. |
| **Appointments** | | | | | | | |
| 52 | `GET` | `/appointments` | `appointment/router.py`: `list_appointments` | `appointments.ts`: `fetchAppointments` | Query: `branch_id`, `doctor_id`, `date`, `status`, `patient_id`, paging. | Aligned (`PagedResult<Appointment>`). | 🟢 Aligned. |
| 53 | `POST` | `/appointments` | `appointment/router.py`: `create_appointment` | `appointments.ts`: `bookAppointment` | Frontend sends `branchId`; backend overwrites with receptionist branch. | Aligned (`Appointment`). | 🟡 Low: Redundant body requirement for derived field. |
| 54 | `GET` | `/appointments/availability` | `appointment/router.py`: `get_availability` | `appointments.ts`: `fetchAppointmentAvailability` | Query: `doctor_id`, `date`. | Aligned (`AvailabilitySlot[]`). | 🟢 Aligned. |
| 55 | `GET` | `/appointments/{id}` | `appointment/router.py`: `get_appointment` | `appointments.ts`: `fetchAppointmentById` | Path `appointment_id`. | Aligned (`Appointment`). | 🟢 Aligned. |
| 56 | `PATCH` | `/appointments/{id}` | `appointment/router.py`: `reschedule_appointment` | `appointments.ts`: `rescheduleAppointment` | Aligned (`AppointmentReschedule`). | Aligned (`Appointment` with `previousAppointmentId`). | 🟢 **Resolved**: Implemented via Transition Chain. |
| 57 | `GET` | `/appointments/{id}/reschedule-history` | `appointment/router.py`: `get_reschedule_history` | `appointments.ts`: `fetchRescheduleHistory` | Path `appointment_id`. | Aligned (`Appointment[]`). | 🟢 **Resolved**: Implemented via chain query. |
| 58 | `POST` | `/appointments/{id}/cancel` | `appointment/router.py`: `cancel_appointment` | `appointments.ts`: `cancelAppointment` | Aligned (`AppointmentCancel { reason }`). | Aligned (`Appointment`). | 🟢 Aligned. |
| 59 | `POST` | `/appointments/{id}/complete` | `appointment/router.py`: `complete_appointment` | `appointments.ts`: `completeAppointment` | Path `appointment_id`. | Aligned (`Appointment`). | 🟢 Aligned. |
| **Consultation Treatments** | | | | | | | |
| 60 | `GET` | `/appointments/{id}/treatments` | `appointment_treatment/router.py`: `list_appointment_treatments` | `appointmentTreatments.ts`: `fetchAppointmentTreatments` | Path `appointment_id`. | Aligned (`AppointmentTreatment[]`). | 🟢 Aligned. |
| 61 | `POST` | `/appointments/{id}/treatments` | `appointment_treatment/router.py`: `create_appointment_treatment` | `appointmentTreatments.ts`: `logAppointmentTreatment` | Frontend parameter typed with snake_case `service_code`. | Aligned (`AppointmentTreatment`). | 🟡 Low: Typing naming style inconsistency. |
| 62 | `POST` | `/appointment-treatments/{id}/amend` | `appointment_treatment/router.py`: `amend_appointment_treatment` | `appointmentTreatments.ts`: `amendAppointmentTreatment` | Frontend typed with snake_case `service_code`, `amendment_reason`. | Aligned (`AppointmentTreatment`). | 🟡 Low: Typing naming style inconsistency. |
| 63 | `PATCH` | `/appointments/{id}/notes` | `appointment_treatment/router.py`: `update_appointment_notes` | `appointmentTreatments.ts`: `saveConsultationNotes` | Aligned (`ConsultationNotesUpdate { notes }`). | Aligned (`Appointment`). | 🟢 Aligned. |
| **Billing** | | | | | | | |
| 64 | `GET` | `/invoices` | `billing/router.py`: `list_invoices` | `invoices.ts`: `fetchInvoices` | Query: `status`, `branch_id`, `patient_id`, paging. | Aligned (`PagedResult<Invoice>`). | 🟢 Aligned. |
| 65 | `GET` | `/invoices/{id}` | `billing/router.py`: `get_invoice` | `invoices.ts`: `fetchInvoiceById` | Path `invoice_id`. | Aligned (`InvoiceDetail` with `lineItems`). | 🟢 Aligned. |
| 66 | `POST` | `/invoices/{id}/finalize` | `billing/router.py`: `finalize_invoice` | `invoices.ts`: `finalizeInvoice` | Aligned (`InvoiceFinalize`). | Aligned (`Invoice`). | 🟢 Aligned. |
| 67 | `GET` | `/invoices/{id}/payments` | `billing/router.py`: `invoice_payments` | `invoices.ts`: `fetchInvoicePayments` | Path `invoice_id`, paging. | Aligned (`Payment[]`). | 🟢 Aligned. |
| 68 | `POST` | `/invoices/{id}/payments` | `billing/router.py`: `create_payment` | `payments.ts`: `recordPayment` | Aligned (`PaymentCreate`). | Aligned (`Payment`). | 🟢 Aligned. |
| 69 | `GET` | `/payments/{id}` | `billing/router.py`: `get_payment` | `payments.ts`: `fetchPaymentById` | Path `payment_id`. | Aligned (`Payment`). | 🟢 Aligned. |
| 70 | `GET` | `/insurance-claims` | `billing/router.py`: `list_claims` | `insuranceClaims.ts`: `fetchInsuranceClaims` | Query: `status`, `branch_id`, paging. Lacks `invoice_id` filter! | Aligned (`PagedResult<InsuranceClaim>`). | 🟠 Medium: Client must fetch 100 items to find invoice's claim. |
| 71 | `POST` | `/invoices/{id}/claim` | `billing/router.py`: `create_claim` | `insuranceClaims.ts`: `createInsuranceClaim` | Aligned (`ClaimCreate`). | Aligned (`InsuranceClaim`). | 🟢 Aligned. |
| 72 | `POST` | `/insurance-claims/{id}/verify` | `billing/router.py`: `verify_claim` | `insuranceClaims.ts`: `verifyInsuranceClaim` | Path `claim_id`. Empty body. | Aligned (`InsuranceClaim`). | 🟢 Aligned. |
| 73 | `GET` | `/insurance-claims/{id}` | `billing/router.py`: `get_claim` | `insuranceClaims.ts`: `fetchInsuranceClaimById` | Path `claim_id`. | Aligned (`InsuranceClaim`). | 🟢 Aligned. |
| **Reports** | | | | | | | |
| 74 | `GET` | `/reports/appointments-summary` | `report/router.py`: `appointments_summary` | `reports.ts`: `fetchAppointmentsSummary` | Query: `branch_id`, `from`, `to`. | Aligned (`AppointmentSummaryReportItem[]`). | 🟢 Aligned. |
| 75 | `GET` | `/reports/doctor-revenue` | `report/router.py`: `doctor_revenue` | `reports.ts`: `fetchDoctorRevenue` | Query: `branch_id`, `from`, `to`. | Aligned (`DoctorRevenueReportItem[]`). | 🟢 Aligned. |
| 76 | `GET` | `/reports/outstanding-balances` | `report/router.py`: `outstanding_balances` | `reports.ts`: `fetchOutstandingBalances` | Backend requires `patient_id` for Receptionists; frontend type omits `patientId`! | Aligned (`OutstandingBalanceReportItem[]`). | 🔴 High: Receptionists will always encounter 422 error. |
| 77 | `GET` | `/reports/treatment-frequency` | `report/router.py`: `treatment_frequency` | `reports.ts`: `fetchTreatmentFrequency` | Backend supports `branch_id`; frontend parameter type omits it. | Aligned (`TreatmentFrequencyReportItem[]`). | 🟡 Low: Typing restriction prevents branch filtering. |
| 78 | `GET` | `/reports/insurance-vs-outofpocket` | `report/router.py`: `insurance_vs_outofpocket` | `reports.ts`: `fetchInsuranceVsOutOfPocket` | Query: `branch_id`, `from`, `to`. | Aligned (`InsuranceVsOutOfPocketReport`). | 🟢 Aligned. |
| 79–83| `GET` | `/reports/pdf/*` (5 endpoints) | `report_pdf/router.py` (5 routes) | **MISSING IN FRONTEND** | Query filters match report queries. Returns binary PDF. | None in frontend. | 🟠 Medium: 5 complete PDF endpoints unintegrated in frontend. |
| **Audit Logs** | | | | | | | |
| 84 | `GET` | `/audit-logs` | `audit/router.py`: `list_audit_logs` | `auditLogs.ts`: `fetchAuditLogs` | Query: `staff_id`, `action_type`, `table_affected`, `from`, `to`, `record_id`, paging. | Backend returns `PagedResult`. Frontend expects bare array `AuditLog[]`. Field names mismatched! | 🔴 Critical: Return type mismatch, field name discrepancies (`recordId` vs `recordIdAffected`, `createdAt` vs `logTimestamp`). |
| 85 | `GET` | `/audit-logs/{id}` | `audit/router.py`: `get_audit_log` | `auditLogs.ts`: `fetchAuditLogById` | Path `log_id`. | Field name discrepancies (`recordId` vs `recordIdAffected`, `createdAt` vs `logTimestamp`). | 🟠 Medium: Field naming inconsistency. |

---

## 4. Deep-Dive Domain Analysis & Issues

### 4.1 Authentication & Session
#### Issue 1: Redundant Roundtrip and Fragile Scoping in `fetchCurrentUser`
- **Current Behavior:** In `frontend/src/services/api/auth.ts`, `fetchCurrentUser()` invokes `GET /auth/me` to get `{ staffId, username, role, branchId }`, and then issues an immediate second request to `GET /staff/${me.staffId}` to fetch `firstName`, `lastName`, and `branchName`.
- **Root Cause:** Frontend `AuthUser` in `frontend/src/types/auth.ts` was typed with only 4 fields. However, the backend `GET /auth/me` already returns the complete `UserProfile` (joining `staff` and `branch`), containing `first_name`, `last_name`, `job_title`, `email`, and `branch_name`. Furthermore, `/staff/{staff_id}` enforces strict branch and role permissions which can throw an unnecessary 403/404 if permissions are mismatched.
- **Solution:** 
  1. Expand the TypeScript interface `AuthUser` in `frontend/src/types/auth.ts` to include `firstName: string`, `lastName: string`, `branchName?: string`, and `jobTitle?: string`.
  2. Simplify `fetchCurrentUser()` to directly map the response from `GET /auth/me` without making the second call to `/staff/{staff_id}`.

#### Issue 2: Envelope Non-Compliance on Auth Endpoints
- **Current Behavior:** `POST /auth/login`, `POST /auth/refresh`, and `GET /auth/me` return bare JSON models rather than the standardized `{ "data": ..., "error": null }` structure.
- **Root Cause:** `auth/router.py` uses FastAPI's `response_model=LoginResponse` without wrapping in the `_success(...)` helper.
- **Solution:** Update `auth/router.py` to wrap responses in `{ "data": ..., "error": null }`, aligning with all other domains in the application.

---

### 4.2 Staff, Doctor & User Account Domain
#### Issue 3: Missing `GET /staff/{staff_id}/account` Endpoint (Critical)
- **Current Behavior:** `accounts.ts` defines `fetchUserAccount(staffId: number): Promise<UserAccount>`, making a call to `GET /staff/${staffId}/account`. Calling this from any frontend screen fails with 404 Not Found.
- **Root Cause:** While the backend service function `get_account(conn, staff_id)` is fully implemented in `backend/app/domains/staff/service.py`, the corresponding route was omitted from `backend/app/domains/staff/router.py`.
- **Solution:** Add `@router.get("/staff/{staff_id}/account")` in `backend/app/domains/staff/router.py` restricted to role `Admin`, returning `_success(await service.get_account(conn, staff_id))`.

#### Issue 4: Property Name Mismatch for Role in `UserAccount`
- **Current Behavior:** In `backend/app/domains/staff/service.py`, `get_account` queries:
  ```sql
  SELECT ua.staff_id, ua.username, ua.account_status, r.role_name ...
  ```
  After transformation, this produces `roleName`. However, the frontend `UserAccount` interface expects `role: Role`. As a result, `account.role` resolves to `undefined`.
- **Root Cause:** Backend schema uses `role_name`, whereas frontend interface uses `role`.
- **Solution:** In backend `get_account`, alias `r.role_name AS role` (or update frontend `UserAccount` interface to include `roleName: Role` or map it upon retrieval).

#### Issue 5: Return Type Mismatch in `linkDoctorSpecialty`
- **Current Behavior:** In `frontend/src/services/api/doctor.ts`, `linkDoctorSpecialty` is typed to return `Promise<Specialty>`. However, backend `POST /staff/{staff_id}/doctor/specialties` returns:
  ```json
  { "data": { "staff_id": 1, "specialty_id": 2 }, "error": null }
  ```
- **Root Cause:** Backend returns the junction record keys, not the hydrated `Specialty` entity (`specialty_id` and `specialty_name`).
- **Solution:** Either update the frontend return type to `{ staffId: number; specialtyId: number }` or update the backend service to join and return `specialty_name`.

#### Issue 6: Conflicting Doctor Query Services (`doctor.ts` vs `doctorOptions.ts`)
- **Current Behavior:**
  - `doctorOptions.ts` exports `fetchDoctorOptions(...)` returning `DoctorOption[]` (lightweight list with `doctorName` and `specialties: string[]`).
  - `doctor.ts` exports `fetchDoctors(...)` claiming to return `Doctor[]` (which expects `yearsOfExperience`, `qualifications`, and `specialties: Specialty[]`).
- **Root Cause:** The backend endpoint `GET /doctors` is solely designed for booking dropdowns, returning `doctor_name` and an array of specialty names. It does not return full doctor HR details.
- **Solution:** Deprecate `fetchDoctors` in `doctor.ts` and consolidate on `fetchDoctorOptions`, or create a distinct `DoctorListItem` type so developers do not expect full `Doctor` fields.

#### Issue 7: Unsafe Password Reset Contract
- **Current Behavior:** In `accounts.ts`, `resetStaffPassword(staffId, input?: { newPassword?: string })` allows calling with no arguments (`input ?? {}`).
- **Root Cause:** Backend Pydantic schema `PasswordReset` enforces `new_password: str = Field(min_length=6, max_length=72)`. Sending an empty object results in a 422 Validation Error.
- **Solution:** Change the frontend function parameter to require `{ newPassword: string }`.

---

### 4.3 Appointments Domain
#### Issue 8: Missing Appointment Reschedule Endpoint — [RESOLVED ✅]
- **Status:** **RESOLVED** via Transition Chain Architecture.
- **Implemented Solution:** 
  1. Added `AppointmentReschedule` schema in `appointment/schemas.py` (`appointment_date: date`, `appointment_time: time`, `reason: str | None`) with automatic validation against past dates.
  2. Implemented `reschedule_appointment` in `appointment/service.py`: atomically updates the old appointment to `status = 'Re-Scheduled'` (vacating the old slot for new bookings) and inserts a new appointment row in `status = 'Scheduled'`.
  3. Registered `PATCH /api/v1/appointments/{appointment_id}` in `appointment/router.py` restricted to `Receptionist` role and wrapped in `with_transaction(staff_id=user.staff_id)` for session audit attribution.
  4. Updated `list_availability()` and database slot constraints (`fn_appointment_overlap_insert`, `uq_appointment_doctor_active_slot`) to exclude `'Re-Scheduled'` appointments so vacated slots are immediately available.

#### Issue 9: Reschedule History Route Omission — [RESOLVED ✅]
- **Status:** **RESOLVED**.
- **Implemented Solution:**
  1. Implemented `get_reschedule_history` in `appointment/service.py` querying linked chain appointments by reason and ID.
  2. Registered `GET /api/v1/appointments/{appointment_id}/reschedule-history` in `appointment/router.py` accessible to `Receptionist`, `Doctor`, `Admin`, and `Branch Manager`.
  3. Added `fetchRescheduleHistory` client helper in `frontend/src/services/api/appointments.ts`.

#### Issue 10: Redundant `branch_id` Requirement on Booking
- **Current Behavior:** Backend schema `AppointmentCreate` requires `branch_id: int = Field(gt=0)`, yet the router overrides it:
  `branch_id = user.branch_id`
- **Root Cause:** Branch ownership is strictly derived from the authenticated Receptionist's token per security requirements.
- **Solution:** Mark `branch_id: int | None = None` in backend `AppointmentCreate` schema so the client is not forced to pass a redundant property.

---

### 4.4 Consultation & Treatments Domain
#### Issue 11: Inconsistent Snake_case Parameter Typing
- **Current Behavior:** In `frontend/src/services/api/appointmentTreatments.ts`:
  ```typescript
  export async function logAppointmentTreatment(appointmentId: number, input: { service_code: string }) ...
  export async function amendAppointmentTreatment(..., input: { service_code: string; amendment_reason: string }) ...
  ```
- **Root Cause:** Hand-crafted TypeScript interfaces used snake_case property names directly instead of idiomatic camelCase.
- **Solution:** Refactor parameter interfaces to camelCase (`serviceCode: string`, `amendmentReason: string`). The Axios request interceptor (`transformRequestPayload`) will automatically serialize them to `service_code` and `amendment_reason`.

---

### 4.5 Billing Domain
#### Issue 12: Missing `invoice_id` Filter on `GET /insurance-claims`
- **Current Behavior:** In `InvoiceDetailDrawer.tsx`, to display the claim status for an invoice, the frontend calls `fetchInsuranceClaims({ pageSize: 100 })` and searches `items.find(c => c.invoiceId === invoiceId)`.
- **Root Cause:** Backend `GET /insurance-claims` only accepts `status` and `branch_id` query filters. It does not accept `invoice_id`.
- **Solution:** Add `invoice_id: int | None = Query(default=None, ge=1)` to `GET /insurance-claims` in `backend/app/domains/billing/router.py`.

---

### 4.6 Reports & PDF Export Domain
#### Issue 13: Receptionist 422 Error on `GET /reports/outstanding-balances` (High)
- **Current Behavior:** In `backend/app/domains/report/router.py`:
  ```python
  if user.role == "Receptionist" and patient_id is None:
      raise HTTPException(422, "Receptionists must provide patient_id")
  ```
  However, in `frontend/src/services/api/reports.ts`:
  ```typescript
  export async function fetchOutstandingBalances(params?: Pick<ReportQueryParams, 'branchId'>)
  ```
  The type strictly permits only `branchId`. It is impossible for a caller to supply `patientId`.
- **Root Cause:** Frontend parameter type was restricted using `Pick<..., 'branchId'>` without including `patientId`.
- **Solution:** Update `ReportQueryParams` in `frontend/src/services/api/reports.ts` to include `patientId?: number`, and allow `patientId` in `fetchOutstandingBalances`.

#### Issue 14: Treatment Frequency Query Lacks `branchId` in Frontend
- **Current Behavior:** Backend supports `branch_id: int | None` on `GET /reports/treatment-frequency`. Frontend types `params?: Pick<ReportQueryParams, 'category' | 'from' | 'to'>`, preventing managers from filtering treatment frequency by branch.
- **Solution:** Add `branchId?: number` to `fetchTreatmentFrequency` parameter typing.

#### Issue 15: Unintegrated Backend PDF Export Endpoints
- **Current Behavior:** The backend provides 5 streaming PDF report endpoints with ReportLab styling (`/reports/pdf/appointments-summary`, `/reports/pdf/doctor-revenue`, `/reports/pdf/outstanding-balances`, `/reports/pdf/treatment-frequency`, `/reports/pdf/insurance-summary`). The frontend has no API client methods for these routes, offering only a basic client-side CSV download.
- **Solution:** Add a unified `exportReportPdf(reportType, params)` service function in `reports.ts` that triggers a direct browser download of the binary PDF stream.

---

### 4.7 Audit Logs Domain
#### Issue 16: Severe Pagination & Return Shape Mismatch (Critical)
- **Current Behavior:** In `frontend/src/services/api/auditLogs.ts`:
  ```typescript
  export async function fetchAuditLogs(params?: Record<string, unknown>): Promise<AuditLog[]> {
    return apiGet<AuditLog[]>('/audit-logs', params);
  }
  ```
  Backend returns `_success_list(...)`, which is a paginated dictionary:
  `{ "data": { "items": [...], "total": N, "page": 1, "page_size": 25 }, "error": null }`.
  Because `client.ts` unwraps `body.data`, `apiGet` returns `{ items: [...], total, page, pageSize }`. The component expecting an array crashed until developers added fallback casting:
  ```typescript
  if (Array.isArray(res)) return { items: res, total: res.length };
  const paged = res as unknown as { items?: AuditLog[]; total?: number };
  ```
- **Root Cause:** Frontend service was typed as returning an array `AuditLog[]` instead of `PagedResult<AuditLog>`.
- **Solution:** Update `fetchAuditLogs` to return `Promise<PagedResult<AuditLogEntry>>`.

#### Issue 17: Property Name and Type Inconsistencies in AuditLog
- **Current Behavior:**
  - Backend returns: `record_id_affected` (text, e.g. "42", "TC01") and `log_timestamp` (timestamptz).
  - After response transformer: `recordIdAffected: string` and `logTimestamp: string`.
  - Frontend `AuditLog` in `auditLogs.ts` defines: `recordId?: number` and `createdAt: string`.
  - In `AuditLogPanel.tsx`, the UI is forced to do:
    ```typescript
    formatDate(log.createdAt || (log as any).logTimestamp)
    String(log.recordId ?? (log as any).recordIdAffected ?? '—')
    ```
- **Root Cause:** Two conflicting interfaces exist: `AuditLog` in `services/api/auditLogs.ts` (mismatched) and `AuditLogEntry` in `types/audit.ts` (matched).
- **Solution:** Delete the incorrect `AuditLog` interface in `services/api/auditLogs.ts` and use `AuditLogEntry` from `types/audit.ts` everywhere.

---

## 5. Architectural & Database Audit Attribution

### Issue 18: Missing Audit Attribution Session Context
- **Current Behavior:** Database triggers (`trg_audit_patient`, `trg_audit_appointment_treatment`, `trg_audit_invoice`) enforce `SAFE-1` and `SAFE-2` by reading session variable `app.current_staff_id`. If mutations occur without setting this variable, triggers fail with `check_violation` or fail to attribute the action to the acting staff member.
- **Backend Status:**
  - Properly wrapped with `with_transaction(staff_id=...)`:
    - Patient creation & updates (`patients/service.py`)
    - Treatment logging & amendment (`appointment_treatment/router.py`)
    - Consultation notes update (`appointment_treatment/router.py`)
    - Invoice finalization & payment recording (`billing/router.py`)
    - Appointment completion (`appointment/router.py`)
  - **Missing Session Context:**
    - Branch creation & updating: `create_branch` and `patch_branch` in `branches/router.py`
    - Appointment creation & cancellation: `create_appointment` and `cancel_appointment` in `appointment/router.py`
- **Solution:** Wrap mutations in `branches/router.py` and `appointment/router.py` within `with_transaction(staff_id=user.staff_id)`.

---

## 6. Prioritized Remediation Roadmap

### Phase 1: Critical Bug Fixes (Immediate)
1. **Add Missing Account Detail Route:**
   - Expose `@router.get("/staff/{staff_id}/account")` in `backend/app/domains/staff/router.py`.
2. **Implement Appointment Rescheduling: [COMPLETED ✅]**
   - Implemented `PATCH /api/v1/appointments/{appointment_id}` using Transition Chain architecture.
3. **Fix Audit Log Types & Pagination:**
   - Update `fetchAuditLogs()` in `auditLogs.ts` to return `Promise<PagedResult<AuditLogEntry>>`.
   - Replace mismatched `AuditLog` interface with `AuditLogEntry`.

### Phase 2: Role & Parameter Contract Fixes (High Priority)
4. **Fix Receptionist Outstanding Balances Query:**
   - Add `patientId?: number` to `ReportQueryParams` in `frontend/src/services/api/reports.ts`.
5. **Add `invoice_id` Filter to Claims Query:**
   - Add `invoice_id` filter to `GET /insurance-claims` in `backend/app/domains/billing/router.py`.
6. **Harmonize `GET /auth/me` and `fetchCurrentUser`:**
   - Expand `AuthUser` in `frontend/src/types/auth.ts` to include full profile fields; eliminate redundant call to `/staff/{id}`.
7. **Fix `Doctor` vs `DoctorOption` Service Ambiguity:**
   - Deprecate inaccurate `fetchDoctors` in `doctor.ts` in favor of `fetchDoctorOptions`.

### Phase 3: Contract & Type Cleanup (Medium Priority)
8. **Normalize Property Names:**
   - Return `role` from backend `get_account` to match `UserAccount.role`.
   - Update `appointmentTreatments.ts` parameters to camelCase (`serviceCode`, `amendmentReason`).
   - Fix return type of `linkDoctorSpecialty` in `doctor.ts`.
9. **Wrap Auth Endpoints in Envelope:**
   - Wrap `login`, `refresh`, and `me` in standard `_success(...)` envelopes in `auth/router.py`.
10. **Add Missing Audit Session Context:**
    - Wrap branch mutations and appointment booking/cancellation in `with_transaction(staff_id=...)`.

### Phase 4: Feature Enhancements (Low Priority)
11. **Integrate PDF Report Generation:**
    - Expose PDF download helper in `reports.ts` for the 5 ReportLab PDF endpoints.
12. **Support Branch Filtering on Treatment Frequency:**
    - Allow `branchId` in `fetchTreatmentFrequency` parameter typing.
13. **Reschedule History Endpoint: [COMPLETED ✅]**
    - Implemented `GET /api/v1/appointments/{appointment_id}/reschedule-history` returning chronological transition chains.

---

*End of Report.*
