import sys
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(os.path.join(BASE_DIR, "backend"))

from ml_inference import infer_vitals, infer_fall

def main():
    print("=" * 65)
    print("      IoMT HEALTH & RECOVERY MONITOR - DUAL MODEL TEST")
    print("=" * 65)

    # 1. Test Vitals Anomaly Model
    print("\n--- 1. Testing Vitals Anomaly Detection Model ---")
    # Case A: Normal Vitals (HR=74, SpO2=98.5%, Temp=36.7)
    res_normal = infer_vitals(patient_id=101, hr=74, spo2=98.5, temperature=36.7)
    print("Normal Vitals Test (HR: 74 BPM, SpO2: 98.5%, Temp: 36.7°C):")
    print(f"  -> Anomaly Detected: {res_normal['anomaly']}")
    print(f"  -> Reconstruction Error: {res_normal['score']} (Threshold: {res_normal['threshold']})")

    # Case B: Severe Deterioration / Anomaly (HR=130, SpO2=82%, Temp=39.5)
    res_anom = infer_vitals(patient_id=102, hr=130, spo2=82.0, temperature=39.5)
    print("\nDeteriorating Vitals Test (HR: 130 BPM, SpO2: 82%, Temp: 39.5°C):")
    print(f"  -> Anomaly Detected: {res_anom['anomaly']}")
    print(f"  -> Reconstruction Error: {res_anom['score']} (Threshold: {res_anom['threshold']})")

    # 2. Test Fall Detection Model
    print("\n--- 2. Testing Wearable Fall Detection Model ---")
    # Case A: Normal Walking / Standing (ax=0.05g, ay=0.08g, az=0.98g)
    res_walk = infer_fall(patient_id=201, ax=0.05, ay=0.08, az=0.98)
    print("Normal Movement Test (ax: 0.05g, ay: 0.08g, az: 0.98g):")
    print(f"  -> Fall Detected: {res_walk['fall_detected']}")
    print(f"  -> Model Confidence: {res_walk['confidence']}")

    # Case B: High Impact Sudden Fall (ax=2.85g, ay=1.92g, az=0.45g)
    res_fall = infer_fall(patient_id=202, ax=2.85, ay=1.92, az=0.45, gx=280.0, gy=150.0, gz=-95.0)
    print("\nFall Impact Collision Test (ax: 2.85g, ay: 1.92g, az: 0.45g):")
    print(f"  -> Fall Detected: {res_fall['fall_detected']}")
    print(f"  -> Model Confidence: {res_fall['confidence']}")

    print("\n" + "=" * 65)
    print(" [OK] Both models loaded and executed successfully!")
    print("=" * 65)

if __name__ == "__main__":
    main()
