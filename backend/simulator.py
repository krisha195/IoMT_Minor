"""
ESP32 Simulator — posts vitals to the same /api/vitals endpoint the real ESP32 will use.
To switch to real hardware: just flash the ESP32 with the HTTP POST sketch, stop this script.
"""
import time, random, math, requests, os, sys

BASE = os.path.dirname(__file__)
sys.path.append(BASE)

API_URL = "http://localhost:8001/api/vitals"

def get_patient_list():
    try:
        from database import get_db
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT id, baseline_hr, baseline_spo2, baseline_temp FROM patients WHERE role = 'patient' ORDER BY id;")
        rows = c.fetchall()
        conn.close()
        if rows:
            return [
                {
                    "patient_id": r[0],
                    "base_hr": float(r[1] or 74.0),
                    "base_spo2": float(r[2] or 98.0),
                    "base_temp": float(r[3] if r[3] and r[3] > 34.0 else 36.8)
                }
                for r in rows
            ]
    except Exception:
        pass
    return [
        {"patient_id": 2, "base_hr": 74.0, "base_spo2": 98.2, "base_temp": 36.8},
        {"patient_id": 3, "base_hr": 78.0, "base_spo2": 98.5, "base_temp": 36.7},
    ]

PATIENTS = get_patient_list()

def simulate_vitals(p: dict, t: int) -> dict:
    # Realistic motion profiles matching MPU6500 calibration
    motion_cycle = (t + p["patient_id"] * 25) % 90
    if motion_cycle < 65:
        # Stable resting
        motion_score = random.uniform(0.005, 0.025)
        motion_status = "STABLE"
        ax = random.gauss(0.01, 0.01)
        ay = random.gauss(0.02, 0.01)
        az = 0.99 + random.gauss(0, 0.01)
    elif motion_cycle < 78:
        # Low movement (arm adjustment)
        motion_score = random.uniform(0.035, 0.075)
        motion_status = "LOW"
        ax = random.gauss(0.05, 0.02)
        ay = random.gauss(0.06, 0.02)
        az = 0.96 + random.gauss(0, 0.02)
    elif motion_cycle < 86:
        # Moderate motion (walking / moving)
        motion_score = random.uniform(0.085, 0.14)
        motion_status = "MODERATE"
        ax = random.gauss(0.12, 0.04)
        ay = random.gauss(0.14, 0.04)
        az = 0.91 + random.gauss(0, 0.04)
    else:
        # Brief high motion spike
        motion_score = random.uniform(0.165, 0.22)
        motion_status = "HIGH"
        ax = random.gauss(0.25, 0.06)
        ay = random.gauss(0.28, 0.06)
        az = 0.82 + random.gauss(0, 0.06)

    noise = 1.5 if motion_status in ("MODERATE", "HIGH") else 0.3
    hr = p["base_hr"] + 1.5 * math.sin(t / 40) + random.gauss(0, noise)
    spo2 = p["base_spo2"] + 0.2 * math.sin(t / 80) + random.gauss(0, 0.15 if motion_status in ("MODERATE", "HIGH") else 0.05)
    hr = round(hr, 1)
    spo2 = round(min(100.0, max(94.0, spo2)), 1)
    finger_detected = True

    temp = p["base_temp"] + 0.05 * math.sin(t / 120) + random.gauss(0, 0.01)

    return {
        "patient_id":      p["patient_id"],
        "hr":              hr,
        "spo2":            spo2,
        "temperature":     round(temp, 2),
        "ax":              round(ax, 3),
        "ay":              round(ay, 3),
        "az":              round(az, 3),
        "motion_score":    round(motion_score, 4),
        "motion_status":   motion_status,
        "finger_detected": finger_detected
    }

if __name__ == "__main__":
    print(f"Simulator running -- streaming for {len(PATIENTS)} patients to {API_URL}")
    for p in PATIENTS:
        print(f"  • Patient {p['patient_id']}: base_hr={p['base_hr']}, base_spo2={p['base_spo2']}, base_temp={p['base_temp']}°C")
    t = 0
    while True:
        for p in PATIENTS:
            payload = simulate_vitals(p, t)
            try:
                r = requests.post(API_URL, json=payload, timeout=5)
                status_txt = f"HR={payload['hr']} SpO2={payload['spo2']}% Temp={payload['temperature']}°C Motion={payload['motion_status']}"
                print(f"P{payload['patient_id']} {status_txt} -> {r.status_code}")
            except Exception as e:
                print(f"Error posting P{payload['patient_id']}: {e}")
        t += 1
        time.sleep(1)
