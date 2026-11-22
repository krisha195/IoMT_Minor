import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import os
import json
from security import hash_password

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

def get_db():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        dbname=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )
    conn.autocommit = False
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER,
            gender TEXT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'patient',
            care_status TEXT DEFAULT 'STANDARD_MONITORING',
            surgery_name TEXT,
            surgery_date DATE,
            discharge_date DATE,
            primary_diagnosis TEXT,
            baseline_hr REAL DEFAULT 72.0,
            baseline_spo2 REAL DEFAULT 98.0,
            baseline_temp REAL DEFAULT 30.0
        );

        -- Add columns if patients table already existed without them
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS care_status TEXT DEFAULT 'STANDARD_MONITORING';
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS surgery_name TEXT;
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS surgery_date DATE;
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS discharge_date DATE;
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS primary_diagnosis TEXT;
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS baseline_hr REAL DEFAULT 72.0;
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS baseline_spo2 REAL DEFAULT 98.0;
        ALTER TABLE patients ADD COLUMN IF NOT EXISTS baseline_temp REAL DEFAULT 30.0;

        CREATE TABLE IF NOT EXISTS vitals (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            hr REAL, spo2 REAL, temperature REAL,
            ax REAL DEFAULT 0, ay REAL DEFAULT 0, az REAL DEFAULT 0,
            motion_score REAL DEFAULT 0,
            motion_status TEXT DEFAULT 'STABLE',
            finger_detected BOOLEAN DEFAULT TRUE
        );

        -- Add columns if vitals table already existed without them
        ALTER TABLE vitals ADD COLUMN IF NOT EXISTS ax REAL DEFAULT 0;
        ALTER TABLE vitals ADD COLUMN IF NOT EXISTS ay REAL DEFAULT 0;
        ALTER TABLE vitals ADD COLUMN IF NOT EXISTS az REAL DEFAULT 0;
        ALTER TABLE vitals ADD COLUMN IF NOT EXISTS motion_score REAL DEFAULT 0;
        ALTER TABLE vitals ADD COLUMN IF NOT EXISTS motion_status TEXT DEFAULT 'STABLE';
        ALTER TABLE vitals ADD COLUMN IF NOT EXISTS finger_detected BOOLEAN DEFAULT TRUE;

        CREATE TABLE IF NOT EXISTS alerts (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            acknowledged BOOLEAN DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL REFERENCES patients(id),
            receiver_id INTEGER NOT NULL REFERENCES patients(id),
            message TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            is_read BOOLEAN DEFAULT FALSE
        );

        -- ── Recovery Care Tasks Checklist ──────────────────────────────
        CREATE TABLE IF NOT EXISTS care_tasks (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            doctor_id INTEGER REFERENCES patients(id),
            title TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            instructions TEXT,
            scheduled_time TEXT,
            priority TEXT DEFAULT 'medium',
            due_date DATE DEFAULT CURRENT_DATE,
            status TEXT DEFAULT 'pending',
            assigned_to_user_id INTEGER REFERENCES patients(id),
            completed_at TIMESTAMPTZ,
            completed_by_id INTEGER REFERENCES patients(id),
            completed_by_name TEXT,
            completed_by_role TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- ── Medications & Tracking ─────────────────────────────────────
        CREATE TABLE IF NOT EXISTS medications (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            prescribed_by_id INTEGER REFERENCES patients(id),
            name TEXT NOT NULL,
            dosage TEXT NOT NULL,
            frequency TEXT NOT NULL,
            scheduled_timings TEXT,
            start_date DATE,
            end_date DATE,
            instructions TEXT,
            status TEXT DEFAULT 'active',
            source TEXT DEFAULT 'discharge',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS medication_doses (
            id SERIAL PRIMARY KEY,
            medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            scheduled_time TIMESTAMPTZ NOT NULL,
            status TEXT DEFAULT 'pending',
            taken_at TIMESTAMPTZ,
            confirmed_by_id INTEGER REFERENCES patients(id),
            confirmed_by_name TEXT,
            confirmed_by_role TEXT
        );

        -- ── Prescription Reconciliation ────────────────────────────────
        CREATE TABLE IF NOT EXISTS prescription_reconciliations (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            medication_name TEXT NOT NULL,
            conflict_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            description TEXT NOT NULL,
            recommendation TEXT NOT NULL,
            status TEXT DEFAULT 'pending_review',
            reviewed_by_id INTEGER REFERENCES patients(id),
            resolution_notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- ── Surgery & Treatment History ────────────────────────────────
        CREATE TABLE IF NOT EXISTS surgery_history (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            procedure_name TEXT NOT NULL,
            procedure_date DATE NOT NULL,
            indication TEXT NOT NULL,
            hospital_name TEXT,
            admission_date DATE,
            discharge_date DATE,
            discharge_summary TEXT,
            doctor_instructions TEXT,
            medication_changes TEXT,
            followup_appointments JSONB DEFAULT '[]'::jsonb,
            recovery_milestones JSONB DEFAULT '[]'::jsonb,
            outcomes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- ── Recovery Progress Clinical Assessments ──────────────────────
        CREATE TABLE IF NOT EXISTS recovery_assessments (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            doctor_id INTEGER NOT NULL REFERENCES patients(id),
            assessment_date TIMESTAMPTZ DEFAULT NOW(),
            clinical_notes TEXT NOT NULL,
            adherence_score REAL,
            vital_stability_score REAL,
            overall_status TEXT DEFAULT 'on_track',
            plan_adjustments TEXT
        );

        -- ── Caregivers Coordination ────────────────────────────────────
        CREATE TABLE IF NOT EXISTS caregivers (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES patients(id),
            caregiver_user_id INTEGER NOT NULL REFERENCES patients(id),
            relationship TEXT NOT NULL,
            phone TEXT,
            can_complete_tasks BOOLEAN DEFAULT TRUE,
            can_view_vitals BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)

    if os.getenv("SEED_DEMO_DATA", "false").lower() not in {"1", "true", "yes"}:
        conn.commit()
        conn.close()
        return

    # Seed demo users
    users = [
        ("Dr. Sharma",       45, "Male",   "doctor",     "doctor123",  "doctor",    "STANDARD_MONITORING"),
        ("Rahul Mehta",      32, "Male",   "patient1",   "patient123", "patient",   "POST_TREATMENT_RECOVERY"),
        ("Priya Singh",      28, "Female", "patient2",   "pass123",    "patient",   "STANDARD_MONITORING"),
        ("Aarav Patel",      58, "Male",   "patient3",   "pass123",    "patient",   "POST_TREATMENT_RECOVERY"),
        ("Ananya Iyer",      42, "Female", "patient4",   "pass123",    "patient",   "STANDARD_MONITORING"),
        ("Vikramaditya Rao", 67, "Male",   "patient5",   "pass123",    "patient",   "POST_TREATMENT_RECOVERY"),
        ("Sunita Verma",     51, "Female", "patient6",   "pass123",    "patient",   "STANDARD_MONITORING"),
    ]
    for u in users:
        c.execute("""
            INSERT INTO patients (name,age,gender,username,password,role,care_status)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (username) DO UPDATE SET
                role = EXCLUDED.role,
                care_status = EXCLUDED.care_status
        """, (
            u[0], u[1], u[2], u[3], hash_password(u[4]), u[5], u[6]
        ))

    # Fetch IDs
    c.execute("SELECT id, username FROM patients")
    uid_map = {row[1]: row[0] for row in c.fetchall()}
    doc_id = uid_map.get("doctor")
    rahul_id = uid_map.get("patient1")
    priya_id = uid_map.get("patient2")
    aarav_id = uid_map.get("patient3")
    ananya_id = uid_map.get("patient4")
    vikram_id = uid_map.get("patient5")
    sunita_id = uid_map.get("patient6")

    # Update metadata for patients
    if aarav_id:
        c.execute("""
            UPDATE patients SET
                care_status = 'POST_TREATMENT_RECOVERY',
                surgery_name = 'Total Knee Arthroplasty (TKA)',
                surgery_date = CURRENT_DATE - INTERVAL '5 days',
                discharge_date = CURRENT_DATE - INTERVAL '2 days',
                primary_diagnosis = 'Severe Tricompartmental Osteoarthritis (Post-Op Day 5)',
                baseline_hr = 72.0,
                baseline_spo2 = 98.0,
                baseline_temp = 36.6
            WHERE id = %s
        """, (aarav_id,))

    if ananya_id:
        c.execute("""
            UPDATE patients SET
                primary_diagnosis = 'Hypertension & Cardiac Telemetry Surveillance',
                baseline_hr = 76.0,
                baseline_spo2 = 97.5,
                baseline_temp = 36.8
            WHERE id = %s
        """, (ananya_id,))

    if vikram_id:
        c.execute("""
            UPDATE patients SET
                care_status = 'POST_TREATMENT_RECOVERY',
                surgery_name = 'Coronary Artery Bypass Graft (CABG)',
                surgery_date = CURRENT_DATE - INTERVAL '8 days',
                discharge_date = CURRENT_DATE - INTERVAL '3 days',
                primary_diagnosis = 'Triple Vessel CAD (Post-Op Day 8)',
                baseline_hr = 68.0,
                baseline_spo2 = 98.5,
                baseline_temp = 36.7
            WHERE id = %s
        """, (vikram_id,))

    if sunita_id:
        c.execute("""
            UPDATE patients SET
                primary_diagnosis = 'Post-Viral Asthenia & Respiratory Recovery',
                baseline_hr = 80.0,
                baseline_spo2 = 96.8,
                baseline_temp = 36.9
            WHERE id = %s
        """, (sunita_id,))

    # Update Rahul Mehta post-treatment metadata
    if rahul_id:
        c.execute("""
            UPDATE patients SET
                care_status = 'POST_TREATMENT_RECOVERY',
                surgery_name = 'Laparoscopic Cholecystectomy',
                surgery_date = CURRENT_DATE - INTERVAL '3 days',
                discharge_date = CURRENT_DATE - INTERVAL '1 day',
                primary_diagnosis = 'Acute Cholecystitis (Post-Op Day 3)',
                baseline_hr = 74.0,
                baseline_spo2 = 98.2,
                baseline_temp = 36.8
            WHERE id = %s
        """, (rahul_id,))

        # Seed Surgery History for Rahul Mehta
        milestones = json.dumps([
            {"day": 1, "milestone": "Tolerate clear oral fluids & bed mobilization", "status": "completed"},
            {"day": 2, "milestone": "Full oral diet & unassisted ambulation", "status": "completed"},
            {"day": 4, "milestone": "Incision dry, normal bowel function & pain < 3/10", "status": "in_progress"},
            {"day": 7, "milestone": "Wound review & surgical suture inspection", "status": "pending"},
            {"day": 14, "milestone": "Full recovery check & clearance for regular activity", "status": "pending"}
        ])
        followups = json.dumps([
            {"date": "2026-11-05", "doctor": "Dr. Sharma", "clinic": "Surgical OPD Room 4", "status": "scheduled", "purpose": "1-Week Post-Op Wound Inspection"},
            {"date": "2026-11-12", "doctor": "Dr. Sharma", "clinic": "Surgical OPD Room 4", "status": "scheduled", "purpose": "2-Week Recovery Milestone Review"}
        ])
        c.execute("""
            INSERT INTO surgery_history (
                patient_id, procedure_name, procedure_date, indication, hospital_name,
                admission_date, discharge_date, discharge_summary, doctor_instructions,
                medication_changes, followup_appointments, recovery_milestones, outcomes
            )
            SELECT %s, 'Laparoscopic Cholecystectomy', CURRENT_DATE - INTERVAL '3 days',
                   'Symptomatic Cholelithiasis with Acute Cholecystitis', 'Apollo Multispecialty Hospital',
                   CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE - INTERVAL '1 day',
                   'Patient underwent uneventful laparoscopic cholecystectomy. 4 ports used. Gallbladder sent for histopathology. Minimal blood loss. Hemodynamically stable upon discharge.',
                   'Keep trocar wound dry. Wear supportive abdominal binder when walking. Incentive spirometry 10 breaths every 2 hours. Report fever > 38°C or persistent abdominal distension.',
                   'Discontinued pre-op Aspirin 75mg. Started Cefuroxime 500mg BD x 5 days, Tramadol 50mg SOS, Pantoprazole 40mg OD.',
                   %s::jsonb, %s::jsonb, 'Uncomplicated post-operative recovery course'
            WHERE NOT EXISTS (SELECT 1 FROM surgery_history WHERE patient_id = %s)
        """, (rahul_id, followups, milestones, rahul_id))

        # Seed Care Tasks for Rahul Mehta
        tasks = [
            (rahul_id, doc_id, "Incentive Spirometry (10 Breaths)", "Breathing Exercise", "Take slow deep breaths using spirometer, hold for 3 seconds. Helps prevent atelectasis.", "08:00 AM", "high", "completed", rahul_id, "Rahul Mehta", "patient"),
            (rahul_id, doc_id, "Wound Dressing Inspection & Sterility Check", "Wound Dressing", "Inspect umbilical and subcostal port dressings for discharge or redness. Ensure dry skin.", "09:30 AM", "high", "completed", rahul_id, "Rahul Mehta", "patient"),
            (rahul_id, doc_id, "Post-Op Morning Mobility Walk (15 Mins)", "Physiotherapy", "Gentle indoor ambulation. Avoid sudden bends or lifting > 3kg.", "11:00 AM", "medium", "completed", rahul_id, "Rahul Mehta", "patient"),
            (rahul_id, doc_id, "Afternoon Vitals & Temperature Log", "Vitals Check", "Log resting HR, SpO2, and oral temperature via IoMT sensor.", "02:00 PM", "high", "pending", None, None, None),
            (rahul_id, doc_id, "Gentle Abdominal Isometric Exercises", "Physiotherapy", "Perform 5 repetitions of gentle pelvic tilting while seated in armchair.", "05:00 PM", "medium", "pending", None, None, None),
            (rahul_id, doc_id, "Evening Spirometry & Deep Breathing", "Breathing Exercise", "10 gentle repetitions before dinner.", "08:00 PM", "medium", "pending", None, None, None),
            (rahul_id, doc_id, "Low-Fat High-Protein Dinner Diet Adherence", "Dietary", "Steamed vegetables, lentils, lean protein. Avoid oily, spicy, or fried foods.", "08:30 PM", "low", "pending", None, None, None),
        ]
        for t in tasks:
            c.execute("""
                INSERT INTO care_tasks (patient_id, doctor_id, title, category, instructions, scheduled_time, priority, status, completed_by_id, completed_by_name, completed_by_role, completed_at)
                SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, (CASE WHEN %s = 'completed' THEN NOW() - INTERVAL '2 hours' ELSE NULL END)
                WHERE NOT EXISTS (
                    SELECT 1 FROM care_tasks WHERE patient_id = %s AND title = %s
                )
            """, (*t, t[7], rahul_id, t[2]))

        # Seed Medications for Rahul Mehta
        meds = [
            (rahul_id, doc_id, "Cefuroxime Axetil", "500 mg", "Twice daily after meals", "09:00 AM, 09:00 PM", "Oral antibiotic course to prevent surgical site infection. Complete full 5 days.", "active", "discharge"),
            (rahul_id, doc_id, "Paracetamol", "650 mg", "Every 6-8 hours SOS", "08:00 AM, 02:00 PM, 08:00 PM", "For post-operative incisional pain and temperature control. Max 3g daily.", "active", "discharge"),
            (rahul_id, doc_id, "Pantoprazole", "40 mg", "Once daily before breakfast", "07:30 AM", "Gastric protection while on oral post-op regimen.", "active", "discharge"),
            (rahul_id, doc_id, "Tramadol HCl", "50 mg", "SOS for breakthrough pain", "As needed", "Only if paracetamol insufficient. Do not drive or operate machinery.", "active", "discharge"),
            (rahul_id, doc_id, "Aspirin (Pre-Hospital)", "75 mg", "Once daily", "08:00 AM", "Pre-admission antiplatelet. Temporarily discontinued post-surgery due to bleeding risk.", "discontinued", "pre_hospital"),
        ]
        for m in meds:
            c.execute("""
                INSERT INTO medications (patient_id, prescribed_by_id, name, dosage, frequency, scheduled_timings, instructions, status, source)
                SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s
                WHERE NOT EXISTS (
                    SELECT 1 FROM medications WHERE patient_id = %s AND name = %s
                )
            """, (*m, rahul_id, m[2]))

        # Seed Prescription Reconciliation Flag
        c.execute("""
            INSERT INTO prescription_reconciliations (
                patient_id, medication_name, conflict_type, severity, description, recommendation, status
            )
            SELECT %s, 'Aspirin 75mg vs Post-Op Recovery Protocol', 'discontinued_conflict', 'warning',
                   'Patient was on pre-hospital Aspirin 75mg daily. Discharge protocol instructed withholding antiplatelet for 7 days post-cholecystectomy. Ensure patient does not resume pre-hospital supply until authorized.',
                   'Doctor review required at Day 7 post-op visit before restarting antiplatelet.', 'pending_review'
            WHERE NOT EXISTS (
                SELECT 1 FROM prescription_reconciliations WHERE patient_id = %s AND medication_name = 'Aspirin 75mg vs Post-Op Recovery Protocol'
            )
        """, (rahul_id, rahul_id))

        # Seed Recovery Assessment
        c.execute("""
            INSERT INTO recovery_assessments (patient_id, doctor_id, clinical_notes, adherence_score, vital_stability_score, overall_status, plan_adjustments)
            SELECT %s, %s, 'Patient is progressing favorably on Post-Op Day 3. Incision sites clean without serosanguinous discharge. Mild incisional discomfort managed with Paracetamol. Vitals stable within expected baseline.',
                   92.5, 96.0, 'on_track', 'Maintain incentive spirometry and progressive mobilization. Proceed with scheduled Day 7 outpatient wound review.'
            WHERE NOT EXISTS (SELECT 1 FROM recovery_assessments WHERE patient_id = %s)
        """, (rahul_id, doc_id, rahul_id))

    # Seed baseline curated alerts if table is empty
    c.execute("SELECT COUNT(*) FROM alerts;")
    if c.fetchone()[0] == 0:
        base_alerts = [
            (rahul_id, 'fall_detected', 'critical', 'Fall detected! Confidence: 96.8% (Impact shockwave 2.85g followed by immobility)', False),
            (ananya_id, 'clinical_hr', 'high', 'HR high: 112.5 BPM (clinical threshold breach: normal resting 40-100)', False),
            (vikram_id, 'adaptive_spo2', 'high', 'SpO2 deviating from personal baseline: 93.8% during physical therapy exercises (baseline 98.5±0.6%)', False),
            (sunita_id, 'ml_vitals_anomaly', 'medium', 'ML Transformer model detected minor vital co-dynamic fluctuation during recovery check.', False),
            (aarav_id, 'clinical_temperature', 'medium', 'TEMPERATURE elevated: 37.8°C (mild post-op reactive subfebrile, monitored)', False),
            (rahul_id, 'adaptive_hr', 'medium', 'HR elevated above personal baseline: 98.4 BPM during post-op ambulation (baseline 74.0±3.2)', False),
            (aarav_id, 'adaptive_hr', 'medium', 'HR deviating from personal baseline: 88.0 BPM during assisted knee flexion (baseline 72.0±2.8)', True),
            (priya_id, 'motion_artifact', 'low', 'Patient movement detected (MODERATE motion). PPG vitals verified within normal range.', True),
        ]
        for ba in base_alerts:
            if ba[0]:
                c.execute("""
                    INSERT INTO alerts (patient_id, alert_type, severity, message, acknowledged)
                    VALUES (%s, %s, %s, %s, %s);
                """, ba)

    conn.commit()
    conn.close()
