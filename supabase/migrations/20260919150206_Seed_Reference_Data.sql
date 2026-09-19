-- Migration: Seed Reference Data
-- Purpose: insert the fixed reference rows every environment needs.
--   - 6 roles (matches role_name_enum exactly)
--   - 3 branches (Colombo, Kandy, Galle) per SRS §1.4
--   - 8 specialties, 10 treatment catalogue items

INSERT INTO role (role_name) VALUES
    ('Admin'),
    ('Branch Manager'),
    ('Receptionist'),
    ('Doctor'),
    ('Cashier'),
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
