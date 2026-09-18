-- Migration: Doctor & Access Control
-- Tables: staff_phone, doctor, doctor_specialty, user_account


CREATE TYPE account_status_enum AS ENUM (
    'Active',
    'Disabled'
);


CREATE TABLE staff_phone (
    phone_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id        INTEGER NOT NULL,
    phone_number    VARCHAR(20) NOT NULL,
    phone_type      phone_type_enum NOT NULL,
    CONSTRAINT fk_staff_phone_staff
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
        ON DELETE CASCADE
);


CREATE TABLE doctor (
    staff_id             INTEGER PRIMARY KEY,
    license_no           VARCHAR(50) NOT NULL,
    years_of_experience  INTEGER NOT NULL DEFAULT 0
                         CHECK (years_of_experience >= 0),
    consultation_fee     NUMERIC(10, 2) NOT NULL DEFAULT 0
                         CHECK (consultation_fee >= 0),
    qualifications       TEXT,
    CONSTRAINT uq_doctor_license_no UNIQUE (license_no),
    CONSTRAINT fk_doctor_staff
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
        ON DELETE CASCADE
);


CREATE TABLE doctor_specialty (
    staff_id        INTEGER NOT NULL,
    specialty_id    INTEGER NOT NULL,
    PRIMARY KEY (staff_id, specialty_id),
    CONSTRAINT fk_doctor_specialty_doctor
        FOREIGN KEY (staff_id) REFERENCES doctor(staff_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_doctor_specialty_specialty
        FOREIGN KEY (specialty_id) REFERENCES specialty(specialty_id)
        ON DELETE RESTRICT
);


-- Subtype of staff. Holds ONLY login-specific columns.
CREATE TABLE user_account (
    staff_id        INTEGER PRIMARY KEY,
    username        VARCHAR(50) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         INTEGER NOT NULL,
    account_status  account_status_enum NOT NULL DEFAULT 'Active',
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_account_username UNIQUE (username),
    CONSTRAINT fk_user_account_staff
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_user_account_role
        FOREIGN KEY (role_id) REFERENCES role(role_id)
        ON DELETE RESTRICT
);


ALTER TABLE branch
    ADD CONSTRAINT fk_branch_manager
    FOREIGN KEY (manager_staff_id) REFERENCES user_account(staff_id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;


-- Cascade deletes on staff_phone + phone lookups by staff
CREATE INDEX idx_staff_phone_staff_id ON staff_phone (staff_id);

-- "Which doctors have specialty X?" — used by booking dropdowns
CREATE INDEX idx_doctor_specialty_specialty_id
    ON doctor_specialty (specialty_id);

-- Role-based queries (e.g. "list all Doctor accounts in branch Y")
CREATE INDEX idx_user_account_role_id ON user_account (role_id);


-- Rule: a user_account whose role is 'Doctor' must map to a real doctor row.
CREATE OR REPLACE FUNCTION fn_user_role_doctor_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_role_name role_name_enum;
BEGIN
    SELECT role_name INTO v_role_name
    FROM role
    WHERE role_id = NEW.role_id;

    -- Enforce: Doctor-role account requires a doctor record
    IF v_role_name = 'Doctor' THEN
        IF NOT EXISTS (
            SELECT 1 FROM doctor WHERE staff_id = NEW.staff_id
        ) THEN
            RAISE EXCEPTION
                'Cannot assign Doctor role to staff_id % — no matching doctor record exists. Create the doctor record first.',
                NEW.staff_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_role_doctor_consistency
    BEFORE INSERT OR UPDATE OF role_id ON user_account
    FOR EACH ROW
    EXECUTE FUNCTION fn_user_role_doctor_consistency();


COMMENT ON TABLE staff_phone IS
    'Multivalued phone numbers for staff. ON DELETE CASCADE from staff.';
COMMENT ON TABLE doctor IS
    'Subtype of staff. PK = FK to staff. Carries license_no, years_of_experience, consultation_fee, qualifications.';
COMMENT ON TABLE doctor_specialty IS
    'Doctor↔Specialty M:N. FK to doctor (not staff) prevents non-doctors getting specialties.';
COMMENT ON TABLE user_account IS
    'Login + role for staff. password_hash NOT NULL (one-way hash).';
COMMENT ON TRIGGER trg_user_role_doctor_consistency ON user_account IS
    'A Doctor-role account must map to a real doctor row. Fires on INSERT and role_id UPDATE.';
    