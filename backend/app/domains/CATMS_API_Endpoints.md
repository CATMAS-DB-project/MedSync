# CATMS API Specification

Base URL: `/api/v1`
Auth: Bearer JWT (issued on login, tied to `user_account.staff_id` + `role`)
Format: JSON in/out. Standard envelope: `{ "data": ..., "error": null }` on
success, `{ "data": null, "error": { "code": ..., "message": ... } }` on
failure.
Pagination (all list endpoints): `?page=&page_size=` (default 25, max 100),
response includes `{ "items": [...], "total": N, "page": N }`.
Filtering: query params per resource, listed under each section.

**Database target:** PostgreSQL (Supabase/Neon). Wherever a query is
naturally a good fit for a CTE, window function, or view/materialized view
instead of pulling raw rows and computing in application code, that's
called out explicitly under "SQL notes" — this is a database-focused
project, so query design matters as much as the endpoint shape.

**RBAC legend:** A = Admin, BM = Branch Manager, R = Receptionist,
D = Doctor, C = Cashier, QA = QA Tester. "Any" = any authenticated role.

---

## 0. Authentication

| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/auth/login` | username + password → JWT + user profile (staff_id, role, branch_id) | Public |
| POST | `/auth/logout` | invalidate current session/token | Any |
| POST | `/auth/refresh` | refresh an expiring JWT | Any |
| GET | `/auth/me` | current user's profile + role + linked staff record | Any |

**SQL notes:** login updates `user_account.last_login` — do this as part of
the same query/transaction that verifies the password hash, not a
separate round trip.

---

## 1. Branches

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/branches` | list all branches | Any |
| POST | `/branches` | create branch | A |
| GET | `/branches/{branch_id}` | branch detail | Any |
| PATCH | `/branches/{branch_id}` | update branch details / assign manager | A |

Query params on GET list: none needed (small reference table, always
return all 3+ rows).

---

## 2. Specialties

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/specialties` | list all specialties | Any |
| POST | `/specialties` | create specialty | A |
| PATCH | `/specialties/{specialty_id}` | rename specialty | A |

---

## 3. Treatment Catalogue

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/treatments` | list catalogue, filter `?category=` | Any |
| POST | `/treatments` | add new service (BR-6: Admin/BM only) | A, BM |
| GET | `/treatments/{service_code}` | detail | Any |
| PATCH | `/treatments/{service_code}` | update name/price/category | A, BM |

**Note:** no DELETE — `appointment_treatment.price_at_time` snapshots the
price at time of use, but the catalogue row itself should stay to keep
historical FK integrity. Deactivate via a future `is_active` flag if
retirement is ever needed, rather than deleting.

---

## 4. Staff (BR-6: only Admin/BM may register staff)

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/staff` | list, filter `?branch_id=&job_title=&employment_status=&search=` | A, BM |
| POST | `/staff` | create staff record (HR profile only, no login yet) | A, BM |
| GET | `/staff/{staff_id}` | full profile incl. phones, doctor/account subtype flags | A, BM, self |
| PATCH | `/staff/{staff_id}` | update HR fields | A, BM |
| GET | `/staff/{staff_id}/phones` | list phone numbers | A, BM, self |
| POST | `/staff/{staff_id}/phones` | add a phone number | A, BM, self |
| DELETE | `/staff/{staff_id}/phones/{phone_id}` | remove a phone number | A, BM, self |

### Doctor subtype
| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/staff/{staff_id}/doctor` | promote a staff record to Doctor subtype | A, BM |
| GET | `/staff/{staff_id}/doctor` | doctor detail incl. specialties | Any |
| POST | `/staff/{staff_id}/doctor/specialties` | link a specialty (M:N insert) | A, BM |
| DELETE | `/staff/{staff_id}/doctor/specialties/{specialty_id}` | unlink a specialty | A, BM |
| GET | `/doctors` | convenience list for booking dropdowns, filter `?branch_id=&specialty_id=` | Any |

### User account subtype
| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/staff/{staff_id}/account` | create login (username, temp password, role) | A |
| PATCH | `/staff/{staff_id}/account` | change role / disable-enable account | A |
| POST | `/staff/{staff_id}/account/reset-password` | admin-triggered password reset | A |

**SQL notes:** creating a `user_account` with `role = 'Doctor'` must go
through the DB trigger (`trg_user_role_doctor_consistency`) — the API
layer should surface that trigger's rejection as a clean 400 error
("staff member must have a doctor record before a Doctor-role account can
be created"), not swallow it as a generic 500.

---

## 5. Patients

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/patients` | search, `?search=&branch_id=` (matches name/NIC/phone across branches) | R, D, C, A, BM |
| POST | `/patients` | register new patient | R |
| GET | `/patients/{patient_id}` | full profile incl. phones, guardians, insurance | R, D, C, A, BM |
| PATCH | `/patients/{patient_id}` | update demographics | R |
| GET | `/patients/{patient_id}/phones` | list phones | R, D, A |
| POST | `/patients/{patient_id}/phones` | add phone | R |
| DELETE | `/patients/{patient_id}/phones/{phone_id}` | remove phone | R |
| GET | `/patients/{patient_id}/guardians` | list linked guardians + relationship | R, D |
| POST | `/patients/{patient_id}/guardians` | link a guardian (existing `guardian_id` or inline new-guardian payload) | R |
| DELETE | `/patients/{patient_id}/guardians/{guardian_id}` | unlink | R |
| GET | `/patients/{patient_id}/insurance` | policy detail | R, C |
| POST | `/patients/{patient_id}/insurance` | add policy | R |
| PATCH | `/patients/{patient_id}/insurance/{policy_id}` | update status/coverage | R |
| GET | `/patients/{patient_id}/appointments` | appointment history | R, D, A, BM |

**SQL notes — the one that matters most in this whole spec:** `POST
/patients` and `PATCH /patients/{id}` must check `nic_passport_no` against
existing rows and return a structured 409 Conflict with the existing
patient's `patient_id` in the response body (not just a generic unique-
constraint error string), so the frontend can render the "already
registered — view existing profile" banner from the Patient Registration
design directly off the response, instead of parsing a Postgres error
message.

---

## 6. Guardians

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/guardians` | search `?search=` (name or NIC) | R |
| POST | `/guardians` | create standalone guardian record | R |
| GET | `/guardians/{guardian_id}` | detail incl. phones + linked patients | R |
| PATCH | `/guardians/{guardian_id}` | update details | R |
| GET | `/guardians/{guardian_id}/phones` | list | R |
| POST | `/guardians/{guardian_id}/phones` | add phone | R |

**SQL notes:** `GET /guardians/{id}` should return linked patients via a
join through `patient_guardian` — this is the endpoint that proves the
de-duplication actually works end-to-end (one guardian, multiple patients,
one row).

---

## 7. Appointments

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/appointments` | list/filter `?branch_id=&doctor_id=&date=&status=&patient_id=` | R, D, A, BM |
| POST | `/appointments` | book (Scheduled) or walk-in (`is_walk_in=true`) | R |
| GET | `/appointments/{appointment_id}` | detail | R, D, A, BM |
| PATCH | `/appointments/{appointment_id}` | reschedule (date/time change) — triggers overlap re-check + history log | R |
| POST | `/appointments/{appointment_id}/cancel` | cancel with required reason | R |
| POST | `/appointments/{appointment_id}/complete` | mark Completed — triggers invoice auto-creation | D |
| GET | `/appointments/{appointment_id}/reschedule-history` | list of past reschedules | R, D, A |
| GET | `/appointments/availability` | slot grid, `?doctor_id=&date=` → list of {time, available} | R |

**SQL notes:**
- `POST`/`PATCH` on appointments must surface the BR-1/BR-7 overlap
  trigger's rejection as a 409 Conflict, not a 500 — the frontend's
  "conflict shown right at the time picker" behavior depends on this.
- `GET /appointments/availability` is a good candidate for
  `generate_series()` in Postgres to produce the full slot grid (e.g. every
  15 minutes across clinic hours) LEFT JOINed against existing
  appointments for that doctor/date, rather than hardcoding slot lists in
  application code.

---

## 8. Appointment Treatments (consultation logging)

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/appointments/{appointment_id}/treatments` | list logged treatments for a visit | D, C, R |
| POST | `/appointments/{appointment_id}/treatments` | log a treatment (only allowed if appointment is Completed) | D |
| POST | `/appointment-treatments/{id}/amend` | create a correction row (`original_record_id` link) | D |
| PATCH | `/appointments/{appointment_id}/notes` | save consultation notes | D |

**No DELETE endpoint exists for this resource, intentionally** —
`trg_prevent_treatment_delete` rejects it at the DB level (SAFE-1), so
there's no point exposing a route that will always fail. Corrections only
ever go through `/amend`.

---

## 9. Invoices

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/invoices` | list/filter `?status=&branch_id=&patient_id=` | C, R (read-only), A, BM |
| GET | `/invoices/{invoice_id}` | detail incl. line items + payable amount (computed) | C, R, A, BM |
| POST | `/invoices/{invoice_id}/finalize` | apply insurance deduction / manual discount, Draft → Finalized | C |
| GET | `/invoices/{invoice_id}/payments` | payment history | C, R, A |

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
a stored field:
```sql
SELECT i.invoice_id,
       (i.subtotal_amount - i.insurance_deduction - i.manual_discount)
         - COALESCE(SUM(p.amount_paid), 0) AS outstanding
FROM invoice i
LEFT JOIN payment p ON p.invoice_id = i.invoice_id
WHERE i.invoice_id = $1
GROUP BY i.invoice_id;
```

---

## 10. Payments

| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/invoices/{invoice_id}/payments` | record a full/partial payment | C |
| GET | `/payments/{payment_id}` | detail | C, A |

Payments are append-only — no PATCH/DELETE, matching the schema.

---

## 11. Insurance Claims

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/insurance-claims` | list/filter `?status=&branch_id=` | C, A, BM |
| POST | `/invoices/{invoice_id}/claim` | create a claim against an invoice | C |
| POST | `/insurance-claims/{claim_id}/verify` | call the mock insurance API, update status/approved_amount | C |
| GET | `/insurance-claims/{claim_id}` | detail | C, A |

**SQL notes:** `approved_amount <= claimed_amount` is already enforced by
a trigger (BR-4) — the `/verify` endpoint should still validate this
client-side before calling the trigger-backed insert/update, so a bad
mock-API response produces a clean error instead of an ugly DB rejection
surfacing to the Cashier.

---

## 12. Reports

| Method | Path | Description | Roles | REQ |
|---|---|---|---|---|
| GET | `/reports/appointments-summary` | `?branch_id=&from=&to=` daily counts by status | A, BM | RG-1 |
| GET | `/reports/doctor-revenue` | `?branch_id=&from=&to=` revenue per doctor | A, BM | RG-2 |
| GET | `/reports/outstanding-balances` | `?branch_id=` patients with unpaid dues | A, BM, C | RG-3 |
| GET | `/reports/treatment-frequency` | `?category=&from=&to=` counts per treatment/category | A, BM | RG-4 |
| GET | `/reports/insurance-vs-outofpocket` | `?branch_id=&from=&to=` | A, BM | RG-5 |

**SQL notes — this is where "advanced SQL" should actually live, not in
application code:**
- **Doctor revenue** is a natural window-function candidate — rank doctors
  within a branch using `RANK() OVER (PARTITION BY branch_id ORDER BY
  revenue DESC)` rather than sorting in Python/JS.
- **Appointments summary** benefits from `GROUP BY` with `FILTER (WHERE
  status = 'Completed')`-style conditional aggregation to get all three
  status counts in one query instead of three separate queries.
- Consider a Postgres **materialized view** for the heavier reports
  (doctor revenue, insurance vs out-of-pocket) refreshed on a schedule
  (`REFRESH MATERIALIZED VIEW CONCURRENTLY`), since PERF-4 allows up to 10
  seconds for report generation over a year of data and explicitly
  suggests pre-aggregation if raw queries are too slow.
- **Outstanding balances** reuses the same aggregation pattern as the
  invoice endpoint's outstanding-balance query — factor it into a shared
  SQL view (`CREATE VIEW v_invoice_outstanding AS ...`) so both the
  Billing endpoint and this report query the same logic instead of
  duplicating it.

---

## 13. Audit Log

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/audit-logs` | filter `?staff_id=&action_type=&table_affected=&from=&to=&record_id=` | A, QA |
| GET | `/audit-logs/{log_id}` | full detail incl. `details` JSON diff | A, QA |

**SQL notes:** don't write audit rows from the API layer as an
afterthought — either use a generic Postgres trigger pattern (a single
reusable trigger function attached to every audited table, reading
`TG_TABLE_NAME`/`TG_OP` and the old/new row via `to_jsonb()`), or have the
application layer write the audit row inside the *same transaction* as
the action it's logging. Never fire-and-forget the audit insert
separately — a failed audit write should roll back the action it was
supposed to record, not silently vanish.

---

## 14. Roles (reference)

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/roles` | list all role names (populates the role dropdown when creating a `user_account`) | A |
