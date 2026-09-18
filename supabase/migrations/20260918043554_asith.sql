-- Patient, guardian, and insurance tables
-- Includes patient contact details, guardian links, and insurance records

CREATE TABLE patient (
    patient_id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nic_passport_no         VARCHAR(20) NOT NULL,
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    date_of_birth           DATE NOT NULL,
    gender                  gender_enum NOT NULL,
    address                 VARCHAR(255),
    registered_branch_id    INTEGER NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_patient_nic UNIQUE (nic_passport_no),
    CONSTRAINT fk_patient_branch
        FOREIGN KEY (registered_branch_id) REFERENCES branch(branch_id)
        ON DELETE RESTRICT
);


CREATE TABLE patient_phone (
    phone_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id      INTEGER NOT NULL,
    phone_number    VARCHAR(20) NOT NULL,
    phone_type      phone_type_enum NOT NULL,
    CONSTRAINT fk_patient_phone_patient
        FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
        ON DELETE CASCADE
);


CREATE TABLE guardian (
    guardian_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    nic             VARCHAR(20),
    address         VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_guardian_nic UNIQUE (nic)
);


CREATE TABLE guardian_phone (
    phone_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    guardian_id     INTEGER NOT NULL,
    phone_number    VARCHAR(20) NOT NULL,
    phone_type      phone_type_enum NOT NULL,
    CONSTRAINT fk_guardian_phone_guardian
        FOREIGN KEY (guardian_id) REFERENCES guardian(guardian_id)
        ON DELETE CASCADE
);


CREATE TABLE patient_guardian (
    patient_id      INTEGER NOT NULL,
    guardian_id     INTEGER NOT NULL,
    relationship    VARCHAR(50) NOT NULL,
    PRIMARY KEY (patient_id, guardian_id),
    CONSTRAINT fk_patient_guardian_patient
        FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_patient_guardian_guardian
        FOREIGN KEY (guardian_id) REFERENCES guardian(guardian_id)
        ON DELETE CASCADE
);


CREATE TABLE insurance (
    policy_id       VARCHAR(30) PRIMARY KEY,
    patient_id      INTEGER NOT NULL,
    provider_name   VARCHAR(100) NOT NULL,
    coverage_level  VARCHAR(50) NOT NULL,
    status          insurance_status_enum NOT NULL DEFAULT 'Active',
    CONSTRAINT fk_insurance_patient
        FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
        ON DELETE RESTRICT
);


-- Support fast patient searches by last name and first name
CREATE INDEX idx_patient_last_first_name ON patient (last_name, first_name);

-- Support fast guardian searches by last name and first name
CREATE INDEX idx_guardian_last_first_name ON guardian (last_name, first_name);

-- Speed up phone number lookups for each patient and guardian
CREATE INDEX idx_patient_phone_patient_id ON patient_phone (patient_id);
CREATE INDEX idx_guardian_phone_guardian_id ON guardian_phone (guardian_id);

-- Quickly find which patients are linked to a guardian
CREATE INDEX idx_patient_guardian_guardian_id
    ON patient_guardian (guardian_id);

-- Quickly find which insurance policies belong to a patient
CREATE INDEX idx_insurance_patient_id ON insurance (patient_id);



COMMENT ON TABLE patient IS
    'Patient records are shared across branches. The registered_branch_id shows where the patient was registered, but it does not restrict access. The unique NIC or passport number helps keep the record safe and consistent.';
COMMENT ON TABLE patient_phone IS
    'Stores one or more phone numbers for a patient. Removing a patient also removes their phone records.';
COMMENT ON TABLE guardian IS
    'Represents a guardian or emergency contact as a separate record so the same person is not duplicated across multiple family members.';
COMMENT ON TABLE guardian_phone IS
    'Stores one or more phone numbers for a guardian. Removing a guardian also removes their phone records.';
COMMENT ON TABLE patient_guardian IS
    'Links patients to guardians and stores the relationship between them. This keeps the relationship data separate from the guardian record itself.';
COMMENT ON TABLE insurance IS
    'Stores each patient''s insurance policy. The policy_id is the external identifier, and the policy stays in place if the patient is deleted to protect financial records.';
