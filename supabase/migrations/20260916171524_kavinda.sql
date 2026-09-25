CREATE TYPE role_name_enum AS ENUM (
    'Admin',
    'Branch Manager',
    'Receptionist',
    'Doctor',
    'QA Tester'
);

CREATE TYPE gender_enum AS ENUM (
    'Male',
    'Female',
    'Other'
);

CREATE TYPE employment_status_enum AS ENUM (
    'Active',
    'OnLeave',
    'Terminated'
);

CREATE TYPE phone_type_enum AS ENUM (
    'Mobile',
    'Home',
    'Work'
);

CREATE TYPE appointment_status_enum AS ENUM (
    'Scheduled',
    'Completed',
    'Cancelled'
);

CREATE TYPE invoice_status_enum AS ENUM (
    'Draft',
    'Finalized',
    'Paid',
    'Partially Paid'
);

CREATE TYPE payment_method_enum AS ENUM (
    'Cash',
    'Credit Card',
    'Insurance'
);

CREATE TYPE insurance_status_enum AS ENUM (
    'Active',
    'Inactive'
);

CREATE TYPE claim_verification_status_enum AS ENUM (
    'Pending',
    'Approved',
    'Rejected'
);

CREATE TYPE audit_action_enum AS ENUM (
    'Create',
    'Update',
    'Delete'
);

CREATE TABLE role (
    role_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name   role_name_enum NOT NULL,
    CONSTRAINT uq_role_role_name UNIQUE (role_name)
);

CREATE TABLE specialty (
    specialty_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    specialty_name  VARCHAR(50) NOT NULL,
    CONSTRAINT uq_specialty_name UNIQUE (specialty_name)
);

CREATE TABLE treatment_catalogue (
    service_code    VARCHAR(10) PRIMARY KEY,
    treatment_name  VARCHAR(100) NOT NULL,
    unit_price      NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    category        VARCHAR(50) NOT NULL
);

CREATE TABLE branch (
    branch_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_name     VARCHAR(50) NOT NULL,
    address         VARCHAR(255) NOT NULL,
    contact_number  VARCHAR(20),
    manager_staff_id INTEGER,     -- FK added in migration 002
    CONSTRAINT uq_branch_name UNIQUE (branch_name)
);

CREATE TABLE staff (
    staff_id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nic                 VARCHAR(20) NOT NULL,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    date_of_birth       DATE NOT NULL,
    gender              gender_enum NOT NULL,
    address             VARCHAR(255),
    branch_id           INTEGER NOT NULL,
    job_title           VARCHAR(50) NOT NULL,
    employment_status   employment_status_enum NOT NULL DEFAULT 'Active',
    hire_date           DATE NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_nic UNIQUE (nic),
    CONSTRAINT fk_staff_branch
        FOREIGN KEY (branch_id) REFERENCES branch(branch_id)
        ON DELETE RESTRICT
);

-- Fast staff lookup by branch (used by many screens + reports)
CREATE INDEX idx_staff_branch_id ON staff (branch_id);

-- Fast staff lookup by name (used by admin search)
CREATE INDEX idx_staff_last_first_name ON staff (last_name, first_name);

COMMENT ON TABLE role IS 'System roles for RBAC. Static reference — seeded once.';
COMMENT ON TABLE specialty IS 'Medical specialties (ENT, Paediatrics, etc.).';
COMMENT ON TABLE treatment_catalogue IS 'Billable services. service_code is business identifier (e.g. XR-001).';
COMMENT ON TABLE branch IS 'Clinic branches. manager_staff_id FK deferred to migration 002.';
COMMENT ON TABLE staff IS 'All employees. Superclass for doctor + user_account subtypes.';
