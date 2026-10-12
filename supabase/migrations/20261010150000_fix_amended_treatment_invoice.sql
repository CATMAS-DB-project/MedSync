-- Keep draft invoice totals aligned with treatment amendments, including
-- amendments that intentionally remove a mistakenly added treatment.

CREATE OR REPLACE FUNCTION fn_sync_invoice_treatment_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_appointment_id INTEGER;
    v_consultation_fee NUMERIC(10, 2);
    v_treatment_total NUMERIC(10, 2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_appointment_id := OLD.appointment_id;
    ELSE
        v_appointment_id := NEW.appointment_id;
    END IF;

    SELECT d.consultation_fee
    INTO v_consultation_fee
    FROM appointment a
    JOIN doctor d ON d.staff_id = a.doctor_staff_id
    WHERE a.appointment_id = v_appointment_id;

    SELECT COALESCE(SUM(at.price_at_time), 0)
    INTO v_treatment_total
    FROM appointment_treatment at
    WHERE at.appointment_id = v_appointment_id
      AND NOT EXISTS (
          SELECT 1
          FROM appointment_treatment amendment
          WHERE amendment.original_record_id = at.appointment_treatment_id
      );

    UPDATE invoice
    SET subtotal_amount = COALESCE(v_consultation_fee, 0) + v_treatment_total
    WHERE appointment_id = v_appointment_id
      AND status = 'Draft';

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_treatment_to_invoice ON appointment_treatment;

CREATE TRIGGER trg_add_treatment_to_invoice
    AFTER INSERT OR DELETE ON appointment_treatment
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_invoice_treatment_total();

COMMENT ON TRIGGER trg_add_treatment_to_invoice ON appointment_treatment IS
    'Recalculates the Draft invoice from the consultation fee and effective, non-superseded treatments.';
