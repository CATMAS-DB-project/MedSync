


CREATE TABLE invoice (
    invoice_id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    appointment_id              INTEGER NOT NULL,
    subtotal_amount             NUMERIC(10, 2) NOT NULL DEFAULT 0
                                CHECK (subtotal_amount >= 0),
    insurance_deduction         NUMERIC(10, 2) NOT NULL DEFAULT 0
                                CHECK (insurance_deduction >= 0),
    manual_discount             NUMERIC(10, 2) NOT NULL DEFAULT 0
                                CHECK (manual_discount >= 0),
    status                      invoice_status_enum NOT NULL DEFAULT 'Draft',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_by_staff_id       INTEGER,

    CONSTRAINT uq_invoice_appointment UNIQUE (appointment_id),
    CONSTRAINT fk_invoice_appointment
        FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_finalized_by
        FOREIGN KEY (finalized_by_staff_id) REFERENCES user_account(staff_id)
        ON DELETE SET NULL,

    -- BR-4-adjacent sanity: deductions can't exceed subtotal
    CONSTRAINT chk_invoice_deductions_within_subtotal
        CHECK (insurance_deduction + manual_discount <= subtotal_amount)
);


CREATE TABLE payment (
    payment_id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id              INTEGER NOT NULL,
    amount_paid             NUMERIC(10, 2) NOT NULL CHECK (amount_paid > 0),
    payment_method          payment_method_enum NOT NULL,
    payment_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_by_staff_id   INTEGER NOT NULL,

    CONSTRAINT fk_payment_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_payment_processed_by
        FOREIGN KEY (processed_by_staff_id) REFERENCES user_account(staff_id)
        ON DELETE RESTRICT
);


CREATE TABLE insurance_claim (
    claim_id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_id              INTEGER NOT NULL,
    policy_id               VARCHAR(30) NOT NULL,
    claimed_amount          NUMERIC(10, 2) NOT NULL CHECK (claimed_amount > 0),
    approved_amount         NUMERIC(10, 2) CHECK (approved_amount >= 0),
    verification_status     claim_verification_status_enum NOT NULL DEFAULT 'Pending',
    verification_date       TIMESTAMPTZ,

    CONSTRAINT uq_claim_invoice UNIQUE (invoice_id),
    CONSTRAINT fk_claim_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_claim_policy
        FOREIGN KEY (policy_id) REFERENCES insurance(policy_id)
        ON DELETE RESTRICT
);


CREATE TABLE audit_log (
    log_id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id                INTEGER NOT NULL,
    action_type             audit_action_enum NOT NULL,
    table_affected          VARCHAR(50) NOT NULL,
    record_id_affected      VARCHAR(30) NOT NULL,
    log_timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details                 JSONB,

    CONSTRAINT fk_audit_log_staff
        FOREIGN KEY (staff_id) REFERENCES user_account(staff_id)
        ON DELETE RESTRICT
);



-- Billing Queue view filters by status (Draft/Finalized/etc.)
CREATE INDEX idx_invoice_status ON invoice (status);

-- "Find the invoice for this appointment" (Booking + Consultation screens)
-- (already indexed by uq_invoice_appointment, no extra index needed)

-- Payment history per invoice (used by GET /invoices/{id}/payments)
CREATE INDEX idx_payment_invoice_id ON payment (invoice_id);

-- Claims queue filtered by status
CREATE INDEX idx_claim_status ON insurance_claim (verification_status);

-- Claims for a specific policy (used by insurance reports)
CREATE INDEX idx_claim_policy_id ON insurance_claim (policy_id);

-- Audit log filters — the Audit Log page queries by staff + time range
CREATE INDEX idx_audit_log_staff_time ON audit_log (staff_id, log_timestamp);

-- Audit log filter by table (e.g. "show all invoice changes")
CREATE INDEX idx_audit_log_table_time ON audit_log (table_affected, log_timestamp);


-- -----------------------------------------------------------------------------
-- TRIGGER 1: trg_auto_create_invoice (REQ-BILL-1)
-- Fires AFTER UPDATE on appointment when status transitions to 'Completed'.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_auto_create_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only fire on the transition into 'Completed'
    IF NEW.status = 'Completed' AND OLD.status IS DISTINCT FROM 'Completed' THEN
        INSERT INTO invoice (appointment_id, subtotal_amount, status)
        VALUES (NEW.appointment_id, 0, 'Draft')
        ON CONFLICT (appointment_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_invoice
    AFTER UPDATE ON appointment
    FOR EACH ROW
    EXECUTE FUNCTION fn_auto_create_invoice();

-- -----------------------------------------------------------------------------
-- TRIGGER 2: trg_claim_amount_check_insert (BR-4)
-- Rejects any claim insert where approved_amount > claimed_amount.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_claim_amount_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.approved_amount IS NOT NULL
       AND NEW.approved_amount > NEW.claimed_amount THEN
        RAISE EXCEPTION
            'approved_amount (%) cannot exceed claimed_amount (%)',
            NEW.approved_amount, NEW.claimed_amount
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_claim_amount_check_insert
    BEFORE INSERT ON insurance_claim
    FOR EACH ROW
    EXECUTE FUNCTION fn_claim_amount_check();

-- -----------------------------------------------------------------------------
-- TRIGGER 3: trg_claim_amount_check_update (BR-4)
-- Same rule on UPDATE — the claim's approved_amount typically arrives later
-- via an UPDATE once the mock insurance API responds.
-- -----------------------------------------------------------------------------

CREATE TRIGGER trg_claim_amount_check_update
    BEFORE UPDATE ON insurance_claim
    FOR EACH ROW
    EXECUTE FUNCTION fn_claim_amount_check();

-- -----------------------------------------------------------------------------
-- TRIGGER 4+5+6: fn_audit_log() — generic reusable audit trigger
-- (SEC-3, REQ-BILL-4)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_staff_id      INTEGER;
    v_action        audit_action_enum;
    v_record_id     VARCHAR(30);
    v_details       JSONB;
BEGIN
    -- Resolve action
    IF TG_OP = 'INSERT' THEN
        v_action := 'Create';
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'Update';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'Delete';
    END IF;

    -- Extract record_id from the appropriate PK column, per table.
    -- (Generic approach requires a per-table CASE — no way to discover the
    -- PK column name from within a generic trigger function.)
    BEGIN
        CASE TG_TABLE_NAME
            WHEN 'patient' THEN
                v_record_id := COALESCE(NEW.patient_id, OLD.patient_id)::VARCHAR;
            WHEN 'appointment_treatment' THEN
                v_record_id := COALESCE(NEW.appointment_treatment_id,
                                        OLD.appointment_treatment_id)::VARCHAR;
            WHEN 'invoice' THEN
                v_record_id := COALESCE(NEW.invoice_id, OLD.invoice_id)::VARCHAR;
            ELSE
                v_record_id := 'unknown';
        END CASE;
    EXCEPTION WHEN OTHERS THEN
        v_record_id := 'unknown';
    END;

    -- Resolve acting staff from session var
    BEGIN
        v_staff_id := current_setting('app.current_staff_id', true)::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_staff_id := NULL;
    END;

    if v_staff_id IS NULL THEN
        RAISE EXCEPTION
            'Audit trigger on %.% requires app.current _staff_id to be set. '
            'Run SET LOCAL app.current_staff_id = <id> before the DML, '
            'or wrap it in with_transaction(staff_id=<id>).',
            TG_TABLE_SCHEMA, TG_TABLE_NAME
            USING ERRCODE = 'check_violation';
    END IF;

    -- Build old/new diff
    IF TG_OP = 'INSERT' THEN
        v_details := jsonb_build_object('new', to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
        v_details := jsonb_build_object('old', to_jsonb(OLD));
    ELSE
        v_details := jsonb_build_object(
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW)
        );
    END IF;

    INSERT INTO audit_log (
        staff_id, action_type, table_affected, record_id_affected, details
    ) VALUES (
        v_staff_id, v_action, TG_TABLE_NAME, v_record_id, v_details
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to the audited tables (per SEC-3 + REQ-BILL-4)
CREATE TRIGGER trg_audit_patient
    AFTER INSERT OR UPDATE OR DELETE ON patient
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_appointment_treatment
    AFTER INSERT OR UPDATE OR DELETE ON appointment_treatment
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_invoice
    AFTER INSERT OR UPDATE OR DELETE ON invoice
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();


COMMENT ON TABLE invoice IS
    'One per completed appointment. payable_amount = subtotal - insurance_deduction - manual_discount, computed in queries (3NF).';
COMMENT ON TABLE payment IS
    'Append-only. No UPDATE/DELETE triggers — API layer must not expose those verbs.';
COMMENT ON TABLE insurance_claim IS
    'At most one claim per invoice. approved_amount <= claimed_amount enforced by trigger.';
COMMENT ON TABLE audit_log IS
    'Cross-cutting audit trail. Populated by fn_audit_log() attached to audited tables.';

COMMENT ON TRIGGER trg_auto_create_invoice ON appointment IS
    'REQ-BILL-1 — creates an empty Draft invoice when appointment status transitions to Completed.';
COMMENT ON TRIGGER trg_claim_amount_check_insert ON insurance_claim IS
    'BR-4 — approved_amount cannot exceed claimed_amount on INSERT.';
COMMENT ON TRIGGER trg_claim_amount_check_update ON insurance_claim IS
    'BR-4 — same check on UPDATE (approved_amount usually arrives via UPDATE).';
COMMENT ON TRIGGER trg_audit_patient ON patient IS
    'SEC-3 — audit trail for patient record changes.';
COMMENT ON TRIGGER trg_audit_appointment_treatment ON appointment_treatment IS
    'SEC-3 — audit trail for treatment records.';
COMMENT ON TRIGGER trg_audit_invoice ON invoice IS
    'REQ-BILL-4 — audit trail for invoice draft/finalize/settle actions.';
