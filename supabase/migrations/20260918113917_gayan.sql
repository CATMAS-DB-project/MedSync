-- =============================================================================
-- Migration: Domain 4 — Appointment & Clinical Records
-- Tables: appointment, appointment_treatment
-- Depends on: Domain 1 (branch, treatment_catalogue), Domain 2 (doctor,
--             user_account), Domain 3 (patient)
-- Enforces: BR-1, BR-2, BR-5, BR-7 (partial — see note below), SAFE-1, PERF-6
-- Adds: 4 triggers, 1 partial unique index
--
-- CHANGE FROM PRIOR DESIGN: appointment_reschedule_log has been REMOVED.
-- It does not appear in the Final ERD. The full per-event reschedule
-- HISTORY (previous time -> new time, per occurrence) is no longer
-- tracked. What remains: appointment.cancel_reschedule_reason still
-- captures the reason for the MOST RECENT reschedule/cancel only, and
-- trg_appointment_overlap_update still fully enforces BR-7's actual rule
-- (re-validate the new slot against BR-1; block rescheduling a Completed
-- appointment) — losing the log table does not weaken that constraint,
-- it only removes the audit trail of past reschedule events.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: appointment
-- doctor_staff_id FKs to doctor (NOT staff) — guarantees only real doctors
-- can be booked. booked_by_staff_id FKs to user_account (NOT staff) —
-- guarantees only users with login access can create bookings.
-- -----------------------------------------------------------------------------

CREATE TABLE appointment (
    appointment_id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id                  INTEGER NOT NULL,
    doctor_staff_id             INTEGER NOT NULL,
    branch_id                   INTEGER NOT NULL,
    booked_by_staff_id          INTEGER NOT NULL,
    appointment_date            DATE NOT NULL,
    appointment_time            TIME NOT NULL,
    status                      appointment_status_enum NOT NULL DEFAULT 'Scheduled',
    is_walk_in                  BOOLEAN NOT NULL DEFAULT FALSE,
    cancel_reschedule_reason    VARCHAR(255),
    consultation_notes          TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_appointment_patient
        FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_appointment_doctor
        FOREIGN KEY (doctor_staff_id) REFERENCES doctor(staff_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_appointment_branch
        FOREIGN KEY (branch_id) REFERENCES branch(branch_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_appointment_booked_by
        FOREIGN KEY (booked_by_staff_id) REFERENCES user_account(staff_id)
        ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- PERF-6 / BR-1: The actual race-condition-proof mechanism.
-- Partial UNIQUE index — only non-Cancelled rows occupy the slot.
-- Two concurrent INSERTs for the same doctor/slot cannot both commit;
-- Postgres locks the index entry and rejects the second.
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX uq_appointment_doctor_active_slot
    ON appointment (doctor_staff_id, appointment_date, appointment_time)
    WHERE status != 'Cancelled';

-- -----------------------------------------------------------------------------
-- TABLE: appointment_treatment
-- M:N junction with real attributes. price_at_time is a DELIBERATE snapshot,
-- not a redundancy — historical invoices must not retroactively change when
-- the catalogue price changes.
-- original_record_id + is_amended + amendment_reason implement SAFE-1.
-- -----------------------------------------------------------------------------

CREATE TABLE appointment_treatment (
    appointment_treatment_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    appointment_id              INTEGER NOT NULL,
    service_code                VARCHAR(10) NOT NULL,
    price_at_time               NUMERIC(10, 2) NOT NULL CHECK (price_at_time >= 0),
    is_amended                  BOOLEAN NOT NULL DEFAULT FALSE,
    amendment_reason            VARCHAR(255),
    original_record_id          INTEGER,
    recorded_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_treatment_appointment
        FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_treatment_service
        FOREIGN KEY (service_code) REFERENCES treatment_catalogue(service_code)
        ON DELETE RESTRICT,
    CONSTRAINT fk_treatment_original
        FOREIGN KEY (original_record_id) REFERENCES appointment_treatment(appointment_treatment_id)
        ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Patient appointment history (used everywhere patient detail is shown)
CREATE INDEX idx_appointment_patient_id ON appointment (patient_id);

-- Supports REQ-RG-1's daily branch-wise summary without a full scan
CREATE INDEX idx_appointment_status_date ON appointment (status, appointment_date);

-- Supports branch-level appointment lists
CREATE INDEX idx_appointment_branch_date ON appointment (branch_id, appointment_date);

-- Fast lookup of treatments for a given visit
CREATE INDEX idx_appointment_treatment_appointment_id
    ON appointment_treatment (appointment_id);

-- "How often is service X used?" — feeds REQ-RG-4 report
CREATE INDEX idx_appointment_treatment_service_code
    ON appointment_treatment (service_code);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TRIGGER 1: trg_appointment_overlap_insert (BR-1 / BR-5)
-- Fires BEFORE INSERT. Rejects any non-Cancelled insert that collides with
-- an existing non-Cancelled appointment for the same doctor/date/time.
-- The partial UNIQUE index is the actual safety net; this trigger provides
-- a friendly error message and documents the rule in code.
-- Walk-ins go through the SAME path — is_walk_in is a flag, not a bypass (BR-5).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_appointment_overlap_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status != 'Cancelled' THEN
        IF EXISTS (
            SELECT 1 FROM appointment
            WHERE doctor_staff_id = NEW.doctor_staff_id
              AND appointment_date = NEW.appointment_date
              AND appointment_time = NEW.appointment_time
              AND status != 'Cancelled'
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

CREATE TRIGGER trg_appointment_overlap_insert
    BEFORE INSERT ON appointment
    FOR EACH ROW
    EXECUTE FUNCTION fn_appointment_overlap_insert();

-- -----------------------------------------------------------------------------
-- TRIGGER 2: trg_appointment_overlap_update (BR-7)
-- Fires BEFORE UPDATE when date or time is changing.
-- Two rules:
--   a. Reject any reschedule of an appointment already marked Completed.
--   b. Re-run the overlap check for the new slot.
-- This is BR-7's actual enforcement mechanism and is fully independent of
-- the (now removed) reschedule log table — the rule holds either way.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_appointment_overlap_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only fire when the slot is actually changing
    IF NEW.appointment_date = OLD.appointment_date
       AND NEW.appointment_time = OLD.appointment_time
       AND NEW.doctor_staff_id = OLD.doctor_staff_id THEN
        RETURN NEW;
    END IF;

    -- (a) Block reschedule of a Completed appointment
    IF OLD.status = 'Completed' THEN
        RAISE EXCEPTION
            'Cannot reschedule appointment % — it is already Completed',
            OLD.appointment_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- (b) Re-check the new slot (only if the NEW row will occupy a slot)
    IF NEW.status != 'Cancelled' THEN
        IF EXISTS (
            SELECT 1 FROM appointment
            WHERE doctor_staff_id = NEW.doctor_staff_id
              AND appointment_date = NEW.appointment_date
              AND appointment_time = NEW.appointment_time
              AND status != 'Cancelled'
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

CREATE TRIGGER trg_appointment_overlap_update
    BEFORE UPDATE ON appointment
    FOR EACH ROW
    EXECUTE FUNCTION fn_appointment_overlap_update();

-- -----------------------------------------------------------------------------
-- TRIGGER 3: trg_treatment_requires_completed (BR-2)
-- Fires BEFORE INSERT on appointment_treatment. Rejects any insert whose
-- appointment is not currently Completed. This is what makes BR-2 an
-- actual rule rather than a UI convention.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_treatment_requires_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_status appointment_status_enum;
BEGIN
    SELECT status INTO v_status
    FROM appointment
    WHERE appointment_id = NEW.appointment_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION
            'Appointment % does not exist', NEW.appointment_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_status != 'Completed' THEN
        RAISE EXCEPTION
            'Cannot log treatment against appointment % — status is % (must be Completed)',
            NEW.appointment_id, v_status
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_treatment_requires_completed
    BEFORE INSERT ON appointment_treatment
    FOR EACH ROW
    EXECUTE FUNCTION fn_treatment_requires_completed();

-- -----------------------------------------------------------------------------
-- TRIGGER 4: trg_prevent_treatment_delete (SAFE-1)
-- Rejects every DELETE on appointment_treatment. Corrections must go through
-- the amendment pattern (new row + original_record_id + amendment_reason).
-- This preserves the full clinical history.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_prevent_treatment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Deletion of appointment_treatment is not permitted (SAFE-1). Create an amendment instead.'
        USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER trg_prevent_treatment_delete
    BEFORE DELETE ON appointment_treatment
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_treatment_delete();

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------

COMMENT ON TABLE appointment IS
    'Central scheduling table. UNIQUE partial index on (doctor, date, time) WHERE status != Cancelled is the race-condition-proof slot guard. cancel_reschedule_reason holds only the most recent reschedule/cancel reason — no per-event history table exists (removed per the Final ERD).';
COMMENT ON TABLE appointment_treatment IS
    'price_at_time is a deliberate snapshot. DELETE is blocked; corrections use the amendment pattern (is_amended + original_record_id).';

COMMENT ON TRIGGER trg_appointment_overlap_insert ON appointment IS
    'BR-1/BR-5 — reject colliding inserts. Walk-ins go through the same check.';
COMMENT ON TRIGGER trg_appointment_overlap_update ON appointment IS
    'BR-7 — re-check overlap on reschedule, block rescheduling Completed appointments.';
COMMENT ON TRIGGER trg_treatment_requires_completed ON appointment_treatment IS
    'BR-2 — only Completed appointments may have treatments logged.';
COMMENT ON TRIGGER trg_prevent_treatment_delete ON appointment_treatment IS
    'SAFE-1 — every DELETE is rejected; corrections must use the amendment pattern.';
