# CATMS API Specification

Base URL: `/api/v1`
Auth: Bearer JWT (issued on login, tied to `user_account.staff_id` + `role`)
Format: JSON in/out. Standard envelope: `{ "data": ..., "error": null }` on
success, `{ "data": null, "error": { "code": ..., "message": ... } }` on
failure.
Pagination (all list endpoints): `?page=&page_size=` (default 25, max 100),
response includes `{ "items": [...], "total": N, "page": N }`.
Filtering: query params per resource, listed under each section.

**Database target:** PostgreSQL (Supabase). Wherever a query is
naturally a good fit for a CTE, window function, or view/materialized view
instead of pulling raw rows and computing in application code, that's
called out explicitly under "SQL notes" — this is a database-focused
project, so query design matters as much as the endpoint shape.

**RBAC legend:** A = Admin, BM = Branch Manager, R = Receptionist
(also handles billing/cashier duties — Receptionist and Cashier are the
same role, not two separate ones), D = Doctor, QA = QA Tester. "Any" =
any authenticated role.

---

## Endpoint Ownership

Every section below is owned end-to-end by exactly one developer — no
section is split between two people, so nobody edits the same route
file or table-access code as anyone else.

| Owner | Sections |
|---|---|
| **Arun** | Branches, Patients, Guardians, Invoices, Payments, Insurance Claims, Audit Log |
| **Gayan** | Authentication, Treatment Catalogue, Appointments, Appointment Treatments, Reports |
| **Lahiru** | Specialties, Roles, Staff (+ Doctor & User Account subtypes) |

No two owners touch the same underlying table, so schema-level changes
(a new column, a new constraint) only ever need a sync with one other
person at most — check `CATMS_Database_Workload_Division.md` if a
change touches a table outside your own section.

---

## 0. Authentication — Owner: Gayan

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| POST | `/auth/login` | username + password → JWT + user profile (staff_id, role, branch_id) | Public | Gayan |
| POST | `/auth/logout` | invalidate current session/token | Any | Gayan |
| POST | `/auth/refresh` | refresh an expiring JWT | Any | Gayan |
| GET | `/auth/me` | current user's profile + role + linked staff record | Any | Gayan |

**SQL notes:** login updates `user_account.last_login` — do this as part of
the same query/transaction that verifies the password hash, not a
separate round trip. Refresh-token rotation reads/writes `refresh_token`
(family_id chain, `replaced_by_hash`) — reuse of an already-replaced
token should revoke the whole family, not just that one row.

---

## 1. Branches — Owner: Arun

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/branches` | list all branches | Any | Arun |
| POST | `/branches` | create branch | A | Arun |
| GET | `/branches/{branch_id}` | branch detail | Any | Arun |
| PATCH | `/branches/{branch_id}` | update branch details / assign manager | A | Arun |

Query params on GET list: none needed (small reference table, always
return all 3+ rows).

---

## 2. Specialties — Owner: Lahiru

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/specialties` | list all specialties | Any | Lahiru |
| POST | `/specialties` | create specialty | A | Lahiru |
| PATCH | `/specialties/{specialty_id}` | rename specialty | A | Lahiru |

---

## 3. Treatment Catalogue — Owner: Gayan

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/treatments` | list catalogue, filter `?category=` | Any | Gayan |
| POST | `/treatments` | add new service (BR-6: Admin/BM only) | A, BM | Gayan |
| GET | `/treatments/{service_code}` | detail | Any | Gayan |
| PATCH | `/treatments/{service_code}` | update name/price/category | A, BM | Gayan |

**Note:** no DELETE — `appointment_treatment.price_at_time` snapshots the
price at time of use, but the catalogue row itself should stay to keep
historical FK integrity. Deactivate via a future `is_active` flag if
retirement is ever needed, rather than deleting.

---

## 4. Staff (BR-6: only Admin/BM may register staff) — Owner: Lahiru

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/staff` | list, filter `?branch_id=&job_title=&employment_status=&search=` | A, BM | Lahiru |
| POST | `/staff` | create staff record (HR profile only, no login yet) | A, BM | Lahiru |
| GET | `/staff/{staff_id}` | full profile incl. phones, doctor/account subtype flags | A, BM, self | Lahiru |
| PATCH | `/staff/{staff_id}` | update HR fields | A, BM | Lahiru |
| GET | `/staff/{staff_id}/phones` | list phone numbers | A, BM, self | Lahiru |
| POST | `/staff/{staff_id}/phones` | add a phone number | A, BM, self | Lahiru |
| DELETE | `/staff/{staff_id}/phones/{phone_id}` | remove a phone number | A, BM, self | Lahiru |

### Doctor subtype
| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| POST | `/staff/{staff_id}/doctor` | promote a staff record to Doctor subtype | A, BM | Lahiru |
| GET | `/staff/{staff_id}/doctor` | doctor detail incl. specialties | Any | Lahiru |
| POST | `/staff/{staff_id}/doctor/specialties` | link a specialty (M:N insert) | A, BM | Lahiru |
| DELETE | `/staff/{staff_id}/doctor/specialties/{specialty_id}` | unlink a specialty | A, BM | Lahiru |
| GET | `/doctors` | convenience list for booking dropdowns, filter `?branch_id=&specialty_id=` | Any | Lahiru |

### User account subtype
| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| POST | `/staff/{staff_id}/account` | create login (username, temp password, role) | A | Lahiru |
| PATCH | `/staff/{staff_id}/account` | change role / disable-enable account | A | Lahiru |
| POST | `/staff/{staff_id}/account/reset-password` | admin-triggered password reset | A | Lahiru |

**SQL notes:** creating a `user_account` with `role = 'Doctor'` must go
through the DB trigger (`trg_user_role_doctor_consistency`) — the API
layer should surface that trigger's rejection as a clean 400 error
("staff member must have a doctor record before a Doctor-role account can
be created"), not swallow it as a generic 500.

---

## 5. Patients — Owner: Arun

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/patients` | search, `?search=&branch_id=` (matches name/NIC/phone across branches) | R, D, A, BM | Arun |
| POST | `/patients` | register new patient | R | Arun |
| GET | `/patients/{patient_id}` | full profile incl. phones, guardians, insurance | R, D, A, BM | Arun |
| PATCH | `/patients/{patient_id}` | update demographics | R | Arun |
| GET | `/patients/{patient_id}/phones` | list phones | R, D, A | Arun |
| POST | `/patients/{patient_id}/phones` | add phone | R | Arun |
| DELETE | `/patients/{patient_id}/phones/{phone_id}` | remove phone | R | Arun |
| GET | `/patients/{patient_id}/guardians` | list linked guardians + relationship | R, D | Arun |
| POST | `/patients/{patient_id}/guardians` | link a guardian (existing `guardian_id` or inline new-guardian payload) | R | Arun |
| DELETE | `/patients/{patient_id}/guardians/{guardian_id}` | unlink | R | Arun |
| GET | `/patients/{patient_id}/insurance` | policy detail | R | Arun |
| POST | `/patients/{patient_id}/insurance` | add policy | R | Arun |
| PATCH | `/patients/{patient_id}/insurance/{policy_id}` | update status/coverage | R | Arun |
| GET | `/patients/{patient_id}/appointments` | appointment history | R, D, A, BM | Arun |

**SQL notes — the one that matters most in this whole spec:** `POST
/patients` and `PATCH /patients/{id}` must check `nic_passport_no` against
existing rows and return a structured 409 Conflict with the existing
patient's `patient_id` in the response body (not just a generic unique-
constraint error string), so the frontend can render the "already
registered — view existing profile" banner from the Patient Registration
design directly off the response, instead of parsing a Postgres error
message.

---

## 6. Guardians — Owner: Arun

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/guardians` | search `?search=` (name or NIC) | R | Arun |
| POST | `/guardians` | create standalone guardian record | R | Arun |
| GET | `/guardians/{guardian_id}` | detail incl. phones + linked patients | R | Arun |
| PATCH | `/guardians/{guardian_id}` | update details | R | Arun |
| GET | `/guardians/{guardian_id}/phones` | list | R | Arun |
| POST | `/guardians/{guardian_id}/phones` | add phone | R | Arun |

**SQL notes:** `GET /guardians/{id}` should return linked patients via a
join through `patient_guardian` — this is the endpoint that proves the
de-duplication actually works end-to-end (one guardian, multiple patients,
one row).

---

## 7. Appointments — Owner: Gayan

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/appointments` | list/filter `?branch_id=&doctor_id=&date=&status=&patient_id=` | R, D, A, BM | Gayan |
| POST | `/appointments` | book (Scheduled) or walk-in (`is_walk_in=true`) | R | Gayan |
| GET | `/appointments/{appointment_id}` | detail | R, D, A, BM | Gayan |
| PATCH | `/appointments/{appointment_id}` | reschedule (date/time change) — triggers overlap re-check | R | Gayan |
| POST | `/appointments/{appointment_id}/cancel` | cancel with required reason | R | Gayan |
| POST | `/appointments/{appointment_id}/complete` | mark Completed — triggers invoice auto-creation | D | Gayan |
| GET | `/appointments/{appointment_id}/reschedule-history` | list of past reschedules (requires `appointment_reschedule_log` — confirm this table is actually in the shipped schema before building) | R, D, A | Gayan |
| GET | `/appointments/availability` | slot grid, `?doctor_id=&date=` → list of {time, available} | R | Gayan |

**SQL notes:**
- `POST`/`PATCH` on appointments must surface the BR-1/BR-7 overlap
  trigger's rejection as a 409 Conflict, not a 500 — the frontend's
  "conflict shown right at the time picker" behavior depends on this.
- `GET /appointments/availability` performs one database query for the
  doctor's non-cancelled appointments on the requested date. The backend
  generates the clinic slot grid and availability flags using the configured
  opening time, closing time, and slot interval.

---

## 8. Appointment Treatments (consultation logging) — Owner: Gayan

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/appointments/{appointment_id}/treatments` | list logged treatments for a visit | D, R | Gayan |
| POST | `/appointments/{appointment_id}/treatments` | log a treatment (only allowed if appointment is Completed) | D | Gayan |
| POST | `/appointment-treatments/{id}/amend` | create a correction row (`original_record_id` link) | D | Gayan |
| PATCH | `/appointments/{appointment_id}/notes` | save consultation notes | D | Gayan |

**No DELETE endpoint exists for this resource, intentionally** —
`trg_prevent_treatment_delete` rejects it at the DB level (SAFE-1), so
there's no point exposing a route that will always fail. Corrections only
ever go through `/amend`.

---

## 9. Invoices — Owner: Arun

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/invoices` | list/filter `?status=&branch_id=&patient_id=` | R, A, BM | Arun |
| GET | `/invoices/{invoice_id}` | detail incl. line items + payable amount (computed) | R, A, BM | Arun |
| POST | `/invoices/{invoice_id}/finalize` | apply insurance deduction / manual discount, Draft → Finalized | R | Arun |
| GET | `/invoices/{invoice_id}/payments` | payment history | R, A | Arun |

**SQL notes:** `payable_amount` is NOT a stored column (dropped for 3NF,
see the schema notes) — this endpoint computes it in the query:
```sql
SELECT invoice_id, subtotal_amount, insurance_deduction, manual_discount,
       subtotal_amount - insurance_deduction - manual_discount AS payable_amount,
       status
FROM invoice
WHERE invoice_id = $1;
```
Outstanding balance similarly comes from a query joining `payment`, never
a stored field — or read directly from `v_invoice_outstanding`, which
already computes this exact shape:
```sql
SELECT * FROM v_invoice_outstanding WHERE invoice_id = $1;
```

---

## 10. Payments — Owner: Arun

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| POST | `/invoices/{invoice_id}/payments` | record a full/partial payment | R | Arun |
| GET | `/payments/{payment_id}` | detail | R, A | Arun |

Payments are append-only — no PATCH/DELETE, matching the schema.

---

## 11. Insurance Claims — Owner: Arun

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/insurance-claims` | list/filter `?status=&branch_id=` | R, A, BM | Arun |
| POST | `/invoices/{invoice_id}/claim` | create a claim against an invoice | R | Arun |
| POST | `/insurance-claims/{claim_id}/verify` | call the mock insurance API, update status/approved_amount | R | Arun |
| GET | `/insurance-claims/{claim_id}` | detail | R, A | Arun |

**SQL notes:** `approved_amount <= claimed_amount` is already enforced by
a trigger (BR-4) — the `/verify` endpoint should still validate this
client-side before calling the trigger-backed insert/update, so a bad
mock-API response produces a clean error instead of an ugly DB rejection
surfacing to the Receptionist handling billing.

---

## 12. Reports — Owner: Gayan

| Method | Path | Description | Roles | REQ | Owner |
|---|---|---|---|---|---|
| GET | `/reports/appointments-summary` | `?branch_id=&from=&to=` daily counts by status | A, BM | RG-1 | Gayan |
| GET | `/reports/doctor-revenue` | `?branch_id=&from=&to=` revenue per doctor | A, BM | RG-2 | Gayan |
| GET | `/reports/outstanding-balances` | `?branch_id=` patients with unpaid dues | A, BM, R | RG-3 | Gayan |
| GET | `/reports/treatment-frequency` | `?category=&from=&to=` counts per treatment/category | A, BM | RG-4 | Gayan |
| GET | `/reports/insurance-vs-outofpocket` | `?branch_id=&from=&to=` | A, BM | RG-5 | Gayan |

**SQL notes — this is where "advanced SQL" should actually live, not in
application code:**
- **Doctor revenue** reads from `v_doctor_revenue` (already built) and
  ranks with `RANK() OVER (PARTITION BY branch_id ORDER BY revenue
  DESC)` rather than sorting in Python/JS.
- **Appointments summary** benefits from `GROUP BY` with `FILTER (WHERE
  status = 'Completed')`-style conditional aggregation to get all three
  status counts in one query instead of three separate queries.
- **Outstanding balances** reads directly from `v_invoice_outstanding`
  (already built) — don't re-derive the payable/outstanding formula
  here, it's already centralized in that view.
- Consider a Postgres **materialized view** for the heavier reports if
  raw queries exceed PERF-4's 10-second budget over a year of data —
  this touches shared view definitions, so coordinate with whoever owns
  the views file before adding one.

---

## 13. Audit Log — Owner: Arun

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/audit-logs` | filter `?staff_id=&action_type=&table_affected=&from=&to=&record_id=` | A, QA | Arun |
| GET | `/audit-logs/{log_id}` | full detail incl. `details` JSON diff | A, QA | Arun |

**SQL notes:** audit rows are written by `fn_audit_log()` triggers, not
the API layer — these endpoints are read-only. Every write to `patient`,
`appointment_treatment`, or `invoice` must have `app.current_staff_id`
set via `set_config(..., true)` in the same transaction, or the write
fails outright (the trigger raises explicitly if it's unset, rather
than silently logging with no attribution).

---

## 14. Roles (reference) — Owner: Lahiru

| Method | Path | Description | Roles | Owner |
|---|---|---|---|---|
| GET | `/roles` | list all role names (populates the role dropdown when creating a `user_account`) | A | Lahiru |
