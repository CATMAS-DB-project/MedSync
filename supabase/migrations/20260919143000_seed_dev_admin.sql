-- Development-only seed data for local authentication testing.
-- The identity columns generate staff_id, role_id, and branch_id automatically.
DO $$
DECLARE
    v_role_id   role.role_id%TYPE;
    v_branch_id branch.branch_id%TYPE;
    v_staff_id  staff.staff_id%TYPE;
BEGIN
    INSERT INTO role (role_name)
    VALUES ('Admin')
    ON CONFLICT (role_name) DO NOTHING;

    SELECT role_id INTO v_role_id
    FROM role
    WHERE role_name = 'Admin';

    INSERT INTO branch (branch_name, address, contact_number)
    VALUES ('Development Branch', 'Local development environment', NULL)
    ON CONFLICT (branch_name) DO NOTHING;

    SELECT branch_id INTO v_branch_id
    FROM branch
    WHERE branch_name = 'Development Branch';

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
END;
$$;