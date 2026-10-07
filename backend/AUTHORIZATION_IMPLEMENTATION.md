# Authorization and Branch Ownership Implementation

## Purpose

This document records the authorization changes implemented after reviewing
the branch-isolation audit against the CATMS SRS.

The initial audit proposed a blanket rule:

> Only Admin may read or modify records across every branch. All other roles
> must be restricted to their own branch.

That rule was not implemented wholesale because it conflicts with the SRS
requirements for cross-branch patient lookup:

- `REQ-PM-2`: patient records must be accessible across branches.
- `SAFE-5`: patient information must be retrievable at any branch during
  walk-in or emergency treatment.
- `BR-5`: emergency walk-ins may occur at a branch different from the
  patient's registering branch.

The implemented policy therefore distinguishes **cross-branch reads** from
**writes and role ownership**.

## Final policy

### Cross-branch reads

Cross-branch reads remain allowed where the SRS requires them, including:

- Patient search and patient profiles.
- Patient guardians and related patient information.
- Doctor lookup for booking and referrals.
- Appointment lookup where the caller's role permits it.
- QA access to audit records for system validation.

### Branch-owned writes

For non-Admin users, branch ownership is derived from the authenticated
identity rather than trusted from request data.

- Patient registration uses the authenticated user's branch.
- Appointment creation validates the authenticated user's branch.
- Billing writes validate the related appointment or invoice branch.
- Receptionist patient updates and patient subresource writes (phones,
  guardians, and insurance) require the patient's registered branch to match
  the authenticated Receptionist's branch.

### Role ownership

Branch checks alone are not sufficient. Role-specific ownership is also
enforced:

- Doctors can act only on appointments assigned to themselves.
- Doctors can add or amend treatments only for their own appointments.
- Doctors can update consultation notes only for their own appointments.
- Only Receptionists can perform the billing operations defined by the SRS.
- Admin retains unrestricted access where the endpoint permits Admin.

## Implemented changes

### Patient registration

File: [`app/domains/patients/router.py`](./app/domains/patients/router.py)

`POST /patients` no longer trusts a client-provided
`registered_branch_id`. The route sets the branch from the authenticated
Receptionist's `branch_id` before calling the service.

This prevents a Receptionist from registering a patient as belonging to an
arbitrary branch while preserving cross-branch patient lookup afterward.

Patient reads continue to support the SRS-required cross-branch behavior.

### Appointment creation and lookup

Files:

- [`app/domains/appointment/router.py`](./app/domains/appointment/router.py)
- [`app/domains/appointment/service.py`](./app/domains/appointment/service.py)

Appointment creation now:

- Derives the effective branch from the authenticated non-Admin caller.
- Rejects a caller without an assigned branch.
- Verifies that the selected patient exists. A patient may be treated at a
  different branch for emergency or walk-in care.
- Validates that the selected doctor belongs to the appointment branch.

Appointment listing and detail operations now apply doctor ownership when
the caller is a Doctor. A Doctor's queries are scoped to that doctor's own
appointments rather than all doctors' appointments.

Appointment cancellation remains Receptionist-only. Appointment completion
remains Doctor-only and verifies that the appointment belongs to the
authenticated doctor.

### Appointment treatments and notes

Files:

- [`app/domains/appointment_treatment/router.py`](./app/domains/appointment_treatment/router.py)
- [`app/domains/appointment_treatment/service.py`](./app/domains/appointment_treatment/service.py)

Doctor ownership is enforced for:

- Listing treatments for an appointment.
- Adding a treatment.
- Amending a treatment.
- Updating consultation notes.

The service queries include the caller's doctor ID when the operation is
performed by a Doctor. This ensures that checking an appointment ID alone
cannot permit a Doctor to modify another Doctor's appointment.

### Billing writes

File: [`app/domains/billing/router.py`](./app/domains/billing/router.py)

Billing operations remain limited to the roles specified by the SRS.
Write operations now validate the branch of the related appointment or
invoice before proceeding.

This covers:

- Invoice finalization.
- Payment creation.
- Insurance claim creation.
- Insurance claim verification.

Billing reads preserve the intended role-based behavior, while write
operations cannot be redirected to an unrelated branch through an arbitrary
invoice or claim ID.

### Staff and doctor reads

File: [`app/domains/staff/router.py`](./app/domains/staff/router.py)

The earlier blanket branch restriction for doctor reads was removed because
the SRS supports doctor lookup for booking and referrals. Staff-management
operations that are explicitly branch-manager scoped remain protected.

Admin behavior remains unrestricted only on endpoints whose route explicitly
lists `Admin`. Admin is not implicitly added to Receptionist-only patient,
appointment-booking, or billing-write routes; this preserves the SRS role
lists and existing project convention.

## Deliberate design decisions

### Do not enforce tenant-style isolation on all reads

CATMS is not treated as a strict tenant-isolated SaaS application. A patient
may receive care at any branch, so staff must be able to locate the patient's
existing record during an emergency or walk-in visit.

### Do not trust branch IDs from clients

Branch IDs are still accepted where they are useful for filtering or Admin
operations, but ownership for non-Admin writes comes from the authenticated
user and related database records.

### Validate related records, not just request IDs

An appointment, invoice, payment, claim, patient, or treatment ID is not
treated as proof that the caller may operate on the record. Authorization
checks resolve the related branch and, where required, the assigned doctor.

### Preserve Admin behavior

Admin users retain cross-branch access for endpoints where Admin is an
allowed role. The new checks are intended to constrain non-Admin writes and
role-owned actions, not to reduce existing Admin capabilities.

### Return resource-not-found for inaccessible appointment details

Appointment detail lookups that fail the ownership scope return the existing
not-found behavior rather than exposing whether another doctor's appointment
exists.

## Tests added or updated

File: [`tests/test_branch_access.py`](./tests/test_branch_access.py)

The focused tests now verify:

- Branch Manager staff-list restrictions remain enforced.
- Admin staff listing remains unrestricted.
- Branch Manager cannot create staff in another branch.
- Branch Manager cannot access staff from another branch.
- Patient branch filters remain available for cross-branch reads.
- Doctor branch filters remain available for cross-branch reads.

The tests use mocked asynchronous database connections and service calls, so
they validate authorization decisions without requiring a running PostgreSQL
instance.

## Validation performed

The following checks passed after implementation:

```text
9 focused authorization and authentication tests passed
Ruff checks passed for changed authorization files and tests
Python compilation passed
Pylance diagnostics reported no errors
git diff --check passed
```

The broader integration suite still requires the configured PostgreSQL
service. It cannot complete when the database host is unavailable.

A real-database validation script is available at
[`scripts/authorization_test.sh`](./scripts/authorization_test.sh). It uses
environment-provided tokens and IDs to verify cross-branch patient reads,
Receptionist cross-branch write rejection, server-side appointment branch
derivation, and Doctor appointment ownership without inventing test data.

## Known scope and follow-up

The endpoint markdown lists report and appointment reschedule endpoints that
are not currently implemented in `app/domains`. Their authorization cannot
be validated until their routes exist.

When those endpoints are implemented:

1. Apply the same role checks at the route boundary.
2. Derive branch ownership from the authenticated user for non-Admin writes.
3. Add doctor ownership checks where a Doctor acts on an appointment.
4. Preserve cross-branch patient lookup required by `REQ-PM-2`, `SAFE-5`,
   and `BR-5`.
