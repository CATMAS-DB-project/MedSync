-- VIEW: v_invoice_outstanding
-- Per-invoice: payable, paid, outstanding.
-- The "payable" formula appears here ONCE; every consumer reads it from here.

CREATE OR REPLACE VIEW v_invoice_outstanding AS
SELECT
    i.invoice_id,
    i.appointment_id,
    i.status,
    i.subtotal_amount,
    i.insurance_deduction,
    i.manual_discount,
    (i.subtotal_amount - i.insurance_deduction - i.manual_discount)
        AS payable_amount,
    COALESCE(p.total_paid, 0) AS amount_paid,
    (i.subtotal_amount - i.insurance_deduction - i.manual_discount)
        - COALESCE(p.total_paid, 0) AS outstanding_amount
FROM invoice i
LEFT JOIN (
    SELECT invoice_id, SUM(amount_paid) AS total_paid
    FROM payment
    GROUP BY invoice_id
) p ON p.invoice_id = i.invoice_id;

COMMENT ON VIEW v_invoice_outstanding IS
    'Per-invoice payable / paid / outstanding. Shared by Billing and Reports — single source for the outstanding formula.';

-- VIEW: v_patient_profile
-- Full patient profile in one row: demographics + phones + guardians +
-- insurance policies, each as a JSONB array. One query for GET /patients/{id}.


CREATE OR REPLACE VIEW v_patient_profile AS
SELECT
    p.patient_id,
    p.nic_passport_no,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.gender,
    p.address,
    p.registered_branch_id,
    b.branch_name AS registered_branch_name,
    p.created_at,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'phone_id',     pp.phone_id,
                    'phone_number', pp.phone_number,
                    'phone_type',   pp.phone_type
                ) ORDER BY pp.phone_id
            )
            FROM patient_phone pp
            WHERE pp.patient_id = p.patient_id
        ),
        '[]'::jsonb
    ) AS phones,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'guardian_id',  g.guardian_id,
                    'first_name',   g.first_name,
                    'last_name',    g.last_name,
                    'nic',          g.nic,
                    'relationship', pg.relationship
                ) ORDER BY g.guardian_id
            )
            FROM patient_guardian pg
            JOIN guardian g ON g.guardian_id = pg.guardian_id
            WHERE pg.patient_id = p.patient_id
        ),
        '[]'::jsonb
    ) AS guardians,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'policy_id',      ins.policy_id,
                    'provider_name',  ins.provider_name,
                    'coverage_level', ins.coverage_level,
                    'status',         ins.status
                ) ORDER BY ins.policy_id
            )
            FROM insurance ins
            WHERE ins.patient_id = p.patient_id
        ),
        '[]'::jsonb
    ) AS insurance_policies
FROM patient p
JOIN branch b ON b.branch_id = p.registered_branch_id;

COMMENT ON VIEW v_patient_profile IS
    'Patient + phones + guardians + insurance in one row, arrays as JSONB. Backs GET /patients/{id}.';


-- VIEW: v_appointment_detail
-- Appointment enriched with patient name, doctor name, branch name, and
-- the owning invoice_id (if any). Avoids repeating the same 4 joins
-- everywhere an appointment needs to be displayed.


CREATE OR REPLACE VIEW v_appointment_detail AS
SELECT
    a.appointment_id,
    a.patient_id,
    p.first_name AS patient_first_name,
    p.last_name AS patient_last_name,
    p.first_name || ' ' || p.last_name AS patient_name,
    p.nic_passport_no AS patient_nic,
    a.doctor_staff_id,
    s.first_name AS doctor_first_name,
    s.last_name AS doctor_last_name,
    s.first_name || ' ' || s.last_name AS doctor_name,
    a.branch_id,
    b.branch_name,
    a.booked_by_staff_id,
    a.appointment_date,
    a.appointment_time,
    a.status,
    a.is_walk_in,
    a.cancel_reschedule_reason,
    a.consultation_notes,
    a.created_at,
    i.invoice_id
FROM appointment a
JOIN patient p ON p.patient_id = a.patient_id
JOIN doctor d ON d.staff_id = a.doctor_staff_id
JOIN staff s ON s.staff_id = d.staff_id
JOIN branch b ON b.branch_id = a.branch_id
LEFT JOIN invoice i ON i.appointment_id = a.appointment_id;

COMMENT ON VIEW v_appointment_detail IS
    'Appointment + denormalized patient/doctor/branch names + invoice_id. patient_name/doctor_name are computed at query time (view, not stored) — never persisted as a redundant column. Backs appointment list/detail screens.';


-- VIEW: v_doctor_revenue
-- Row-level (one row per completed appointment with its invoice amount).
-- NOT aggregated — the report endpoint adds date filters + SUM + RANK() OVER.
-- Aggregating here would prevent efficient date-range filtering.


CREATE OR REPLACE VIEW v_doctor_revenue AS
SELECT
    a.appointment_date,
    a.doctor_staff_id,
    s.first_name AS doctor_first_name,
    s.last_name AS doctor_last_name,
    s.first_name || ' ' || s.last_name AS doctor_name,
    a.branch_id,
    b.branch_name,
    a.appointment_id,
    i.invoice_id,
    i.subtotal_amount AS invoice_amount,
    i.insurance_deduction,
    i.manual_discount,
    (i.subtotal_amount - i.insurance_deduction - i.manual_discount)
        AS payable_amount
FROM appointment a
JOIN staff s ON s.staff_id = a.doctor_staff_id
JOIN branch b ON b.branch_id = a.branch_id
JOIN invoice i ON i.appointment_id = a.appointment_id
WHERE a.status = 'Completed';

COMMENT ON VIEW v_doctor_revenue IS
    'Row-level revenue facts (one row per completed appointment). Report endpoint applies date filter + SUM + RANK() OVER.';
