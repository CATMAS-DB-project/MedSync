-- Migration: Seed Reference Data
-- Purpose: insert the fixed reference rows every environment needs.
--   - 5 roles (matches role_name_enum exactly)
--   - 3 branches (Colombo, Kandy, Galle) per SRS §1.4
--   - 8 specialties, 10 treatment catalogue items

INSERT INTO role (role_name) VALUES
    ('Admin'),
    ('Branch Manager'),
    ('Receptionist'),
    ('Doctor'),
    ('QA Tester')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO branch (branch_name, address, contact_number) VALUES
    ('Colombo', '123 Galle Road, Colombo 03, Sri Lanka', '+94112345678'),
    ('Kandy',   '45 Peradeniya Road, Kandy, Sri Lanka',  '+94812345678'),
    ('Galle',   '10 Wackwella Road, Galle, Sri Lanka',   '+94912345678')
ON CONFLICT (branch_name) DO NOTHING;

INSERT INTO specialty (specialty_name) VALUES
    ('General Medicine'),
    ('ENT'),
    ('Paediatrics'),
    ('Cardiology'),
    ('Dermatology'),
    ('Orthopaedics'),
    ('Obstetrics & Gynaecology'),
    ('Radiology')
ON CONFLICT (specialty_name) DO NOTHING;

INSERT INTO treatment_catalogue (service_code, treatment_name, unit_price, category) VALUES
    ('CON-001', 'General Consultation',     1500.00, 'Consultation'),
    ('CON-002', 'Specialist Consultation',  3000.00, 'Consultation'),
    ('XR-001',  'Chest X-Ray',              2500.00, 'Radiology'),
    ('XR-002',  'Bone X-Ray',               2200.00, 'Radiology'),
    ('ECG-001', 'Electrocardiogram (ECG)',  3500.00, 'Cardiology'),
    ('INJ-001', 'Injection (Intramuscular)', 800.00, 'Procedure'),
    ('INJ-002', 'IV Drip',                  2500.00, 'Procedure'),
    ('BLD-001', 'Full Blood Count',         1200.00, 'Laboratory'),
    ('BLD-002', 'Lipid Profile',            1800.00, 'Laboratory'),
    ('DRG-001', 'Wound Dressing',           1000.00, 'Procedure')
ON CONFLICT (service_code) DO NOTHING;

-- Stable accounts used by backend integration tests.
-- Password for all seeded test accounts: admin123
DO $$
DECLARE
    v_manager_role_id role.role_id%TYPE;
    v_doctor_role_id role.role_id%TYPE;
    v_qa_role_id role.role_id%TYPE;
    v_colombo_branch_id branch.branch_id%TYPE;
    v_test_branch_id branch.branch_id%TYPE;
    v_manager_staff_id staff.staff_id%TYPE;
    v_doctor_staff_id staff.staff_id%TYPE;
    v_qa_staff_id staff.staff_id%TYPE;
    v_password_hash CONSTANT TEXT :=
        '$argon2id$v=19$m=65536,t=3,p=4$Exu+4bUXbDcdtEUOfOOsgQ$xJAZ2zNoh+BwAKDHAOKUqO89nSUA0Hh8CRuwGNPYgOo';
BEGIN
    SELECT role_id INTO v_manager_role_id
    FROM role
    WHERE role_name = 'Branch Manager';

    SELECT role_id INTO v_doctor_role_id
    FROM role
    WHERE role_name = 'Doctor';

    SELECT role_id INTO v_qa_role_id
    FROM role
    WHERE role_name = 'QA Tester';

    SELECT branch_id INTO v_test_branch_id
    FROM branch
    WHERE branch_name = 'Test Branch';

    SELECT branch_id INTO v_colombo_branch_id
    FROM branch
    WHERE branch_name = 'Colombo';

    INSERT INTO staff (
        nic, first_name, last_name, date_of_birth, gender, address,
        branch_id, job_title, employment_status, hire_date
    )
    VALUES (
        'TEST-NIMAL-001', 'Nimal', 'Perera', DATE '1987-04-12',
        'Male', 'Automated testing environment', v_colombo_branch_id,
        'Nurse', 'Active', DATE '2024-01-01'
    )
    ON CONFLICT (nic) DO NOTHING;

    INSERT INTO staff (
        nic, first_name, last_name, date_of_birth, gender, address,
        branch_id, job_title, employment_status, hire_date
    )
    VALUES (
        'TEST-BM-001', 'Test', 'Branch Manager', DATE '1985-02-14',
        'Female', 'Automated testing environment', v_test_branch_id,
        'Branch Manager', 'Active', DATE '2024-01-01'
    )
    ON CONFLICT (nic) DO NOTHING;

    SELECT staff_id INTO v_manager_staff_id
    FROM staff
    WHERE nic = 'TEST-BM-001';

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    VALUES (
        v_manager_staff_id, 'bm', v_password_hash, v_manager_role_id
    )
    ON CONFLICT (username) DO NOTHING;

    UPDATE branch
    SET manager_staff_id = v_manager_staff_id
    WHERE branch_id = v_test_branch_id;

    INSERT INTO staff (
        nic, first_name, last_name, date_of_birth, gender, address,
        branch_id, job_title, employment_status, hire_date
    )
    VALUES (
        'TEST-DOCTOR-001', 'Test', 'Doctor', DATE '1980-08-08',
        'Male', 'Automated testing environment', v_test_branch_id,
        'Doctor', 'Active', DATE '2024-01-01'
    )
    ON CONFLICT (nic) DO NOTHING;

    SELECT staff_id INTO v_doctor_staff_id
    FROM staff
    WHERE nic = 'TEST-DOCTOR-001';

    INSERT INTO doctor (
        staff_id, license_no, years_of_experience, consultation_fee,
        qualifications
    )
    VALUES (
        v_doctor_staff_id, 'TEST-LIC-001', 10, 2500.00,
        'MBBS - Automated Test Doctor'
    )
    ON CONFLICT (staff_id) DO NOTHING;

    INSERT INTO doctor_specialty (staff_id, specialty_id)
    SELECT v_doctor_staff_id, specialty_id
    FROM specialty
    WHERE specialty_name IN ('General Medicine', 'Cardiology')
    ON CONFLICT (staff_id, specialty_id) DO NOTHING;

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    VALUES (
        v_doctor_staff_id, 'doctor', v_password_hash, v_doctor_role_id
    )
    ON CONFLICT (username) DO NOTHING;

    INSERT INTO staff (
        nic, first_name, last_name, date_of_birth, gender, address,
        branch_id, job_title, employment_status, hire_date
    )
    VALUES (
        'TEST-QA-001', 'Test', 'QA', DATE '1993-03-03',
        'Other', 'Automated testing environment', v_test_branch_id,
        'QA Tester', 'Active', DATE '2024-01-01'
    )
    ON CONFLICT (nic) DO NOTHING;

    SELECT staff_id INTO v_qa_staff_id
    FROM staff
    WHERE nic = 'TEST-QA-001';

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    VALUES (
        v_qa_staff_id, 'qa', v_password_hash, v_qa_role_id
    )
    ON CONFLICT (username) DO NOTHING;
END;
$$;

ANALYZE role;
ANALYZE branch;
ANALYZE specialty;
ANALYZE treatment_catalogue;
ANALYZE staff;
ANALYZE doctor;
ANALYZE doctor_specialty;
ANALYZE user_account;
ANALYZE staff_phone;
ANALYZE patient;
ANALYZE patient_phone;
ANALYZE guardian;
ANALYZE guardian_phone;
ANALYZE patient_guardian;
ANALYZE insurance;
ANALYZE appointment;
ANALYZE appointment_treatment;
ANALYZE invoice;
ANALYZE payment;
ANALYZE insurance_claim;
ANALYZE audit_log;
