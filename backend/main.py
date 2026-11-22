from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio, json, os
from statistics import mean, pstdev
from functools import partial
from dotenv import load_dotenv

from database import init_db, get_db
from security import hash_password, is_legacy_password, verify_password
from models import (
    VitalsPayload, LoginRequest, MessageRequest, CareStatusUpdate,
    CareTaskCreate, MedicationCreate, ReconciliationResolve,
    SurgeryHistoryCreate, MilestoneUpdate, AssessmentCreate,
    CaregiverLink, CopilotQuery
)
from ml_inference import infer_vitals, infer_fall
from alert_engine import check_alerts, calculate_motion_aware_risk, CLINICAL
from ai_advisor import (
    analyze_vitals_ai, detect_recovery_deterioration,
    reconcile_prescriptions, answer_caregiver_query,
    calculate_recovery_progress
)

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be configured in backend/.env")
ALGORITHM  = "HS256"

app = FastAPI(title="PulseNet — Every Pulse Matters")
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

# ── WebSocket Manager ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.alert_clients: List[WebSocket] = []
        self.chat_clients: Dict[int, List[WebSocket]] = {}

    async def connect_alerts(self, ws: WebSocket):
        await ws.accept()
        self.alert_clients.append(ws)

    async def connect_chat(self, ws: WebSocket, user_id: int):
        await ws.accept()
        if user_id not in self.chat_clients:
            self.chat_clients[user_id] = []
        self.chat_clients[user_id].append(ws)

    def disconnect_alerts(self, ws: WebSocket):
        if ws in self.alert_clients:
            self.alert_clients.remove(ws)

    def disconnect_chat(self, user_id: int, ws: Optional[WebSocket] = None):
        if user_id in self.chat_clients:
            if ws and ws in self.chat_clients[user_id]:
                self.chat_clients[user_id].remove(ws)
            elif ws is None:
                self.chat_clients.pop(user_id, None)
            if user_id in self.chat_clients and not self.chat_clients[user_id]:
                self.chat_clients.pop(user_id, None)

    async def broadcast_alert(self, data: dict):
        dead = []
        for ws in list(self.alert_clients):
            try:
                await ws.send_text(json.dumps(data))
            except:
                dead.append(ws)
        for ws in dead:
            if ws in self.alert_clients:
                self.alert_clients.remove(ws)

    async def send_chat(self, user_id: int, data: dict):
        clients = list(self.chat_clients.get(user_id, []))
        dead = []
        for ws in clients:
            try:
                await ws.send_text(json.dumps(data))
            except:
                dead.append(ws)
        for ws in dead:
            self.disconnect_chat(user_id, ws)

manager = ConnectionManager()

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()

# ── Auth & Permissions ────────────────────────────────────────────────────────
def create_token(data: dict):
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=12)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def check_patient_access(user: dict, patient_id: int, db=None):
    role = user.get("role")
    sub  = user.get("sub")
    if role == "doctor":
        return True
    if role == "patient" and sub == str(patient_id):
        return True
    raise HTTPException(status_code=403, detail="Not authorized to access this patient's records")

def verify_recovery_eligibility(patient_id: int, db, allow_completed: bool = True):
    c = db.cursor()
    c.execute("SELECT care_status FROM patients WHERE id=%s", (patient_id,))
    row = c.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")
    status = row[0] or "STANDARD_MONITORING"
    if status == "STANDARD_MONITORING":
        raise HTTPException(
            status_code=403,
            detail="Patient is enrolled in Standard Monitoring. Post-treatment recovery features are restricted to eligible patients."
        )
    if not allow_completed and status == "RECOVERY_COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Recovery care program has been officially completed. Active checklist and medication modifications are closed."
        )
    return status

@app.post("/api/signup")
def signup(req: LoginRequest):
    db = get_db()
    c  = db.cursor()
    role = req.role if req.role in ('patient', 'doctor') else 'patient'
    try:
        c.execute(
            """INSERT INTO patients (name,age,gender,username,password,role,care_status)
               VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (req.username, None, None, req.username, hash_password(req.password), role, "STANDARD_MONITORING")
        )
        row = c.fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Insert failed")
        new_id = row[0]
        db.commit()
        token = create_token({"sub": str(new_id), "role": role, "name": req.username})
        return {
            "access_token": token, "token_type": "bearer",
            "role": role, "name": req.username, "patient_id": new_id,
            "care_status": "STANDARD_MONITORING"
        }
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username already exists")
    finally:
        db.close()

@app.post("/api/login")
def login(req: LoginRequest):
    db = get_db()
    c  = db.cursor()
    c.execute("""
        SELECT id, name, age, gender, username, password, role, care_status
        FROM patients WHERE username=%s
    """, (req.username,))
    user = c.fetchone()
    if not user or not verify_password(req.password, user[5]):
        db.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if is_legacy_password(user[5]):
        c.execute(
            "UPDATE patients SET password=%s WHERE id=%s",
            (hash_password(req.password), user[0]),
        )
        db.commit()
    db.close()
    token = create_token({"sub": str(user[0]), "role": user[6], "name": user[1]})
    return {
        "access_token": token, "token_type": "bearer",
        "role": user[6], "name": user[1], "patient_id": user[0],
        "care_status": user[7] or "STANDARD_MONITORING"
    }

# ── Vitals Ingestion (IoT Simulator / ESP32 Hardware) ─────────────────────────
_last_alert_time: dict[tuple[int, str], float] = {}  # (patient_id, alert_type) -> timestamp

def _process_vitals(payload: VitalsPayload):
    # Sanitize optical PPG data when finger is detached or sends 0 or null
    if payload.finger_detected is False or (payload.hr is not None and payload.hr <= 0):
        payload.hr = None
        payload.finger_detected = False
    if payload.finger_detected is False or (payload.spo2 is not None and payload.spo2 <= 0):
        payload.spo2 = None
    if payload.hr is None and payload.spo2 is None:
        payload.finger_detected = False

    db = get_db()
    try:
        c = db.cursor()
        motion_score = float(payload.motion_score) if payload.motion_score is not None else 0.0
        motion_status = str(payload.motion_status) if payload.motion_status is not None else "STABLE"
        finger_detected = bool(payload.finger_detected) if payload.finger_detected is not None else False

        c.execute(
            """INSERT INTO vitals (patient_id, hr, spo2, temperature, ax, ay, az, motion_score, motion_status, finger_detected)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING timestamp""",
            (
                payload.patient_id, payload.hr, payload.spo2, payload.temperature,
                payload.ax, payload.ay, payload.az,
                motion_score, motion_status, finger_detected
            )
        )
        ts_row = c.fetchone()
        sample_timestamp = ts_row[0] if ts_row else datetime.utcnow()
        ts = sample_timestamp.isoformat()

        vitals_result = infer_vitals(payload.patient_id, payload.hr, payload.spo2, payload.temperature)
        ax = payload.ax if payload.ax is not None else 0.0
        ay = payload.ay if payload.ay is not None else 0.0
        az = payload.az if payload.az is not None else 0.0
        fall_result = infer_fall(payload.patient_id, ax, ay, az)
        raw_alerts = check_alerts(
            payload.patient_id, payload.hr, payload.spo2, payload.temperature,
            vitals_result["anomaly"], fall_result["fall_detected"], fall_result["confidence"],
            motion_status=motion_status, finger_detected=finger_detected
        )

        import time
        now = time.time()
        filtered_alerts = []
        for alert in raw_alerts:
            key = (payload.patient_id, alert["alert_type"])
            # Cooldown: Suppress identical alert type for same patient if fired within last 60 seconds
            if now - _last_alert_time.get(key, 0.0) < 60.0:
                continue
            _last_alert_time[key] = now
            c.execute(
                """INSERT INTO alerts (patient_id, timestamp, alert_type, severity, message)
                   VALUES (%s, %s, %s, %s, %s)""",
                (
                    payload.patient_id, sample_timestamp, alert["alert_type"],
                    alert["severity"], alert["message"]
                )
            )
            filtered_alerts.append(alert)

        db.commit()
        return ts, vitals_result, fall_result, filtered_alerts, motion_score, motion_status, finger_detected
    finally:
        db.close()

@app.post("/api/vitals")
async def receive_vitals(payload: VitalsPayload):
    loop = asyncio.get_running_loop()
    ts, vitals_result, fall_result, alerts, motion_score, motion_status, finger_detected = await loop.run_in_executor(
        None, partial(_process_vitals, payload)
    )

    # Immediately broadcast live telemetry packet over WebSocket for zero-lag streaming
    await manager.broadcast_alert({
        "event": "vital",
        "patient_id": payload.patient_id,
        "timestamp": ts,
        "hr": payload.hr,
        "spo2": payload.spo2,
        "temperature": payload.temperature,
        "ax": payload.ax,
        "ay": payload.ay,
        "az": payload.az,
        "motion_score": motion_score,
        "motion_status": motion_status,
        "finger_detected": finger_detected
    })

    for alert in alerts:
        await manager.broadcast_alert({"event": "alert", "patient_id": payload.patient_id, "timestamp": ts, **alert})

    return {
        "status": "ok",
        "timestamp": ts,
        "vitals_result": vitals_result,
        "fall_result": fall_result,
        "motion_score": motion_score,
        "motion_status": motion_status,
        "finger_detected": finger_detected,
        "alerts_fired": len(alerts)
    }

# ── Core Vitals & Alerts APIs ─────────────────────────────────────────────────
@app.get("/api/vitals/{patient_id}")
def get_vitals(patient_id: int, limit: int = 60, range: Optional[str] = None, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        c = db.cursor()
        keys = ["id","patient_id","timestamp","hr","spo2","temperature","ax","ay","az","motion_score","motion_status","finger_detected"]
        interval_map = {
            "1h": "INTERVAL '1 hour'",
            "6h": "INTERVAL '6 hours'",
            "24h": "INTERVAL '24 hours'",
            "7d": "INTERVAL '7 days'",
        }
        if range and range in interval_map:
            c.execute(
                f"""SELECT id,patient_id,timestamp,hr,spo2,temperature,ax,ay,az,motion_score,motion_status,finger_detected
                    FROM vitals
                    WHERE patient_id=%s AND timestamp > NOW() - {interval_map[range]}
                    ORDER BY timestamp ASC""",
                (patient_id,)
            )
            rows = c.fetchall()
            return [dict(zip(keys, [str(v) if hasattr(v,'isoformat') else v for v in r])) for r in rows]
        else:
            c.execute(
                """SELECT id,patient_id,timestamp,hr,spo2,temperature,ax,ay,az,motion_score,motion_status,finger_detected
                   FROM vitals WHERE patient_id=%s ORDER BY timestamp DESC LIMIT %s""",
                (patient_id, limit)
            )
            rows = c.fetchall()
            return [dict(zip(keys, [str(v) if hasattr(v,'isoformat') else v for v in r])) for r in reversed(rows)]
    finally:
        db.close()

@app.get("/api/alerts/{patient_id}")
def get_alerts(patient_id: int, limit: int = 20, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        c = db.cursor()
        c.execute(
            "SELECT id,patient_id,timestamp,alert_type,severity,message,acknowledged FROM alerts WHERE patient_id=%s ORDER BY timestamp DESC LIMIT %s",
            (patient_id, limit)
        )
        rows = c.fetchall()
        keys = ["id","patient_id","timestamp","alert_type","severity","message","acknowledged"]
        return [dict(zip(keys, [str(v) if hasattr(v,'isoformat') else v for v in r])) for r in rows]
    finally:
        db.close()

@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, user=Depends(get_current_user)):
    db = get_db()
    c  = db.cursor()
    c.execute("UPDATE alerts SET acknowledged=TRUE WHERE id=%s", (alert_id,))
    db.commit()
    db.close()
    return {"status": "acknowledged"}

@app.delete("/api/alerts/{patient_id}")
def clear_patient_alerts(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        c = db.cursor()
        c.execute("DELETE FROM alerts WHERE patient_id=%s", (patient_id,))
        db.commit()
        return {"status": "cleared", "patient_id": patient_id}
    finally:
        db.close()

@app.delete("/api/alerts")
def clear_all_alerts(user=Depends(get_current_user)):
    db = get_db()
    try:
        c = db.cursor()
        c.execute("DELETE FROM alerts")
        db.commit()
        return {"status": "all_alerts_cleared"}
    finally:
        db.close()

@app.delete("/api/alerts/single/{alert_id}")
def delete_single_alert(alert_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        c = db.cursor()
        c.execute("DELETE FROM alerts WHERE id=%s", (alert_id,))
        db.commit()
        return {"status": "deleted", "alert_id": alert_id}
    finally:
        db.close()

# ── 1. AI-Based Suggestions Using Patient Vitals (ALL PATIENTS) ───────────────
@app.get("/api/vitals/{patient_id}/ai-suggestions")
def get_ai_vital_suggestions(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        return analyze_vitals_ai(patient_id, db)
    finally:
        db.close()

# ── Health Risk Score ─────────────────────────────────────────────────────────
@app.get("/api/risk/{patient_id}")
def get_risk_score(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        c = db.cursor()
        c.execute(
            """SELECT hr, spo2, temperature, motion_status, timestamp
               FROM vitals
               WHERE patient_id=%s
               ORDER BY timestamp DESC LIMIT 1""",
            (patient_id,)
        )
        row = c.fetchone()

        c.execute(
            """SELECT hr, spo2, temperature
               FROM vitals
               WHERE patient_id=%s
               ORDER BY timestamp DESC
               LIMIT 60""",
            (patient_id,)
        )
        baseline_rows = c.fetchall()

        baselines = {}
        for key, index, unit in (
            ("Heart Rate", 0, "bpm"),
            ("SpO2", 1, "%"),
            ("Temperature", 2, "C"),
        ):
            values = [
                float(row[index])
                for row in baseline_rows
                if row[index] is not None
            ]
            if values:
                baselines[key] = {
                    "mean": round(mean(values), 1),
                    "std": round(pstdev(values), 1),
                    "samples": len(values),
                    "unit": unit,
                }

        if not row:
            return {"score": None, "level": "unknown", "contributions": [], "explanation": "No vitals data yet"}

        hr_raw, spo2_raw, temp_raw, motion_status, latest_vitals_at = row
        if hr_raw is None or spo2_raw is None:
            missing = []
            if hr_raw is None:
                missing.append("heart rate")
            if spo2_raw is None:
                missing.append("SpO₂")
            return {
                "score": None,
                "level": "unknown",
                "contributions": [],
                "explanation": (
                    "Risk score unavailable: "
                    + " and ".join(missing)
                    + " sensor reading(s) missing. Check finger placement on the sensor."
                ),
            }

        c.execute(
            """SELECT alert_type
               FROM alerts
               WHERE patient_id=%s AND timestamp=%s
               ORDER BY timestamp DESC""",
            (patient_id, latest_vitals_at)
        )
        recent_alert_types = [alert_row[0] for alert_row in c.fetchall()]

        hr = float(hr_raw) if hr_raw is not None else None
        spo2 = float(spo2_raw) if spo2_raw is not None else None
        temp = float(temp_raw) if temp_raw is not None else None
        motion_status = motion_status or "STABLE"

        risk = calculate_motion_aware_risk(
            hr=hr,
            spo2=spo2,
            temperature=temp,
            motion_status=motion_status,
            fall_detected="fall_detected" in recent_alert_types,
            vitals_anomaly="ml_vitals_anomaly" in recent_alert_types,
            recent_alert_types=recent_alert_types,
        )
        risk_drivers = []
        if "fall_detected" in recent_alert_types:
            risk_drivers.append("fall detection")
        if "ml_vitals_anomaly" in recent_alert_types:
            risk_drivers.append("ML vitals anomaly")
        if risk_drivers:
            risk["explanation"] += (
                " The latest sensor reading also triggered: "
                + ", ".join(risk_drivers)
                + "."
            )
        risk["baselines"] = baselines
        risk["thresholds"] = {
            "Heart Rate": {
                "normal": "60-100 bpm",
                "resting_elevated": "101-119 bpm",
                "resting_critical": ">=120 bpm",
                "moderate_high_motion": "<=130 bpm expected",
            },
            "SpO2": {
                "normal": ">=95%",
                "watch": "92-94%",
                "low": "90-91%",
                "critical": "<90%",
            },
            "Temperature": {
                "normal": "25-35 C",
                "watch": "24-25 or 35-36 C",
                "critical": "<22 or >37 C",
            },
            "clinical_limits": {
                "Heart Rate": f"{CLINICAL['hr'][0]}-{CLINICAL['hr'][1]} bpm",
                "SpO2": f"{CLINICAL['spo2'][0]}-{CLINICAL['spo2'][1]}%",
                "Temperature": f"{CLINICAL['temperature'][0]}-{CLINICAL['temperature'][1]} C",
            },
        }
        return risk
    finally:
        db.close()

# ── Profile & Patient Care Status Management ──────────────────────────────────
@app.get("/api/profile/{patient_id}")
def get_profile(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        c = db.cursor()
        c.execute("""
            SELECT id, name, age, gender, username, role, care_status,
                   surgery_name, surgery_date, discharge_date, primary_diagnosis
            FROM patients WHERE id=%s
        """, (patient_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(status_code=404)
        return {
            "id": row[0], "name": row[1], "age": row[2], "gender": row[3],
            "username": row[4], "role": row[5], "care_status": row[6] or "STANDARD_MONITORING",
            "surgery_name": row[7], "surgery_date": str(row[8]) if row[8] else None,
            "discharge_date": str(row[9]) if row[9] else None, "primary_diagnosis": row[10]
        }
    finally:
        db.close()

@app.put("/api/profile/{patient_id}")
def update_profile(patient_id: int, data: dict, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        c = db.cursor()
        c.execute(
            "UPDATE patients SET name=%s, age=%s, gender=%s WHERE id=%s",
            (data.get("name"), data.get("age"), data.get("gender"), patient_id)
        )
        db.commit()
        return {"status": "updated"}
    finally:
        db.close()

@app.put("/api/patients/{patient_id}/care-status")
def update_care_status(patient_id: int, req: CareStatusUpdate, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can modify patient recovery eligibility and care status")
    if req.care_status not in ('STANDARD_MONITORING', 'POST_TREATMENT_RECOVERY', 'RECOVERY_COMPLETED'):
        raise HTTPException(status_code=400, detail="Invalid care status")
    db = get_db()
    try:
        c = db.cursor()
        c.execute("""
            UPDATE patients SET
                care_status = %s,
                surgery_name = COALESCE(%s, surgery_name),
                primary_diagnosis = COALESCE(%s, primary_diagnosis),
                baseline_hr = COALESCE(%s, baseline_hr),
                baseline_spo2 = COALESCE(%s, baseline_spo2),
                baseline_temp = COALESCE(%s, baseline_temp)
            WHERE id = %s
        """, (req.care_status, req.surgery_name, req.primary_diagnosis,
              req.baseline_hr, req.baseline_spo2, req.baseline_temp, patient_id))
        db.commit()
        return {"status": "success", "patient_id": patient_id, "care_status": req.care_status}
    finally:
        db.close()

# ── 2. Doctor-Assigned Daily Care Checklist (MAJOR-TREATMENT PATIENTS ONLY) ───
@app.get("/api/recovery/{patient_id}/tasks")
def get_care_tasks(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        verify_recovery_eligibility(patient_id, db)
        c = db.cursor()
        c.execute("""
            SELECT id, patient_id, doctor_id, title, category, instructions,
                   scheduled_time, priority, due_date, status, completed_at,
                   completed_by_id, completed_by_name, completed_by_role
            FROM care_tasks
            WHERE patient_id = %s
            ORDER BY
                CASE WHEN status = 'pending' THEN 1 ELSE 2 END,
                due_date ASC, id ASC
        """, (patient_id,))
        rows = c.fetchall()
        keys = ["id", "patient_id", "doctor_id", "title", "category", "instructions",
                "scheduled_time", "priority", "due_date", "status", "completed_at",
                "completed_by_id", "completed_by_name", "completed_by_role"]
        tasks = [dict(zip(keys, [str(v) if hasattr(v, 'isoformat') else v for v in r])) for r in rows]
        return tasks
    finally:
        db.close()

@app.post("/api/recovery/{patient_id}/tasks")
def create_care_task(patient_id: int, req: CareTaskCreate, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can assign care tasks")
    db = get_db()
    try:
        verify_recovery_eligibility(patient_id, db, allow_completed=False)
        c = db.cursor()
        doc_id = int(user.get("sub"))
        c.execute("""
            INSERT INTO care_tasks (patient_id, doctor_id, title, category, instructions,
                                    scheduled_time, priority, assigned_to_user_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (patient_id, doc_id, req.title, req.category, req.instructions,
              req.scheduled_time, req.priority, req.assigned_to_user_id))
        new_id = c.fetchone()[0]
        db.commit()
        return {"status": "created", "task_id": new_id}
    finally:
        db.close()

@app.post("/api/recovery/tasks/{task_id}/complete")
def complete_care_task(task_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        c = db.cursor()
        c.execute("SELECT patient_id, status FROM care_tasks WHERE id=%s", (task_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        patient_id, cur_status = row
        verify_recovery_eligibility(patient_id, db, allow_completed=False)
        check_patient_access(user, patient_id, db)

        if cur_status == 'completed':
            return {"status": "already_completed"}

        c.execute("""
            UPDATE care_tasks SET
                status = 'completed',
                completed_at = NOW(),
                completed_by_id = %s,
                completed_by_name = %s,
                completed_by_role = %s
            WHERE id = %s
        """, (int(user.get("sub")), user.get("name"), user.get("role"), task_id))
        db.commit()
        return {"status": "completed", "task_id": task_id}
    finally:
        db.close()

@app.delete("/api/recovery/tasks/{task_id}")
def delete_care_task(task_id: int, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can delete or discontinue care tasks")
    db = get_db()
    try:
        c = db.cursor()
        c.execute("DELETE FROM care_tasks WHERE id=%s", (task_id,))
        db.commit()
        return {"status": "deleted"}
    finally:
        db.close()

# ── 3. Major Medication Tracking & Prescription Reconciliation ───────────────
@app.get("/api/recovery/{patient_id}/medications")
def get_medications(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        verify_recovery_eligibility(patient_id, db)
        c = db.cursor()
        c.execute("""
            SELECT id, patient_id, prescribed_by_id, name, dosage, frequency,
                   scheduled_timings, start_date, end_date, instructions, status, source
            FROM medications
            WHERE patient_id = %s
            ORDER BY CASE WHEN status = 'active' THEN 1 ELSE 2 END, id ASC
        """, (patient_id,))
        rows = c.fetchall()
        keys = ["id", "patient_id", "prescribed_by_id", "name", "dosage", "frequency",
                "scheduled_timings", "start_date", "end_date", "instructions", "status", "source"]
        meds = [dict(zip(keys, [str(v) if hasattr(v, 'isoformat') else v for v in r])) for r in rows]
        return meds
    finally:
        db.close()

@app.post("/api/recovery/{patient_id}/medications")
def create_medication(patient_id: int, req: MedicationCreate, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can prescribe medications")
    db = get_db()
    try:
        verify_recovery_eligibility(patient_id, db, allow_completed=False)
        c = db.cursor()
        doc_id = int(user.get("sub"))
        c.execute("""
            INSERT INTO medications (patient_id, prescribed_by_id, name, dosage, frequency,
                                    scheduled_timings, instructions, status, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (patient_id, doc_id, req.name, req.dosage, req.frequency,
              req.scheduled_timings, req.instructions, req.status, req.source))
        new_id = c.fetchone()[0]
        db.commit()
        return {"status": "created", "medication_id": new_id}
    finally:
        db.close()

@app.put("/api/recovery/medications/{med_id}/status")
def update_medication_status(med_id: int, data: dict, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can modify medication status")
    db = get_db()
    try:
        new_status = data.get("status", "active")
        c = db.cursor()
        c.execute("UPDATE medications SET status=%s WHERE id=%s", (new_status, med_id))
        db.commit()
        return {"status": "updated", "medication_id": med_id, "new_status": new_status}
    finally:
        db.close()

@app.post("/api/recovery/medications/{med_id}/dose")
def log_medication_dose(med_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        c = db.cursor()
        c.execute("SELECT patient_id, name FROM medications WHERE id=%s", (med_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Medication not found")
        patient_id, med_name = row
        verify_recovery_eligibility(patient_id, db, allow_completed=False)
        check_patient_access(user, patient_id, db)

        c.execute("""
            INSERT INTO medication_doses (medication_id, patient_id, scheduled_time, status, taken_at, confirmed_by_id, confirmed_by_name, confirmed_by_role)
            VALUES (%s, %s, NOW(), 'taken', NOW(), %s, %s, %s) RETURNING id
        """, (med_id, patient_id, int(user.get("sub")), user.get("name"), user.get("role")))
        dose_id = c.fetchone()[0]
        db.commit()
        return {"status": "dose_logged", "medication_name": med_name, "dose_id": dose_id}
    finally:
        db.close()

@app.get("/api/recovery/{patient_id}/reconciliation")
def get_reconciliation_flags(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        verify_recovery_eligibility(patient_id, db)
        return reconcile_prescriptions(patient_id, db)
    finally:
        db.close()

@app.post("/api/recovery/reconciliation/{item_id}/resolve")
def resolve_reconciliation_flag(item_id: int, req: ReconciliationResolve, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can resolve prescription reconciliation discrepancies")
    db = get_db()
    try:
        c = db.cursor()
        doc_id = int(user.get("sub"))
        c.execute("""
            UPDATE prescription_reconciliations SET
                status = 'resolved',
                reviewed_by_id = %s,
                resolution_notes = %s
            WHERE id = %s
        """, (doc_id, req.resolution_notes, item_id))
        db.commit()
        return {"status": "resolved", "item_id": item_id}
    finally:
        db.close()

# ── 4. Patient Surgery & Treatment History ────────────────────────────────────
@app.get("/api/recovery/{patient_id}/history")
def get_surgery_history(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        verify_recovery_eligibility(patient_id, db)
        c = db.cursor()
        c.execute("""
            SELECT id, patient_id, procedure_name, procedure_date, indication,
                   hospital_name, admission_date, discharge_date, discharge_summary,
                   doctor_instructions, medication_changes, followup_appointments,
                   recovery_milestones, outcomes
            FROM surgery_history
            WHERE patient_id = %s
            ORDER BY procedure_date DESC
        """, (patient_id,))
        rows = c.fetchall()
        keys = ["id", "patient_id", "procedure_name", "procedure_date", "indication",
                "hospital_name", "admission_date", "discharge_date", "discharge_summary",
                "doctor_instructions", "medication_changes", "followup_appointments",
                "recovery_milestones", "outcomes"]
        records = [dict(zip(keys, [str(v) if hasattr(v, 'isoformat') else v for v in r])) for r in rows]
        return records
    finally:
        db.close()

@app.post("/api/recovery/{patient_id}/history")
def create_surgery_history(patient_id: int, req: SurgeryHistoryCreate, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can author surgery and major treatment history records")
    db = get_db()
    try:
        verify_recovery_eligibility(patient_id, db)
        c = db.cursor()
        c.execute("""
            INSERT INTO surgery_history (
                patient_id, procedure_name, procedure_date, indication, hospital_name,
                admission_date, discharge_date, discharge_summary, doctor_instructions,
                medication_changes, followup_appointments, recovery_milestones, outcomes
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
            RETURNING id
        """, (
            patient_id, req.procedure_name, req.procedure_date, req.indication, req.hospital_name,
            req.admission_date, req.discharge_date, req.discharge_summary, req.doctor_instructions,
            req.medication_changes, json.dumps(req.followup_appointments or []),
            json.dumps(req.recovery_milestones or []), req.outcomes
        ))
        new_id = c.fetchone()[0]
        db.commit()
        return {"status": "created", "history_id": new_id}
    finally:
        db.close()

@app.put("/api/recovery/history/{history_id}/milestone")
def update_milestone_status(history_id: int, req: MilestoneUpdate, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can update recovery milestones")
    db = get_db()
    try:
        c = db.cursor()
        c.execute("SELECT recovery_milestones FROM surgery_history WHERE id=%s", (history_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="History record not found")
        milestones = row[0] or []
        if 0 <= req.milestone_index < len(milestones):
            milestones[req.milestone_index]["status"] = req.status
            c.execute("UPDATE surgery_history SET recovery_milestones=%s::jsonb WHERE id=%s", (json.dumps(milestones), history_id))
            db.commit()
            return {"status": "updated", "milestones": milestones}
        raise HTTPException(status_code=400, detail="Invalid milestone index")
    finally:
        db.close()

# ── 5. AI Caregiver Copilot for Home Recovery ─────────────────────────────────
@app.post("/api/recovery/{patient_id}/copilot/ask")
def query_copilot(patient_id: int, req: CopilotQuery, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        return answer_caregiver_query(patient_id, req.question, db)
    finally:
        db.close()

# ── 6. Early Recovery Deterioration Detection ─────────────────────────────────
@app.get("/api/recovery/{patient_id}/deterioration")
def get_deterioration_analysis(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        verify_recovery_eligibility(patient_id, db)
        return detect_recovery_deterioration(patient_id, db)
    finally:
        db.close()

@app.post("/api/recovery/{patient_id}/deterioration/review")
def record_deterioration_review(patient_id: int, data: dict, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can log deterioration reviews")
    db = get_db()
    try:
        verify_recovery_eligibility(patient_id, db)
        c = db.cursor()
        doc_id = int(user.get("sub"))
        notes = data.get("notes", "Deterioration alert reviewed by physician. Patient stable.")
        c.execute("""
            INSERT INTO recovery_assessments (patient_id, doctor_id, clinical_notes, overall_status, plan_adjustments)
            VALUES (%s, %s, %s, %s, %s)
        """, (patient_id, doc_id, f"[Early Deterioration Review] {notes}", "reviewed", data.get("action_taken", "Monitoring continued.")))
        db.commit()
        return {"status": "review_recorded"}
    finally:
        db.close()

# ── 7. Recovery Progress Verification ─────────────────────────────────────────
@app.get("/api/recovery/{patient_id}/progress")
def get_recovery_progress_metrics(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        verify_recovery_eligibility(patient_id, db)
        return calculate_recovery_progress(patient_id, db)
    finally:
        db.close()

@app.post("/api/recovery/{patient_id}/progress/assessment")
def add_recovery_assessment(patient_id: int, req: AssessmentCreate, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can log clinical recovery assessments")
    db = get_db()
    try:
        verify_recovery_eligibility(patient_id, db)
        c = db.cursor()
        doc_id = int(user.get("sub"))
        c.execute("""
            INSERT INTO recovery_assessments (patient_id, doctor_id, clinical_notes, overall_status, plan_adjustments)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        """, (patient_id, doc_id, req.clinical_notes, req.overall_status, req.plan_adjustments))
        new_id = c.fetchone()[0]
        db.commit()
        return {"status": "created", "assessment_id": new_id}
    finally:
        db.close()

# ── 8. Shared Family Care Coordination ────────────────────────────────────────
@app.get("/api/recovery/{patient_id}/caregivers")
def get_linked_caregivers(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        verify_recovery_eligibility(patient_id, db)
        c = db.cursor()
        c.execute("""
            SELECT c.id, c.patient_id, c.caregiver_user_id, c.relationship, c.phone,
                   c.can_complete_tasks, c.can_view_vitals, p.name as caregiver_name, p.username as caregiver_username
            FROM caregivers c
            JOIN patients p ON c.caregiver_user_id = p.id
            WHERE c.patient_id = %s
        """, (patient_id,))
        rows = c.fetchall()
        keys = ["id", "patient_id", "caregiver_user_id", "relationship", "phone",
                "can_complete_tasks", "can_view_vitals", "caregiver_name", "caregiver_username"]
        return [dict(zip(keys, r)) for r in rows]
    finally:
        db.close()

@app.post("/api/recovery/{patient_id}/caregivers")
def link_caregiver(patient_id: int, req: CaregiverLink, user=Depends(get_current_user)):
    if user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors or authorized staff can link caregivers")
    db = get_db()
    try:
        verify_recovery_eligibility(patient_id, db)
        c = db.cursor()
        c.execute("SELECT id FROM patients WHERE username=%s", (req.caregiver_username,))
        row = c.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Caregiver username not found. Please register caregiver account first.")
        cg_uid = row[0]
        c.execute("""
            INSERT INTO caregivers (patient_id, caregiver_user_id, relationship, phone, can_complete_tasks, can_view_vitals)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (patient_id, cg_uid, req.relationship, req.phone, req.can_complete_tasks, req.can_view_vitals))
        new_id = c.fetchone()[0]
        db.commit()
        return {"status": "linked", "caregiver_id": new_id}
    finally:
        db.close()

@app.get("/api/caregiver/patient")
def get_caregiver_linked_patient(user=Depends(get_current_user)):
    if user.get("role") != "caregiver":
        raise HTTPException(status_code=403, detail="Caregiver access only")
    db = get_db()
    try:
        c = db.cursor()
        c.execute("""
            SELECT p.id, p.name, p.age, p.gender, p.care_status, p.surgery_name, p.primary_diagnosis, c.relationship
            FROM caregivers c
            JOIN patients p ON c.patient_id = p.id
            WHERE c.caregiver_user_id = %s
            LIMIT 1
        """, (int(user.get("sub")),))
        row = c.fetchone()
        if not row:
            return {"linked": False, "patient": None}
        return {
            "linked": True,
            "patient": {
                "id": row[0], "name": row[1], "age": row[2], "gender": row[3],
                "care_status": row[4], "surgery_name": row[5], "primary_diagnosis": row[6],
                "relationship": row[7]
            }
        }
    finally:
        db.close()

# ── Vitals Export (CSV) ───────────────────────────────────────────────────────
@app.get("/api/vitals/{patient_id}/export")
def export_vitals(patient_id: int, user=Depends(get_current_user)):
    from fastapi.responses import StreamingResponse
    import io, csv
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        c = db.cursor()
        c.execute(
            "SELECT timestamp,hr,spo2,temperature,ax,ay,az,motion_score,motion_status,finger_detected FROM vitals WHERE patient_id=%s ORDER BY timestamp ASC",
            (patient_id,)
        )
        rows = c.fetchall()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["timestamp","hr","spo2","temperature","ax","ay","az","motion_score","motion_status","finger_detected"])
        writer.writerows(rows)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=vitals_{patient_id}.csv"}
        )
    finally:
        db.close()

# ── Doctors & Patient Directory ───────────────────────────────────────────────
@app.get("/api/doctors")
def get_doctors(user=Depends(get_current_user)):
    db = get_db()
    try:
        c = db.cursor()
        c.execute("SELECT id,name,age,gender,username FROM patients WHERE role='doctor'")
        rows = c.fetchall()
        return [{"id":r[0],"name":r[1],"age":r[2],"gender":r[3],"username":r[4]} for r in rows]
    finally:
        db.close()

@app.get("/api/patients")
def get_patients(user=Depends(get_current_user)):
    if user["role"] != "doctor":
        raise HTTPException(status_code=403)
    db = get_db()
    try:
        c = db.cursor()
        c.execute("""
            SELECT id, name, age, gender, care_status, surgery_name, primary_diagnosis
            FROM patients
            WHERE role='patient'
            ORDER BY id ASC
        """)
        rows = c.fetchall()
        return [{
            "id": r[0], "name": r[1], "age": r[2], "gender": r[3],
            "care_status": r[4] or "STANDARD_MONITORING",
            "surgery_name": r[5], "primary_diagnosis": r[6]
        } for r in rows]
    finally:
        db.close()

@app.get("/api/patients/{patient_id}/latest")
def get_latest_vitals(patient_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        check_patient_access(user, patient_id, db)
        c = db.cursor()
        c.execute(
            "SELECT id,patient_id,timestamp,hr,spo2,temperature,ax,ay,az,motion_score,motion_status,finger_detected FROM vitals WHERE patient_id=%s ORDER BY timestamp DESC LIMIT 1",
            (patient_id,)
        )
        row = c.fetchone()
        if not row:
            return {}
        keys = ["id","patient_id","timestamp","hr","spo2","temperature","ax","ay","az","motion_score","motion_status","finger_detected"]
        return dict(zip(keys, [str(v) if hasattr(v,'isoformat') else v for v in row]))
    finally:
        db.close()

# ── Chat Messaging ────────────────────────────────────────────────────────────
@app.get("/api/messages/unread/{user_id}")
def get_unread_count(user_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        c = db.cursor()
        c.execute("SELECT COUNT(*) FROM messages WHERE receiver_id=%s AND is_read=FALSE", (user_id,))
        count_row = c.fetchone()
        count = count_row[0] if count_row else 0
        return {"unread": count}
    finally:
        db.close()

@app.get("/api/messages/{user_id}/{other_id}")
def get_messages(user_id: int, other_id: int, user=Depends(get_current_user)):
    db = get_db()
    try:
        c = db.cursor()
        c.execute("""
            SELECT m.id, m.sender_id, m.receiver_id, m.message, m.timestamp, m.is_read, p.name as sender_name
            FROM messages m JOIN patients p ON m.sender_id = p.id
            WHERE (m.sender_id=%s AND m.receiver_id=%s) OR (m.sender_id=%s AND m.receiver_id=%s)
            ORDER BY m.timestamp ASC
        """, (user_id, other_id, other_id, user_id))
        rows = c.fetchall()
        c.execute("UPDATE messages SET is_read=TRUE WHERE receiver_id=%s AND sender_id=%s", (user_id, other_id))
        db.commit()
        return [{"id":r[0],"sender_id":r[1],"receiver_id":r[2],"message":r[3],
                 "timestamp":str(r[4]),"is_read":r[5],"sender_name":r[6]} for r in rows]
    finally:
        db.close()

@app.post("/api/messages")
async def send_message(req: MessageRequest, user=Depends(get_current_user)):
    db = get_db()
    try:
        c = db.cursor()
        c.execute(
            "INSERT INTO messages (sender_id,receiver_id,message) VALUES (%s,%s,%s) RETURNING id,timestamp",
            (req.sender_id, req.receiver_id, req.message)
        )
        row = c.fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Message insert failed")
        db.commit()

        c.execute("SELECT name FROM patients WHERE id=%s", (req.sender_id,))
        name_row = c.fetchone()
        sender_name = name_row[0] if name_row else "Unknown"

        msg_data = {
            "event": "chat",
            "id": row[0],
            "sender_id": req.sender_id,
            "receiver_id": req.receiver_id,
            "message": req.message,
            "timestamp": str(row[1]),
            "sender_name": sender_name
        }
        await manager.send_chat(req.receiver_id, msg_data)
        await manager.send_chat(req.sender_id, msg_data)

        # If a patient messages the doctor (id=1) and the doctor is currently away from chat,
        # provide an intelligent clinical auto-response grounded in patient telemetry & discharge plan
        if req.receiver_id == 1 and not manager.chat_clients.get(1):
            try:
                triage = answer_caregiver_query(req.sender_id, req.message, db)
                answer_text = triage.get("answer", "")
                if answer_text:
                    c.execute(
                        "INSERT INTO messages (sender_id, receiver_id, message) VALUES (%s, %s, %s) RETURNING id, timestamp",
                        (1, req.sender_id, answer_text)
                    )
                    auto_row = c.fetchone()
                    db.commit()
                    auto_data = {
                        "event": "chat",
                        "id": auto_row[0],
                        "sender_id": 1,
                        "receiver_id": req.sender_id,
                        "message": answer_text,
                        "timestamp": str(auto_row[1]),
                        "sender_name": "Dr. Sharma"
                    }
                    await manager.send_chat(req.sender_id, auto_data)
            except Exception as ex:
                print("Clinical auto-responder note:", ex)

        return msg_data
    finally:
        db.close()

# ── WebSockets ────────────────────────────────────────────────────────────────
@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await manager.connect_alerts(websocket)
    try:
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        manager.disconnect_alerts(websocket)

@app.websocket("/ws/chat/{user_id}")
async def ws_chat(websocket: WebSocket, user_id: int):
    await manager.connect_chat(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        manager.disconnect_chat(user_id, websocket)
