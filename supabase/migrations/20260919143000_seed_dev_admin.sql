-- Shared reference and development seed data.
-- The identity columns generate staff_id, role_id, and branch_id automatically.
DO $$
DECLARE
    v_role_id   role.role_id%TYPE;
    v_branch_id branch.branch_id%TYPE;
    v_staff_id  staff.staff_id%TYPE;
    v_manager_role_id role.role_id%TYPE;
    v_receptionist_role_id role.role_id%TYPE;
    v_doctor_role_id role.role_id%TYPE;
    v_qa_role_id role.role_id%TYPE;
    v_second_branch_id branch.branch_id%TYPE;
    v_test_admin_staff_id staff.staff_id%TYPE;
    v_manager_staff_id staff.staff_id%TYPE;
    v_receptionist_staff_id staff.staff_id%TYPE;
    v_doctor_staff_id staff.staff_id%TYPE;
    v_qa_staff_id staff.staff_id%TYPE;
BEGIN
    INSERT INTO role (role_name)
    VALUES
        ('Admin'),
        ('Branch Manager'),
        ('Receptionist'),
        ('Doctor'),
        ('QA Tester')
    ON CONFLICT (role_name) DO NOTHING;

    INSERT INTO branch (branch_name, address, contact_number)
    VALUES
        ('Colombo', '123 Galle Road, Colombo 03, Sri Lanka', '+94112345678'),
        ('Kandy', '45 Peradeniya Road, Kandy, Sri Lanka', '+94812345678'),
        ('Galle', '10 Wackwella Road, Galle, Sri Lanka', '+94912345678')
    ON CONFLICT (branch_name) DO NOTHING;

    INSERT INTO specialty (specialty_name)
    VALUES
        ('General Medicine'),
        ('ENT'),
        ('Paediatrics'),
        ('Cardiology'),
        ('Dermatology'),
        ('Orthopaedics'),
        ('Obstetrics & Gynaecology'),
        ('Radiology')
    ON CONFLICT (specialty_name) DO NOTHING;

    INSERT INTO treatment_catalogue (
        service_code, treatment_name, unit_price, category
    )
    VALUES
        ('CON-001', 'General Consultation', 1500.00, 'Consultation'),
        ('CON-002', 'Specialist Consultation', 3000.00, 'Consultation'),
        ('XR-001', 'Chest X-Ray', 2500.00, 'Radiology'),
        ('XR-002', 'Bone X-Ray', 2200.00, 'Radiology'),
        ('ECG-001', 'Electrocardiogram (ECG)', 3500.00, 'Cardiology'),
        ('INJ-001', 'Injection (Intramuscular)', 800.00, 'Procedure'),
        ('INJ-002', 'IV Drip', 2500.00, 'Procedure'),
        ('BLD-001', 'Full Blood Count', 1200.00, 'Laboratory'),
        ('BLD-002', 'Lipid Profile', 1800.00, 'Laboratory'),
        ('DRG-001', 'Wound Dressing', 1000.00, 'Procedure')
    ON CONFLICT (service_code) DO NOTHING;

    SELECT role_id INTO v_role_id
    FROM role
    WHERE role_name = 'Admin';

    SELECT role_id INTO v_manager_role_id
    FROM role
    WHERE role_name = 'Branch Manager';

    SELECT role_id INTO v_receptionist_role_id
    FROM role
    WHERE role_name = 'Receptionist';

    SELECT role_id INTO v_doctor_role_id
    FROM role
    WHERE role_name = 'Doctor';

    SELECT role_id INTO v_qa_role_id
    FROM role
    WHERE role_name = 'QA Tester';

    INSERT INTO branch (branch_name, address, contact_number)
    VALUES ('Development Branch', 'Local development environment', NULL)
    ON CONFLICT (branch_name) DO NOTHING;

    SELECT branch_id INTO v_branch_id
    FROM branch
    WHERE branch_name = 'Development Branch';

    INSERT INTO branch (branch_name, address, contact_number)
    VALUES ('Test Branch', 'Automated testing environment', '+94110000001')
    ON CONFLICT (branch_name) DO NOTHING;

    SELECT branch_id INTO v_second_branch_id
    FROM branch
    WHERE branch_name = 'Test Branch';

    INSERT INTO staff (
        nic,
        first_name,
        last_name,
        date_of_birth,
        gender,
        address,
        branch_id,
        job_title,
        employment_status,
        hire_date
    )
    VALUES (
        'DEV-ADMIN-001',
        'Development',
        'Administrator',
        DATE '1990-01-01',
        'Other',
        'Local development environment',
        v_branch_id,
        'Administrator',
        'Active',
        CURRENT_DATE
    )
    ON CONFLICT (nic) DO NOTHING;

    SELECT staff_id INTO v_staff_id
    FROM staff
    WHERE nic = 'DEV-ADMIN-001';

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    VALUES (
        v_staff_id,
        'dev-admin',
        '$argon2id$v=19$m=65536,t=3,p=4$fwHwpTW2XUuj8PHEMuGGeA$4xaQw00YBf6WxWmeUBla5pWZFU4+VXXIAuT07r4sfcs',
        v_role_id
    )
    ON CONFLICT (username) DO NOTHING;

    INSERT INTO staff (
        nic, first_name, last_name, date_of_birth, gender, address,
        branch_id, job_title, employment_status, hire_date
    )
    VALUES (
        'DEV-ADMIN-002', 'Test', 'Administrator', DATE '1988-06-06',
        'Other', 'Local development environment', v_branch_id,
        'Administrator', 'Active', CURRENT_DATE
    )
    ON CONFLICT (nic) DO NOTHING;

    SELECT staff_id INTO v_test_admin_staff_id
    FROM staff
    WHERE nic = 'DEV-ADMIN-002';

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    VALUES (
        v_test_admin_staff_id,
        'admin',
        '$argon2id$v=19$m=65536,t=3,p=4$Exu+4bUXbDcdtEUOfOOsgQ$xJAZ2zNoh+BwAKDHAOKUqO89nSUA0Hh8CRuwGNPYgOo',
        v_role_id
    )
    ON CONFLICT (username) DO NOTHING;

    INSERT INTO staff (
        nic, first_name, last_name, date_of_birth, gender, address,
        branch_id, job_title, employment_status, hire_date
    )
    VALUES (
        'DEV-MANAGER-001', 'Development', 'Manager', DATE '1985-02-14',
        'Female', 'Local development environment', v_second_branch_id,
        'Branch Manager', 'Active', CURRENT_DATE
    )
    ON CONFLICT (nic) DO NOTHING;

    SELECT staff_id INTO v_manager_staff_id
    FROM staff
    WHERE nic = 'DEV-MANAGER-001';

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    VALUES (
        v_manager_staff_id,
        'dev-manager',
        '$argon2id$v=19$m=65536,t=3,p=4$Exu+4bUXbDcdtEUOfOOsgQ$xJAZ2zNoh+BwAKDHAOKUqO89nSUA0Hh8CRuwGNPYgOo',
        v_manager_role_id
    )
    ON CONFLICT (username) DO NOTHING;

    UPDATE branch
    SET manager_staff_id = v_manager_staff_id
    WHERE branch_id = v_second_branch_id;

    INSERT INTO staff (
        nic, first_name, last_name, date_of_birth, gender, address,
        branch_id, job_title, employment_status, hire_date
    )
    VALUES (
        'DEV-RECEPTION-001', 'Test', 'Receptionist', DATE '1995-05-20',
        'Female', 'Local development environment', v_branch_id,
        'Receptionist', 'Active', CURRENT_DATE
    )
    ON CONFLICT (nic) DO NOTHING;

    SELECT staff_id INTO v_receptionist_staff_id
    FROM staff
    WHERE nic = 'DEV-RECEPTION-001';

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    VALUES (
        v_receptionist_staff_id,
        'reception',
        '$argon2id$v=19$m=65536,t=3,p=4$Exu+4bUXbDcdtEUOfOOsgQ$xJAZ2zNoh+BwAKDHAOKUqO89nSUA0Hh8CRuwGNPYgOo',
        v_receptionist_role_id
    )
    ON CONFLICT (username) DO NOTHING;

    INSERT INTO staff (
        nic, first_name, last_name, date_of_birth, gender, address,
        branch_id, job_title, employment_status, hire_date
    )
    VALUES (
        'DEV-DOCTOR-001', 'Test', 'Doctor', DATE '1980-08-08',
        'Male', 'Local development environment', v_branch_id,
        'Doctor', 'Active', CURRENT_DATE
    )
    ON CONFLICT (nic) DO NOTHING;

    SELECT staff_id INTO v_doctor_staff_id
    FROM staff
    WHERE nic = 'DEV-DOCTOR-001';

    INSERT INTO doctor (
        staff_id, license_no, years_of_experience, consultation_fee,
        qualifications
    )
    VALUES (
        v_doctor_staff_id, 'DEV-LIC-001', 10, 2500.00,
        'MBBS - Development Test Doctor'
    )
    ON CONFLICT (staff_id) DO NOTHING;

    INSERT INTO doctor_specialty (staff_id, specialty_id)
    SELECT v_doctor_staff_id, specialty_id
    FROM specialty
    WHERE specialty_name IN ('Cardiology', 'General Medicine')
    ON CONFLICT (staff_id, specialty_id) DO NOTHING;

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    VALUES (
        v_doctor_staff_id,
        'dev-doctor',
        '$argon2id$v=19$m=65536,t=3,p=4$Exu+4bUXbDcdtEUOfOOsgQ$xJAZ2zNoh+BwAKDHAOKUqO89nSUA0Hh8CRuwGNPYgOo',
        v_doctor_role_id
    )
    ON CONFLICT (username) DO NOTHING;

    INSERT INTO staff (
        nic, first_name, last_name, date_of_birth, gender, address,
        branch_id, job_title, employment_status, hire_date
    )
    VALUES (
        'DEV-QA-001', 'Test', 'QA', DATE '1993-03-03',
        'Other', 'Local development environment', v_second_branch_id,
        'QA Tester', 'Active', CURRENT_DATE
    )
    ON CONFLICT (nic) DO NOTHING;

    SELECT staff_id INTO v_qa_staff_id
    FROM staff
    WHERE nic = 'DEV-QA-001';

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    VALUES (
        v_qa_staff_id,
        'dev-qa',
        '$argon2id$v=19$m=65536,t=3,p=4$Exu+4bUXbDcdtEUOfOOsgQ$xJAZ2zNoh+BwAKDHAOKUqO89nSUA0Hh8CRuwGNPYgOo',
        v_qa_role_id
    )
    ON CONFLICT (username) DO NOTHING;
END;
$$;