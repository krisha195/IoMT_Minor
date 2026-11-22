from collections import deque
import numpy as np

# Clinical thresholds (Layer 1)
CLINICAL = {
    "hr":          (40, 150),
    "spo2":        (90, 100),
    "temperature": (25.0, 35.0),
}

# Per-patient rolling baseline for adaptive layer (Layer 2)
# {patient_id: {vital: deque}}
_baselines: dict[int, dict[str, deque]] = {}
BASELINE_WINDOW = 60   # last 60 readings (~1 min at 1Hz)

def _get_baseline(patient_id: int, vital: str) -> deque:
    if patient_id not in _baselines:
        _baselines[patient_id] = {k: deque(maxlen=BASELINE_WINDOW) for k in CLINICAL}
    return _baselines[patient_id][vital]

def get_motion_aware_hr_score(hr: float, motion_status: str = "STABLE") -> int:
    """Return an explainable risk score for heart rate using motion context."""
    motion_status = str(motion_status or "STABLE").upper()
    if motion_status in ("MODERATE", "HIGH"):
        if hr <= 130:
            return 0
        if hr <= 150:
            return 35
        return 100

    if 60 <= hr <= 100:
        return 0
    if 100 < hr <= 120:
        return 25
    if 120 < hr <= 150:
        return 60
    if 40 <= hr < 60:
        return 25
    return 100

def calculate_motion_aware_risk(
    hr, spo2, temperature, motion_status="STABLE",
    fall_detected=False, vitals_anomaly=False, recent_alert_types=None
) -> dict:
    """Fuse vitals and motion context into an explainable 0-100 risk score."""
    recent_alert_types = recent_alert_types or []
    motion_status = str(motion_status or "STABLE").upper()
    contributions = []
    weighted_sum = 0.0
    weights_sum = 0.0

    if hr is not None:
        hr_score = get_motion_aware_hr_score(float(hr), motion_status)
        weighted_sum += hr_score * 0.35
        weights_sum += 0.35
        contributions.append({
            "vital": "Heart Rate",
            "value": float(hr),
            "unit": "bpm",
            "score": hr_score,
            "raw_weight": 0.35,
        })

    if spo2 is not None:
        spo2 = float(spo2)
        if spo2 >= 95:
            spo2_score = 0
        elif spo2 >= 92:
            spo2_score = 30
        elif spo2 >= 90:
            spo2_score = 65
        else:
            spo2_score = 100
        weighted_sum += spo2_score * 0.45
        weights_sum += 0.45
        contributions.append({
            "vital": "SpO₂",
            "value": spo2,
            "unit": "%",
            "score": spo2_score,
            "raw_weight": 0.45,
        })

    if temperature is not None:
        temperature = float(temperature)
        if 25.0 <= temperature <= 35.0:
            temperature_score = 0
        elif 24.0 <= temperature < 25.0 or 35.0 < temperature <= 36.0:
            temperature_score = 25
        elif 22.0 <= temperature < 24.0 or 36.0 < temperature <= 37.0:
            temperature_score = 55
        else:
            temperature_score = 100
        weighted_sum += temperature_score * 0.20
        weights_sum += 0.20
        contributions.append({
            "vital": "Temperature",
            "value": temperature,
            "unit": "°C",
            "score": temperature_score,
            "raw_weight": 0.20,
        })

    score = round(weighted_sum / weights_sum) if weights_sum else 0

    if motion_status in ("MODERATE", "HIGH"):
        score = max(score - 10, 0)
        contributions.append({
            "vital": "Motion Context",
            "value": motion_status,
            "unit": "",
            "score": 10,
            "raw_weight": 0.10,
        })
    elif hr is not None and float(hr) > 100:
        resting_hr = float(hr)
        if resting_hr >= 120:
            score = min(score + 35, 100)
        else:
            score = min(score + 15, 100)

    if fall_detected:
        score = max(score, 95)
    if spo2 is not None and float(spo2) < 90:
        score = max(score, 95)
    if vitals_anomaly:
        score = min(max(score + (20 if motion_status == "STABLE" else 10), 0), 100)

    score = min(score, 100)
    if score <= 20:
        level = "normal"
    elif score <= 45:
        level = "mild"
    elif score <= 70:
        level = "moderate"
    else:
        level = "critical"

    for item in contributions:
        item["weight"] = round(
            item["raw_weight"] / (weights_sum + (0.10 if motion_status in ("MODERATE", "HIGH") else 0.0)) * 100
        )
        item.pop("raw_weight", None)

    top = [item for item in contributions if item["score"] > 0]
    top.sort(key=lambda item: item["score"], reverse=True)
    if top:
        explanation = "Risk influenced by: " + ", ".join(
            f"{item['vital']} ({item['value']}{item['unit']})" for item in top[:2]
        ) + "."
    else:
        explanation = "All active vitals are within the motion-aware normal range."

    if motion_status in ("MODERATE", "HIGH"):
        explanation += " Elevated HR is interpreted in the context of measured movement."
    elif hr is not None and float(hr) > 100:
        explanation += " Elevated HR occurred while motion was stable."

    return {
        "score": score,
        "level": level,
        "contributions": sorted(contributions, key=lambda item: item["score"], reverse=True),
        "explanation": explanation,
        "motion_status": motion_status,
        "vitals": {
            "hr": hr,
            "spo2": spo2,
            "temperature": temperature,
        },
    }

def check_alerts(patient_id: int, hr, spo2, temperature,
                 vitals_anomaly: bool, fall_detected: bool, fall_conf: float,
                 motion_status: str = "STABLE", finger_detected: bool = True) -> list[dict]:
    alerts = []
    readings = {"hr": hr, "spo2": spo2, "temperature": temperature}

    # If finger is not detected on optical sensor, notify without generating false vital alarms
    if finger_detected is False:
        alerts.append({
            "alert_type": "finger_detached",
            "severity":   "medium",
            "message":    "MAX30102 sensor: Finger detached or signal lost. Re-position finger on sensor."
        })

    for vital, value in readings.items():
        if value is None:
            continue

        # If finger is off, skip PPG-derived clinical threshold checks
        if vital in ("hr", "spo2") and finger_detected is False:
            continue

        lo, hi = CLINICAL[vital]
        buf = _get_baseline(patient_id, vital)
        buf.append(value)

        # Layer 1 — clinical threshold breach
        if value < lo or value > hi:
            direction = "low" if value < lo else "high"
            severity = "critical" if vital == "spo2" and value < 90 else "high"
            if vital == "hr" and direction == "high" and motion_status in ("MODERATE", "HIGH"):
                severity = "medium" if value <= 150 else "critical"
            alerts.append({
                "alert_type": f"clinical_{vital}",
                "severity":   severity,
                "message":    f"{vital.upper()} {direction}: {value} (normal {lo}–{hi})"
            })
            continue

        if vital == "hr" and motion_status in ("MODERATE", "HIGH") and value > 100:
            if value <= 130:
                continue
            if value <= 150:
                alerts.append({
                    "alert_type": "motion_elevated_hr",
                    "severity": "medium",
                    "message": f"Heart rate is elevated during {motion_status.lower()} movement: {value} bpm.",
                })
                continue

        if vital == "hr" and motion_status == "STABLE" and value > 100:
            alerts.append({
                "alert_type": "resting_elevated_hr",
                "severity": "high" if value >= 120 else "medium",
                "message": f"Heart rate is elevated while the patient is stable: {value} bpm.",
            })
            continue

        # Layer 2 — adaptive personal baseline (only if enough history and clinically meaningful drift)
        elif len(buf) >= 20:
            mean, std = float(np.mean(buf)), float(np.std(buf))
            min_std = 4.0 if vital == "hr" else 1.2 if vital == "spo2" else 0.5
            eff_std = max(std, min_std)
            if abs(value - mean) > 2.5 * eff_std:
                alerts.append({
                    "alert_type": f"adaptive_{vital}",
                    "severity":   "medium",
                    "message":    f"{vital.upper()} deviating from personal baseline: {value:.1f} (baseline {mean:.1f}±{std:.1f})"
                })

    # Motion artifact advisory — warns doctor/patient without suppressing raw telemetry
    if motion_status in ("MODERATE", "HIGH") and (finger_detected is not False):
        alerts.append({
            "alert_type": "motion_artifact",
            "severity":   "medium",
            "message":    f"Patient movement detected ({motion_status} motion). PPG vitals may contain motion artifacts."
        })

    # ML anomaly alert (only when valid vitals present)
    if vitals_anomaly and hr is not None and spo2 is not None:
        alerts.append({
            "alert_type": "ml_vitals_anomaly",
            "severity":   "high",
            "message":    "ML model detected abnormal vitals pattern"
        })

    # Fall alert
    if fall_detected:
        alerts.append({
            "alert_type": "fall_detected",
            "severity":   "critical",
            "message":    f"Fall detected! Confidence: {fall_conf*100:.1f}%"
        })

    # Cross-modal rule-based escalation: raise priority when both model
    # outputs agree on a simultaneous fall and abnormal-vitals pattern.
    if fall_detected and vitals_anomaly:
        alerts.append({
            "alert_type": "cross_modal_critical",
            "severity": "critical",
            "message": (
                "CRITICAL: Fall detected with a simultaneous vitals anomaly "
                f"(fall confidence: {fall_conf*100:.1f}%)."
            ),
        })

    return alerts
