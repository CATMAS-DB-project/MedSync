-- =============================================================================
-- Migration: Demo / UAT seed data (CATMS)
-- =============================================================================
-- Run AFTER every other migration (including 20261010150000_fix_amended_treatment_invoice).
-- Runs as ONE atomic DO block: either everything is seeded or nothing is.
-- Re-running is safe: it detects the 'demo-admin' account and skips.
--
-- HOW CONSISTENCY IS GUARANTEED
--   * Every row goes through the real triggers (no trigger is disabled):
--       appointment Scheduled -> Completed  => trg_auto_create_invoice makes the Draft invoice
--       treatment insert                    => trg_add_treatment_to_invoice recalculates subtotal
--       patient / treatment / invoice DML   => fn_audit_log writes audit_log rows
--     Acting staff for the audit trail is set per step via app.current_staff_id.
--   * price_at_time is read from treatment_catalogue, never typed by hand.
--   * Invoice subtotal = doctor.consultation_fee + effective (non-superseded) treatments.
--     Consultation codes CON-001/002 are NOT logged as treatments (the fee is already billed).
--   * Insurance claims exist ONLY for patients with an ACTIVE policy. The claim rate is
--     parsed from the policy's coverage_level (Gold 80% / Silver 60% / Basic 40%).
--   * insurance_deduction = claim.approved_amount (0 while Pending or if Rejected).
--   * Payments never exceed payable; invoice status is derived from the real payment total
--     (Paid / Partially Paid / Finalized). Payments are Cash / Credit Card (patient share);
--     the insurer share is represented by insurance_deduction, so 'Insurance' is not used
--     as a payment method (it would double-count).
--   * Appointment branch = doctor's branch; booked by that branch's receptionist.
--   * Dates are relative to CURRENT_DATE, so the demo always has "history", "today"
--     and "upcoming" data no matter when it is loaded.
--   * A verification block at the end raises an exception if any rule above is broken.
--
-- LOGINS (all passwords: admin123)
--   demo-admin | mgr-colombo, mgr-kandy, mgr-galle | rec-colombo, rec-kandy, rec-galle
--   dr-anura, dr-priyanka, dr-kasun (Colombo) | dr-malini, dr-suresh (Kandy)
--   dr-thilini, dr-nuwan (Galle)
--
-- DEMO SCENARIOS COVERED
--   Insurance: Approved in full (C01,C05,C11,C14), Approved partially (C03),
--              Pending (C06,C16), Rejected (C08), Inactive policy -> no claim (C15),
--              no policy -> no claim (many)
--   Billing:   Paid single payment, Paid split Cash+Card (C02), Partially Paid (C05),
--              Finalized/unpaid (C06,C10,C14,C16), Draft (C17,C18), manual discounts (C02,C09)
--   Amendments: wrong service corrected (C12), mistaken treatment removed with price 0 (C13)
--   Appointments: Completed, Scheduled today/upcoming, Cancelled, walk-ins (C13,C15),
--              rescheduled (S09), cross-branch patient (Fathima: registered Colombo, seen in Kandy)
--   Guardians: children + elderly patient + spouses
-- =============================================================================

DO $seed$
DECLARE
    v_today        CONSTANT DATE := CURRENT_DATE;
    -- argon2id hash of 'admin123' (same hash the earlier seed migrations use)
    v_pw           CONSTANT TEXT :=
        '$argon2id$v=19$m=65536,t=3,p=4$Exu+4bUXbDcdtEUOfOOsgQ$xJAZ2zNoh+BwAKDHAOKUqO89nSUA0Hh8CRuwGNPYgOo';

    ra             RECORD;   -- appointment plan row
    rt             RECORD;   -- treatment plan row
    rb             RECORD;   -- billing plan row
    rp             RECORD;   -- payment plan row
    rbr            RECORD;   -- branch loop row

    v_tbl          TEXT;
    v_cnt          BIGINT;
    v_date         DATE;
    v_ts           TIMESTAMP;
    v_created      TIMESTAMPTZ;
    v_appt_id      INTEGER;
    v_patient_id   INTEGER;
    v_tx_id        INTEGER;
    v_invoice_id   INTEGER;
    v_biller_id    INTEGER;
    v_subtotal     NUMERIC(10,2);
    v_policy       VARCHAR(30);
    v_pct          NUMERIC;
    v_claimed      NUMERIC(10,2);
    v_approved     NUMERIC(10,2);
    v_deduction    NUMERIC(10,2);
    v_payable      NUMERIC(10,2);
    v_paid         NUMERIC(10,2);
    v_amt          NUMERIC(10,2);
BEGIN
    -- -------------------------------------------------------------------------
    -- Guard: already seeded?
    -- -------------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM user_account WHERE username = 'demo-admin') THEN
        RAISE NOTICE 'Demo seed already applied - skipping.';
        RETURN;
    END IF;

    -- Helper: set the acting staff member for the audit trigger (transaction-local)
    CREATE FUNCTION pg_temp.seed_actor(p_username TEXT) RETURNS void
    LANGUAGE sql AS $f$
        SELECT set_config(
            'app.current_staff_id',
            (SELECT staff_id::text FROM user_account WHERE username = p_username),
            true);
    $f$;

    -- -------------------------------------------------------------------------
    -- 1. Reference data (idempotent; identical to the reference-data migration)
    -- -------------------------------------------------------------------------
    INSERT INTO role (role_name) VALUES
        ('Admin'), ('Branch Manager'), ('Receptionist'), ('Doctor'), ('QA Tester')
    ON CONFLICT (role_name) DO NOTHING;

    INSERT INTO branch (branch_name, address, contact_number) VALUES
        ('Colombo', '123 Galle Road, Colombo 03, Sri Lanka', '+94112345678'),
        ('Kandy',   '45 Peradeniya Road, Kandy, Sri Lanka',  '+94812345678'),
        ('Galle',   '10 Wackwella Road, Galle, Sri Lanka',   '+94912345678')
    ON CONFLICT (branch_name) DO NOTHING;

    INSERT INTO specialty (specialty_name) VALUES
        ('General Medicine'), ('ENT'), ('Paediatrics'), ('Cardiology'),
        ('Dermatology'), ('Orthopaedics'), ('Obstetrics & Gynaecology'), ('Radiology')
    ON CONFLICT (specialty_name) DO NOTHING;

    INSERT INTO treatment_catalogue (service_code, treatment_name, unit_price, category) VALUES
        ('CON-001', 'General Consultation',      1500.00, 'Consultation'),
        ('CON-002', 'Specialist Consultation',   3000.00, 'Consultation'),
        ('XR-001',  'Chest X-Ray',               2500.00, 'Radiology'),
        ('XR-002',  'Bone X-Ray',                2200.00, 'Radiology'),
        ('ECG-001', 'Electrocardiogram (ECG)',   3500.00, 'Cardiology'),
        ('INJ-001', 'Injection (Intramuscular)',  800.00, 'Procedure'),
        ('INJ-002', 'IV Drip',                   2500.00, 'Procedure'),
        ('BLD-001', 'Full Blood Count',          1200.00, 'Laboratory'),
        ('BLD-002', 'Lipid Profile',             1800.00, 'Laboratory'),
        ('DRG-001', 'Wound Dressing',            1000.00, 'Procedure')
    ON CONFLICT (service_code) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- 2. Staff (1 admin, 3 branch managers, 3 receptionists, 7 doctors)
    -- -------------------------------------------------------------------------
    INSERT INTO staff (nic, first_name, last_name, date_of_birth, gender, address,
                       branch_id, job_title, employment_status, hire_date)
    SELECT v.nic, v.fn, v.ln, v.dob::date, v.gender::gender_enum, v.addr,
           b.branch_id, v.job, 'Active', v.hired::date
    FROM (VALUES
        ('198813712841','Sachini','Abeysekara','1988-05-17','Female','21 Flower Road, Colombo 07','Colombo','Administrator','2019-03-01'),
        ('197924613572','Chamara','Wickramasinghe','1979-09-03','Male','5 Havelock Place, Colombo 05','Colombo','Branch Manager','2018-01-15'),
        ('198302214693','Dilani','Jayawardena','1983-01-22','Female','18 Hill Street, Kandy','Kandy','Branch Manager','2018-06-01'),
        ('198121115704','Ruwan','Fernando','1981-07-30','Male','9 Lighthouse Street, Galle','Galle','Branch Manager','2019-02-11'),
        ('199604216815','Nadeesha','Silva','1996-02-11','Female','33 Kotte Road, Rajagiriya','Colombo','Receptionist','2022-04-01'),
        ('199829917926','Hashini','Kulatunga','1998-10-25','Female','7 Katugastota Road, Kandy','Kandy','Receptionist','2023-01-09'),
        ('199715918037','Tharindu','Peiris','1997-06-08','Male','12 Matara Road, Galle','Galle','Receptionist','2022-09-05'),
        ('197121919148','Anura','Gunasekara','1971-08-07','Male','40 Bauddhaloka Mawatha, Colombo 07','Colombo','Doctor','2017-05-02'),
        ('197810320259','Priyanka','Samarasinghe','1978-04-13','Female','16 Alexandra Place, Colombo 07','Colombo','Doctor','2018-08-20'),
        ('197431221360','Kasun','Abeywickrama','1974-11-08','Male','22 Wijerama Mawatha, Colombo 07','Colombo','Doctor','2016-10-03'),
        ('198217522471','Malini','Herath','1982-06-24','Female','11 Trincomalee Street, Kandy','Kandy','Doctor','2020-02-17'),
        ('197615423582','Suresh','Kumar','1976-06-02','Male','27 Dalada Veediya, Kandy','Kandy','Doctor','2019-07-01'),
        ('198509724693','Thilini','Gamage','1985-04-07','Female','3 Pettah Road, Galle','Galle','Doctor','2021-03-15'),
        ('198030425704','Nuwan','Dissanayake','1980-10-30','Male','19 Hospital Road, Galle','Galle','Doctor','2019-11-04')
    ) AS v(nic, fn, ln, dob, gender, addr, branch, job, hired)
    JOIN branch b ON b.branch_name = v.branch;

    INSERT INTO staff_phone (staff_id, phone_number, phone_type)
    SELECT s.staff_id, v.num, v.typ::phone_type_enum
    FROM (VALUES
        ('198813712841','+94771000101','Mobile'),
        ('197924613572','+94771000102','Mobile'),
        ('197924613572','+94112000102','Work'),
        ('198302214693','+94771000103','Mobile'),
        ('198121115704','+94771000104','Mobile'),
        ('199604216815','+94771000105','Mobile'),
        ('199829917926','+94771000106','Mobile'),
        ('199715918037','+94771000107','Mobile'),
        ('197121919148','+94771000108','Mobile'),
        ('197810320259','+94771000109','Mobile'),
        ('197431221360','+94771000110','Mobile'),
        ('197431221360','+94112000110','Work'),
        ('198217522471','+94771000111','Mobile'),
        ('197615423582','+94771000112','Mobile'),
        ('198509724693','+94771000113','Mobile'),
        ('198030425704','+94771000114','Mobile')
    ) AS v(nic, num, typ)
    JOIN staff s ON s.nic = v.nic;

    -- Doctors (must exist before their Doctor-role accounts: trg_user_role_doctor_consistency)
    INSERT INTO doctor (staff_id, license_no, years_of_experience, consultation_fee, qualifications)
    SELECT s.staff_id, v.lic, v.yrs, v.fee, v.quals
    FROM (VALUES
        ('197121919148','SLMC-41021',15,2500.00,'MBBS, MD (General Medicine)'),
        ('197810320259','SLMC-41187',12,3500.00,'MBBS, MD (Paediatrics)'),
        ('197431221360','SLMC-40933',18,4500.00,'MBBS, MD (Medicine), MRCP, Cardiology fellowship'),
        ('198217522471','SLMC-42250', 9,3000.00,'MBBS, MD (Dermatology)'),
        ('197615423582','SLMC-41704',14,4000.00,'MBBS, MS (Orthopaedics)'),
        ('198509724693','SLMC-42615', 8,3200.00,'MBBS, MS (ENT)'),
        ('198030425704','SLMC-42011',11,2500.00,'MBBS, Diploma in Family Medicine')
    ) AS v(nic, lic, yrs, fee, quals)
    JOIN staff s ON s.nic = v.nic;

    INSERT INTO doctor_specialty (staff_id, specialty_id)
    SELECT s.staff_id, sp.specialty_id
    FROM (VALUES
        ('197121919148','General Medicine'),
        ('197810320259','Paediatrics'),
        ('197431221360','Cardiology'),
        ('197431221360','General Medicine'),
        ('198217522471','Dermatology'),
        ('197615423582','Orthopaedics'),
        ('197615423582','Radiology'),
        ('198509724693','ENT'),
        ('198030425704','General Medicine')
    ) AS v(nic, specialty)
    JOIN staff s      ON s.nic = v.nic
    JOIN specialty sp ON sp.specialty_name = v.specialty;

    INSERT INTO user_account (staff_id, username, password_hash, role_id)
    SELECT s.staff_id, v.username, v_pw, r.role_id
    FROM (VALUES
        ('198813712841','demo-admin',   'Admin'),
        ('197924613572','mgr-colombo',  'Branch Manager'),
        ('198302214693','mgr-kandy',    'Branch Manager'),
        ('198121115704','mgr-galle',    'Branch Manager'),
        ('199604216815','rec-colombo',  'Receptionist'),
        ('199829917926','rec-kandy',    'Receptionist'),
        ('199715918037','rec-galle',    'Receptionist'),
        ('197121919148','dr-anura',     'Doctor'),
        ('197810320259','dr-priyanka',  'Doctor'),
        ('197431221360','dr-kasun',     'Doctor'),
        ('198217522471','dr-malini',    'Doctor'),
        ('197615423582','dr-suresh',    'Doctor'),
        ('198509724693','dr-thilini',   'Doctor'),
        ('198030425704','dr-nuwan',     'Doctor')
    ) AS v(nic, username, role)
    JOIN staff s ON s.nic = v.nic
    JOIN role r  ON r.role_name = v.role::role_name_enum;

    UPDATE branch br
    SET manager_staff_id = ua.staff_id
    FROM user_account ua
    WHERE (br.branch_name, ua.username) IN
          (('Colombo','mgr-colombo'), ('Kandy','mgr-kandy'), ('Galle','mgr-galle'));

    -- -------------------------------------------------------------------------
    -- 3. Patients (14) - registered by the receptionist of their branch (audited)
    --    Children have no NIC, so a birth-certificate reference is stored instead.
    -- -------------------------------------------------------------------------
    FOR rbr IN
        SELECT * FROM (VALUES
            ('Colombo','rec-colombo'), ('Kandy','rec-kandy'), ('Galle','rec-galle')
        ) AS x(branch, actor)
    LOOP
        PERFORM pg_temp.seed_actor(rbr.actor);

        INSERT INTO patient (nic_passport_no, first_name, last_name, date_of_birth, gender,
                             address, registered_branch_id, created_at)
        SELECT v.nic, v.fn, v.ln, v.dob::date, v.gender::gender_enum, v.addr,
               b.branch_id, NOW() - v.days_ago * INTERVAL '1 day'
        FROM (VALUES
            ('197807412345','Kamal','Perera','1978-03-14','Male','25 Lake Road, Colombo 05','Colombo',90),
            ('198531012346','Nilmini','Fernando','1985-11-02','Female','12 Temple Lane, Dehiwala','Colombo',85),
            ('196217212347','Sunil','Jayasuriya','1962-06-21','Male','8 Station Road, Mount Lavinia','Colombo',80),
            ('199125212348','Ayesha','Rahman','1991-09-09','Female','77 Havelock Road, Colombo 06','Colombo',70),
            ('BC-20160418-001','Dinuka','Weerasinghe','2016-04-18','Male','14 Park Avenue, Nugegoda','Colombo',60),
            ('BC-20190130-002','Senuri','Gunawardena','2019-01-30','Female','52 Kandy Road, Kiribathgoda','Colombo',55),
            ('200007112350','Fathima','Nazeer','2000-03-11','Female','61 Dematagoda Road, Colombo 09','Colombo',45),
            ('198933912351','Mahesh','Kumar','1989-12-05','Male','30 Peradeniya Road, Kandy','Kandy',75),
            ('199619912352','Rashmi','Hettiarachchi','1996-07-17','Female','4 Mahaiyawa Lane, Kandy','Kandy',65),
            ('195505612353','Wimal','Bandara','1955-02-25','Male','88 Temple Road, Peradeniya','Kandy',88),
            ('198222412354','Thushari','Amarasinghe','1982-08-12','Female','15 Gregory Road, Kandy','Kandy',50),
            ('BC-20141003-003','Pasindu','Rathnayake','2014-10-03','Male','6 Karapitiya Road, Galle','Galle',60),
            ('199314812355','Harini','Madushani','1993-05-28','Female','22 Hirimbura Road, Galle','Galle',40),
            ('197001912356','Ajith','Pathirana','1970-01-19','Male','17 Fort Road, Galle','Galle',35)
        ) AS v(nic, fn, ln, dob, gender, addr, branch, days_ago)
        JOIN branch b ON b.branch_name = v.branch
        WHERE v.branch = rbr.branch;
    END LOOP;

    INSERT INTO patient_phone (patient_id, phone_number, phone_type)
    SELECT p.patient_id, v.num, v.typ::phone_type_enum
    FROM (VALUES
        ('197807412345','+94712000101','Mobile'),
        ('197807412345','+94112000101','Home'),
        ('198531012346','+94712000102','Mobile'),
        ('196217212347','+94712000103','Mobile'),
        ('196217212347','+94112000103','Home'),
        ('199125212348','+94712000104','Mobile'),
        ('BC-20160418-001','+94112000105','Home'),
        ('BC-20190130-002','+94112000106','Home'),
        ('200007112350','+94712000114','Mobile'),
        ('198933912351','+94712000107','Mobile'),
        ('199619912352','+94712000108','Mobile'),
        ('195505612353','+94812000109','Home'),
        ('198222412354','+94712000110','Mobile'),
        ('BC-20141003-003','+94912000111','Home'),
        ('199314812355','+94712000112','Mobile'),
        ('197001912356','+94712000113','Mobile')
    ) AS v(nic, num, typ)
    JOIN patient p ON p.nic_passport_no = v.nic;

    -- -------------------------------------------------------------------------
    -- 4. Guardians / emergency contacts (7) and links
    -- -------------------------------------------------------------------------
    INSERT INTO guardian (first_name, last_name, nic, address) VALUES
        ('Ishara',    'Weerasinghe', '198867112360', '14 Park Avenue, Nugegoda'),
        ('Lasantha',  'Gunawardena', '198134512361', '52 Kandy Road, Kiribathgoda'),
        ('Dilrukshi', 'Gunawardena', '198336012362', '52 Kandy Road, Kiribathgoda'),
        ('Chaminda',  'Bandara',     '198423112363', '88 Temple Road, Peradeniya'),
        ('Sandya',    'Rathnayake',  '198728812364', '6 Karapitiya Road, Galle'),
        ('Kumari',    'Perera',      '198042312365', '25 Lake Road, Colombo 05'),
        ('Rohan',     'Fernando',    '198219512366', '12 Temple Lane, Dehiwala');

    INSERT INTO guardian_phone (guardian_id, phone_number, phone_type)
    SELECT g.guardian_id, v.num, v.typ::phone_type_enum
    FROM (VALUES
        ('198867112360','+94703000101','Mobile'),
        ('198134512361','+94703000102','Mobile'),
        ('198134512361','+94112300102','Work'),
        ('198336012362','+94703000103','Mobile'),
        ('198423112363','+94703000104','Mobile'),
        ('198728812364','+94703000105','Mobile'),
        ('198042312365','+94703000106','Mobile'),
        ('198219512366','+94703000107','Mobile')
    ) AS v(nic, num, typ)
    JOIN guardian g ON g.nic = v.nic;

    INSERT INTO patient_guardian (patient_id, guardian_id, relationship)
    SELECT p.patient_id, g.guardian_id, v.rel
    FROM (VALUES
        ('BC-20160418-001','198867112360','Mother'),
        ('BC-20190130-002','198134512361','Father'),
        ('BC-20190130-002','198336012362','Mother'),
        ('195505612353',   '198423112363','Son'),
        ('BC-20141003-003','198728812364','Mother'),
        ('197807412345',   '198042312365','Spouse'),
        ('198531012346',   '198219512366','Spouse')
    ) AS v(patient_nic, guardian_nic, rel)
    JOIN patient p  ON p.nic_passport_no = v.patient_nic
    JOIN guardian g ON g.nic = v.guardian_nic;

    -- -------------------------------------------------------------------------
    -- 5. Insurance policies (7). Coverage % is encoded in coverage_level and is
    --    what the claim amounts below are derived from.
    --    Patients WITHOUT a row here (or with Inactive) never get a claim.
    -- -------------------------------------------------------------------------
    INSERT INTO insurance (policy_id, patient_id, provider_name, coverage_level, status)
    SELECT v.policy, p.patient_id, v.provider, v.coverage, v.status::insurance_status_enum
    FROM (VALUES
        ('LC-GLD-100234','197807412345','LankaCare Insurance',      'Gold - 80%',   'Active'),
        ('IL-SLV-200871','198531012346','Island Life Assurance',    'Silver - 60%', 'Active'),
        ('SH-BSC-300415','199125212348','Serendib Health Cover',    'Basic - 40%',  'Inactive'),
        ('LC-SLV-100562','BC-20190130-002','LankaCare Insurance',   'Silver - 60%', 'Active'),
        ('SH-BSC-300988','198933912351','Serendib Health Cover',    'Basic - 40%',  'Active'),
        ('IL-GLD-200345','198222412354','Island Life Assurance',    'Gold - 80%',   'Active'),
        ('LC-SLV-100777','199314812355','LankaCare Insurance',      'Silver - 60%', 'Active')
    ) AS v(policy, nic, provider, coverage, status)
    JOIN patient p ON p.nic_passport_no = v.nic;

    -- -------------------------------------------------------------------------
    -- 6. Visit plan (drives appointments -> treatments -> invoices -> claims -> payments)
    --    day_off: negative = past, 0 = today, positive = upcoming
    -- -------------------------------------------------------------------------
    CREATE TEMP TABLE seed_appt (
        ref TEXT PRIMARY KEY, patient_nic TEXT, doctor_user TEXT, booker_user TEXT,
        day_off INT, appt_time TIME, walk_in BOOLEAN, final_status TEXT,
        notes TEXT, reason TEXT, appointment_id INT
    ) ON COMMIT DROP;

    INSERT INTO seed_appt (ref, patient_nic, doctor_user, booker_user, day_off, appt_time,
                           walk_in, final_status, notes, reason) VALUES
    -- Completed visits -------------------------------------------------------
    ('C01','197807412345','dr-kasun',   'rec-colombo',-28,'09:00',FALSE,'Completed',
        'Exertional chest tightness for 2 weeks. ECG normal sinus rhythm. Lipid profile ordered; review in 2 weeks.',NULL),
    ('C02','196217212347','dr-kasun',   'rec-colombo',-26,'10:30',FALSE,'Completed',
        'Hypertension review. ECG and blood work done. Diet advice given; continue current medication.',NULL),
    ('C03','198531012346','dr-anura',   'rec-colombo',-21,'11:00',FALSE,'Completed',
        'Fever and body aches for 3 days. FBC done and IM injection given. Rest and fluids advised.',NULL),
    ('C04','BC-20160418-001','dr-priyanka','rec-colombo',-20,'09:30',FALSE,'Completed',
        'Routine paediatric check-up. Booster injection given and FBC done. Growth and development normal.',NULL),
    ('C05','BC-20190130-002','dr-priyanka','rec-colombo',-18,'14:00',FALSE,'Completed',
        'Persistent cough and fever. Chest X-ray clear. IM injection given; review if symptoms continue.',NULL),
    ('C06','198933912351','dr-suresh',  'rec-kandy',  -15,'10:00',FALSE,'Completed',
        'Ankle injury after a fall. Bone X-ray shows no fracture. Wound dressed, rest advised.',NULL),
    ('C07','199619912352','dr-malini',  'rec-kandy',  -14,'11:30',FALSE,'Completed',
        'Skin rash review. Topical treatment prescribed. Consultation only.',NULL),
    ('C08','198222412354','dr-malini',  'rec-kandy',  -13,'09:00',FALSE,'Completed',
        'Minor skin lesion cleaned and dressed. Follow-up in 2 weeks.',NULL),
    ('C09','195505612353','dr-suresh',  'rec-kandy',  -12,'15:00',FALSE,'Completed',
        'Chronic knee pain. Bone X-ray shows mild degenerative changes. Pain-relief injection given.',NULL),
    ('C10','BC-20141003-003','dr-thilini','rec-galle',-10,'10:00',FALSE,'Completed',
        'Ear pain and throat irritation. Examination done, injection given. Review if no improvement.',NULL),
    ('C11','199314812355','dr-nuwan',   'rec-galle',   -9,'09:30',FALSE,'Completed',
        'Fatigue review. FBC and lipid profile done; results discussed with patient.',NULL),
    ('C12','197001912356','dr-nuwan',   'rec-galle',   -8,'11:00',FALSE,'Completed',
        'Fever with chest discomfort. Chest X-ray done and IV drip given. Treatment log amended: X-ray type corrected.',NULL),
    ('C13','200007112350','dr-malini',  'rec-kandy',   -7,'10:30',TRUE, 'Completed',
        'Walk-in with minor hand wound. Wound dressed. Blood count entry removed as it was not performed.',NULL),
    ('C14','197807412345','dr-anura',   'rec-colombo', -5,'09:00',FALSE,'Completed',
        'Follow-up visit. Blood count reviewed; no concerns. Continue current advice.',NULL),
    ('C15','199125212348','dr-anura',   'rec-colombo', -3,'14:30',TRUE, 'Completed',
        'Walk-in with dehydration and weakness. IV drip given and FBC done.',NULL),
    ('C16','198222412354','dr-suresh',  'rec-kandy',   -1,'10:00',FALSE,'Completed',
        'Wrist pain after a minor fall. Bone X-ray shows no fracture. Brace advised.',NULL),
    ('C17','198933912351','dr-malini',  'rec-kandy',    0,'09:00',FALSE,'Completed',
        'Minor forearm wound cleaned and dressed.',NULL),
    ('C18','196217212347','dr-kasun',   'rec-colombo',  0,'09:30',FALSE,'Completed',
        'Follow-up cardiology review. Repeat ECG done and stable.',NULL),
    -- Cancelled ----------------------------------------------------------------
    ('X01','196217212347','dr-kasun',   'rec-colombo',-16,'10:00',FALSE,'Cancelled',NULL,'Patient unwell - requested cancellation'),
    ('X02','199314812355','dr-nuwan',   'rec-galle',   -6,'11:00',FALSE,'Cancelled',NULL,'Patient could not travel - cancelled by patient'),
    ('X03','BC-20141003-003','dr-thilini','rec-galle', -2,'15:00',FALSE,'Cancelled',NULL,'Guardian requested cancellation'),
    ('X04','195505612353','dr-suresh',  'rec-kandy',    3,'10:00',FALSE,'Cancelled',NULL,'Patient travelling out of town'),
    -- Upcoming / still scheduled -----------------------------------------------
    ('S01','198531012346','dr-anura',   'rec-colombo',  0,'14:00',FALSE,'Scheduled',NULL,NULL),
    ('S02','BC-20190130-002','dr-priyanka','rec-colombo',0,'15:30',FALSE,'Scheduled',NULL,NULL),
    ('S03','198222412354','dr-malini',  'rec-kandy',    1,'09:00',FALSE,'Scheduled',NULL,NULL),
    ('S04','197001912356','dr-nuwan',   'rec-galle',    1,'10:30',FALSE,'Scheduled',NULL,NULL),
    ('S05','195505612353','dr-suresh',  'rec-kandy',    2,'11:00',FALSE,'Scheduled',NULL,NULL),
    ('S06','197807412345','dr-kasun',   'rec-colombo',  3,'09:00',FALSE,'Scheduled',NULL,NULL),
    ('S07','199619912352','dr-malini',  'rec-kandy',    5,'10:00',FALSE,'Scheduled',NULL,NULL),
    ('S08','BC-20141003-003','dr-thilini','rec-galle',  7,'14:00',FALSE,'Scheduled',NULL,NULL),
    ('S09','198933912351','dr-suresh',  'rec-kandy',    4,'10:00',FALSE,'Scheduled',NULL,NULL);   -- rescheduled below

    -- Treatments (price comes from the catalogue). amends_seq = row this one corrects.
    CREATE TEMP TABLE seed_tx (
        seq INT PRIMARY KEY, ref TEXT, service_code TEXT,
        amends_seq INT, amend_reason TEXT, price_override NUMERIC(10,2), tx_id INT
    ) ON COMMIT DROP;

    INSERT INTO seed_tx (seq, ref, service_code, amends_seq, amend_reason, price_override) VALUES
        ( 1,'C01','ECG-001',NULL,NULL,NULL),
        ( 2,'C01','BLD-002',NULL,NULL,NULL),
        ( 3,'C02','ECG-001',NULL,NULL,NULL),
        ( 4,'C02','BLD-001',NULL,NULL,NULL),
        ( 5,'C02','BLD-002',NULL,NULL,NULL),
        ( 6,'C03','BLD-001',NULL,NULL,NULL),
        ( 7,'C03','INJ-001',NULL,NULL,NULL),
        ( 8,'C04','INJ-001',NULL,NULL,NULL),
        ( 9,'C04','BLD-001',NULL,NULL,NULL),
        (10,'C05','XR-001', NULL,NULL,NULL),
        (11,'C05','INJ-001',NULL,NULL,NULL),
        (12,'C06','XR-002', NULL,NULL,NULL),
        (13,'C06','DRG-001',NULL,NULL,NULL),
        (14,'C08','DRG-001',NULL,NULL,NULL),
        (15,'C09','XR-002', NULL,NULL,NULL),
        (16,'C09','INJ-001',NULL,NULL,NULL),
        (17,'C10','INJ-001',NULL,NULL,NULL),
        (18,'C11','BLD-001',NULL,NULL,NULL),
        (19,'C11','BLD-002',NULL,NULL,NULL),
        (20,'C12','XR-002', NULL,NULL,NULL),                       -- logged by mistake
        (21,'C12','INJ-002',NULL,NULL,NULL),
        (22,'C12','XR-001', 20,'Wrong service logged: chest X-ray was performed, not bone X-ray',NULL),
        (23,'C13','BLD-001',NULL,NULL,NULL),                       -- logged by mistake
        (24,'C13','DRG-001',NULL,NULL,NULL),
        (25,'C13','BLD-001',23,'Logged in error: blood count not performed, removed from bill',0.00),
        (26,'C14','BLD-001',NULL,NULL,NULL),
        (27,'C15','INJ-002',NULL,NULL,NULL),
        (28,'C15','BLD-001',NULL,NULL,NULL),
        (29,'C16','XR-002', NULL,NULL,NULL),
        (30,'C17','DRG-001',NULL,NULL,NULL),
        (31,'C18','ECG-001',NULL,NULL,NULL);

    -- Billing plan for FINALIZED invoices. C17/C18 have no row => stay Draft.
    -- claim_result NULL => no claim at all (patient has no ACTIVE policy).
    CREATE TEMP TABLE seed_bill (
        ref TEXT PRIMARY KEY, discount NUMERIC(10,2),
        claim_result TEXT, approved_override NUMERIC(10,2)
    ) ON COMMIT DROP;

    INSERT INTO seed_bill (ref, discount, claim_result, approved_override) VALUES
        ('C01',    0.00,'Approved',NULL),
        ('C02', 1000.00,NULL,NULL),
        ('C03',    0.00,'Approved',2400.00),   -- insurer approves less than claimed
        ('C04',    0.00,NULL,NULL),
        ('C05',    0.00,'Approved',NULL),
        ('C06',    0.00,'Pending', NULL),
        ('C07',    0.00,NULL,NULL),
        ('C08',    0.00,'Rejected',NULL),
        ('C09',  700.00,NULL,NULL),
        ('C10',    0.00,NULL,NULL),
        ('C11',    0.00,'Approved',NULL),
        ('C12',    0.00,NULL,NULL),
        ('C13',    0.00,NULL,NULL),
        ('C14',    0.00,'Approved',NULL),
        ('C15',    0.00,NULL,NULL),            -- policy is Inactive => no claim
        ('C16',    0.00,'Pending', NULL);

    -- Payments. amount NULL = pay whatever is still outstanding.
    CREATE TEMP TABLE seed_pay (
        ref TEXT, seq INT, method TEXT, amount NUMERIC(10,2), PRIMARY KEY (ref, seq)
    ) ON COMMIT DROP;

    INSERT INTO seed_pay (ref, seq, method, amount) VALUES
        ('C01',1,'Cash',       NULL),
        ('C02',1,'Cash',       6000.00),
        ('C02',2,'Credit Card',NULL),          -- split payment, remainder on card
        ('C03',1,'Credit Card',NULL),
        ('C04',1,'Cash',       NULL),
        ('C05',1,'Cash',       1000.00),       -- partial payment only
        ('C07',1,'Cash',       NULL),
        ('C08',1,'Credit Card',NULL),
        ('C09',1,'Cash',       NULL),
        ('C11',1,'Credit Card',NULL),
        ('C12',1,'Credit Card',NULL),
        ('C13',1,'Cash',       NULL),
        ('C15',1,'Credit Card',NULL);
        -- C06, C10, C14, C16 intentionally unpaid (Finalized)

    -- -------------------------------------------------------------------------
    -- 7. Process every visit in chronological order through the real triggers
    -- -------------------------------------------------------------------------
    FOR ra IN SELECT * FROM seed_appt ORDER BY day_off, appt_time, ref LOOP
        v_date := v_today + ra.day_off;
        v_ts   := v_date + ra.appt_time;

        IF ra.walk_in THEN
            v_created := LEAST(NOW(), (v_ts - INTERVAL '15 minutes')::TIMESTAMPTZ);
        ELSE
            v_created := LEAST(NOW(), ((v_date - 3) + TIME '08:00')::TIMESTAMPTZ);
        END IF;

        SELECT patient_id INTO v_patient_id
        FROM patient WHERE nic_passport_no = ra.patient_nic;

        INSERT INTO appointment (patient_id, doctor_staff_id, branch_id, booked_by_staff_id,
                                 appointment_date, appointment_time, is_walk_in, created_at)
        SELECT v_patient_id, d.staff_id, s.branch_id, bk.staff_id,
               v_date, ra.appt_time, ra.walk_in, v_created
        FROM user_account d
        JOIN staff s ON s.staff_id = d.staff_id,
             user_account bk
        WHERE d.username = ra.doctor_user
          AND bk.username = ra.booker_user
        RETURNING appointment_id INTO v_appt_id;

        UPDATE seed_appt SET appointment_id = v_appt_id WHERE ref = ra.ref;

        IF ra.final_status = 'Cancelled' THEN
            UPDATE appointment
            SET status = 'Cancelled', cancel_reschedule_reason = ra.reason
            WHERE appointment_id = v_appt_id;

        ELSIF ra.final_status = 'Completed' THEN
            -- Doctor completes the consultation (auto-creates Draft invoice) and logs treatments
            PERFORM pg_temp.seed_actor(ra.doctor_user);

            UPDATE appointment
            SET status = 'Completed', consultation_notes = ra.notes
            WHERE appointment_id = v_appt_id;

            FOR rt IN
                SELECT st.*, c.unit_price
                FROM seed_tx st
                JOIN treatment_catalogue c ON c.service_code = st.service_code
                WHERE st.ref = ra.ref
                ORDER BY st.seq
            LOOP
                INSERT INTO appointment_treatment
                    (appointment_id, service_code, price_at_time, is_amended,
                     amendment_reason, original_record_id, recorded_at)
                VALUES (
                    v_appt_id, rt.service_code,
                    COALESCE(rt.price_override, rt.unit_price),
                    rt.amends_seq IS NOT NULL,
                    rt.amend_reason,
                    (SELECT tx_id FROM seed_tx WHERE seq = rt.amends_seq),
                    LEAST(NOW(), (v_ts + INTERVAL '30 minutes')::TIMESTAMPTZ)
                )
                RETURNING appointment_treatment_id INTO v_tx_id;

                UPDATE seed_tx SET tx_id = v_tx_id WHERE seq = rt.seq;
            END LOOP;

            -- Invoice now holds fee + effective treatments (computed by trigger)
            SELECT invoice_id, subtotal_amount INTO v_invoice_id, v_subtotal
            FROM invoice WHERE appointment_id = v_appt_id;

            SELECT * INTO rb FROM seed_bill WHERE ref = ra.ref;

            IF NOT FOUND THEN
                -- Left as Draft (doctor just finished); only backdate created_at
                UPDATE invoice
                SET created_at = LEAST(NOW(), (v_ts + INTERVAL '20 minutes')::TIMESTAMPTZ)
                WHERE invoice_id = v_invoice_id;
            ELSE
                -- Reception finalizes the bill
                PERFORM pg_temp.seed_actor(ra.booker_user);
                SELECT staff_id INTO v_biller_id FROM user_account WHERE username = ra.booker_user;
                v_deduction := 0;

                IF rb.claim_result IS NOT NULL THEN
                    SELECT i.policy_id, substring(i.coverage_level FROM '([0-9]+)%')::NUMERIC
                    INTO v_policy, v_pct
                    FROM insurance i
                    WHERE i.patient_id = v_patient_id AND i.status = 'Active'
                    ORDER BY i.policy_id LIMIT 1;

                    IF v_policy IS NULL THEN
                        RAISE EXCEPTION 'Seed error: % has a claim planned but no Active policy', ra.ref;
                    END IF;

                    v_claimed  := ROUND(v_subtotal * v_pct / 100, 2);
                    v_approved := CASE rb.claim_result
                                    WHEN 'Approved' THEN COALESCE(rb.approved_override, v_claimed)
                                    WHEN 'Rejected' THEN 0
                                    ELSE NULL END;

                    INSERT INTO insurance_claim
                        (invoice_id, policy_id, claimed_amount, approved_amount,
                         verification_status, verification_date)
                    VALUES (
                        v_invoice_id, v_policy, v_claimed, v_approved,
                        rb.claim_result::claim_verification_status_enum,
                        CASE WHEN rb.claim_result = 'Pending' THEN NULL
                             ELSE LEAST(NOW(), (v_ts + INTERVAL '2 days')::TIMESTAMPTZ) END
                    );

                    v_deduction := COALESCE(v_approved, 0);
                END IF;

                UPDATE invoice
                SET insurance_deduction   = v_deduction,
                    manual_discount       = rb.discount,
                    status                = 'Finalized',
                    finalized_by_staff_id = v_biller_id,
                    created_at            = LEAST(NOW(), (v_ts + INTERVAL '20 minutes')::TIMESTAMPTZ)
                WHERE invoice_id = v_invoice_id;

                v_payable := v_subtotal - v_deduction - rb.discount;
                v_paid    := 0;

                FOR rp IN SELECT * FROM seed_pay WHERE ref = ra.ref ORDER BY seq LOOP
                    v_amt := COALESCE(rp.amount, v_payable - v_paid);
                    IF v_amt <= 0 OR v_paid + v_amt > v_payable THEN
                        RAISE EXCEPTION 'Seed error: bad payment amount % for %', v_amt, ra.ref;
                    END IF;

                    INSERT INTO payment (invoice_id, amount_paid, payment_method,
                                         payment_date, processed_by_staff_id)
                    VALUES (
                        v_invoice_id, v_amt, rp.method::payment_method_enum,
                        LEAST(NOW(), (v_ts + INTERVAL '1 hour' + (rp.seq - 1) * INTERVAL '5 minutes')::TIMESTAMPTZ),
                        v_biller_id
                    );
                    v_paid := v_paid + v_amt;
                END LOOP;

                IF v_paid > 0 THEN
                    UPDATE invoice
                    SET status = (CASE WHEN v_paid >= v_payable THEN 'Paid'
                                       ELSE 'Partially Paid' END)::invoice_status_enum
                    WHERE invoice_id = v_invoice_id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- Reschedule demo (BR-7 path: overlap re-check, reason recorded)
    UPDATE appointment
    SET appointment_date = v_today + 6,
        appointment_time = TIME '11:00',
        cancel_reschedule_reason = 'Rescheduled at patient request - preferred a later slot'
    WHERE appointment_id = (SELECT appointment_id FROM seed_appt WHERE ref = 'S09');

    -- -------------------------------------------------------------------------
    -- 8. Refresh-token sessions (hashes of dummy values: cannot be used to log in)
    -- -------------------------------------------------------------------------
    INSERT INTO refresh_token (staff_id, token_hash, family_id, expires_at, created_at, revoked_at)
    SELECT u.staff_id, encode(sha256(convert_to(v.seed, 'UTF8')), 'hex'), v.fam::uuid,
           v.expires, v.created, v.revoked
    FROM (VALUES
        ('demo-admin', 'demo-refresh-token-2','11111111-1111-4111-8111-111111111111',
            NOW() + INTERVAL '6 days', NOW() - INTERVAL '1 day',  NULL::timestamptz),
        ('mgr-colombo','demo-refresh-token-3','22222222-2222-4222-8222-222222222222',
            NOW() + INTERVAL '5 days', NOW() - INTERVAL '2 days', NULL::timestamptz),
        ('rec-colombo','demo-refresh-token-4','33333333-3333-4333-8333-333333333333',
            NOW() + INTERVAL '7 days', NOW() - INTERVAL '3 hours', NULL::timestamptz),
        ('dr-kasun',   'demo-refresh-token-5','44444444-4444-4444-8444-444444444444',
            NOW() - INTERVAL '1 day',  NOW() - INTERVAL '8 days', NULL::timestamptz),          -- expired
        ('rec-kandy',  'demo-refresh-token-6','55555555-5555-4555-8555-555555555555',
            NOW() + INTERVAL '4 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days')   -- logged out
    ) AS v(username, seed, fam, expires, created, revoked)
    JOIN user_account u ON u.username = v.username;

    -- Rotated token: old one is revoked and points at its replacement
    INSERT INTO refresh_token (staff_id, token_hash, family_id, expires_at, created_at,
                               revoked_at, replaced_by_hash)
    SELECT staff_id,
           encode(sha256(convert_to('demo-refresh-token-1', 'UTF8')), 'hex'),
           '11111111-1111-4111-8111-111111111111'::uuid,
           NOW() + INTERVAL '5 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day',
           encode(sha256(convert_to('demo-refresh-token-2', 'UTF8')), 'hex')
    FROM user_account WHERE username = 'demo-admin';

    -- -------------------------------------------------------------------------
    -- 9. Self-verification: abort the whole seed if any rule is violated
    -- -------------------------------------------------------------------------
    -- (a) invoice subtotal = consultation fee + effective treatments
    IF EXISTS (
        SELECT 1
        FROM invoice i
        JOIN appointment a ON a.appointment_id = i.appointment_id
        JOIN doctor d      ON d.staff_id = a.doctor_staff_id
        WHERE i.subtotal_amount <> d.consultation_fee + COALESCE((
            SELECT SUM(t.price_at_time) FROM appointment_treatment t
            WHERE t.appointment_id = i.appointment_id
              AND NOT EXISTS (SELECT 1 FROM appointment_treatment x
                              WHERE x.original_record_id = t.appointment_treatment_id)), 0)
    ) THEN
        RAISE EXCEPTION 'Verification failed: invoice subtotal does not match fee + treatments';
    END IF;

    -- (b) claims only against the same patient's ACTIVE policy
    IF EXISTS (
        SELECT 1
        FROM insurance_claim c
        JOIN invoice i     ON i.invoice_id = c.invoice_id
        JOIN appointment a ON a.appointment_id = i.appointment_id
        JOIN insurance p   ON p.policy_id = c.policy_id
        WHERE p.patient_id <> a.patient_id OR p.status <> 'Active'
    ) THEN
        RAISE EXCEPTION 'Verification failed: claim linked to wrong patient or inactive policy';
    END IF;

    -- (c) insurance_deduction equals the approved claim amount (0 if none/pending/rejected)
    IF EXISTS (
        SELECT 1 FROM invoice i
        LEFT JOIN insurance_claim c ON c.invoice_id = i.invoice_id
        WHERE i.insurance_deduction <> COALESCE(c.approved_amount, 0)
    ) THEN
        RAISE EXCEPTION 'Verification failed: insurance_deduction differs from approved claim';
    END IF;

    -- (d) payments are consistent with invoice status
    IF EXISTS (
        SELECT 1 FROM v_invoice_outstanding
        WHERE outstanding_amount < 0
           OR (status = 'Paid'           AND outstanding_amount <> 0)
           OR (status = 'Partially Paid' AND (amount_paid <= 0 OR outstanding_amount <= 0))
           OR (status IN ('Draft','Finalized') AND amount_paid > 0 AND outstanding_amount = 0)
           OR (status = 'Draft'          AND amount_paid > 0)
    ) THEN
        RAISE EXCEPTION 'Verification failed: payment totals inconsistent with invoice status';
    END IF;

    -- (e) invoices exist exactly for Completed appointments
    IF EXISTS (SELECT 1 FROM appointment a LEFT JOIN invoice i USING (appointment_id)
               WHERE (a.status = 'Completed') <> (i.invoice_id IS NOT NULL)) THEN
        RAISE EXCEPTION 'Verification failed: invoice / Completed appointment mismatch';
    END IF;

    -- Summary
    FOREACH v_tbl IN ARRAY ARRAY[
        'role','specialty','treatment_catalogue','branch','staff','staff_phone','doctor',
        'doctor_specialty','user_account','patient','patient_phone','guardian','guardian_phone',
        'patient_guardian','insurance','appointment','appointment_treatment','invoice',
        'payment','insurance_claim','audit_log','refresh_token']
    LOOP
        EXECUTE format('SELECT count(*) FROM %I', v_tbl) INTO v_cnt;
        RAISE NOTICE 'seed check: % = % rows', v_tbl, v_cnt;
    END LOOP;

    DROP FUNCTION pg_temp.seed_actor(TEXT);
END;
$seed$;

ANALYZE;