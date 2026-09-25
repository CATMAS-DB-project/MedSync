-- Migration: Performance Indexes
-- Purpose: indexes NOT covered by UNIQUE constraints or PKs, supporting:


CREATE INDEX idx_patient_phone_number ON patient_phone (phone_number);
CREATE INDEX idx_guardian_phone_number ON guardian_phone (phone_number);
CREATE INDEX idx_staff_phone_number ON staff_phone (phone_number);


CREATE INDEX idx_treatment_catalogue_category
    ON treatment_catalogue (category);


CREATE INDEX idx_appointment_branch_date_status
    ON appointment (branch_id, appointment_date, status);


CREATE INDEX idx_appointment_doctor_status_date
    ON appointment (doctor_staff_id, status, appointment_date);


CREATE INDEX idx_appointment_treatment_recorded_at
    ON appointment_treatment (recorded_at);


CREATE INDEX idx_payment_payment_date ON payment (payment_date);


CREATE INDEX idx_audit_log_record_id
    ON audit_log (table_affected, record_id_affected);


CREATE INDEX idx_invoice_finalized_by
    ON invoice (finalized_by_staff_id)
    WHERE finalized_by_staff_id IS NOT NULL;


CREATE INDEX idx_payment_processed_by
    ON payment (processed_by_staff_id);


CREATE INDEX idx_appointment_treatment_original
    ON appointment_treatment (original_record_id)
    WHERE original_record_id IS NOT NULL;


CREATE INDEX idx_staff_branch_status
    ON staff (branch_id, employment_status);