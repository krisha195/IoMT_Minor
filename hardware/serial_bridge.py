import serial
import json
import requests
import time
import sys

COM_PORT = "COM3"
BAUD_RATE = 115200
API_URL = "http://localhost:8001/api/vitals"

def run_bridge():
    print("=" * 65)
    print("  PULSENET HARDWARE SERIAL BRIDGE (COM3 -> DASHBOARD)")
    print(f"  Port: {COM_PORT} @ {BAUD_RATE} baud")
    print(f"  Target: {API_URL}")
    print("=" * 65)

    ser = None
    while True:
        try:
            if ser is None or not ser.is_open:
                try:
                    ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=1)
                    print(f"\n[OK] Connected to {COM_PORT} successfully!")
                    print("Listening for sensor packets from ESP32...\n")
                except Exception as e:
                    print(f"[WAITING] Waiting for {COM_PORT} to become available... ({e})")
                    time.sleep(2)
                    continue

            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if not line:
                continue

            # Check if line is a sensor JSON payload
            if line.startswith("{") and line.endswith("}"):
                try:
                    payload = json.loads(line)
                    res = requests.post(API_URL, json=payload, timeout=2)
                    if res.status_code == 200:
                        data = res.json()
                        hr = payload.get('hr')
                        spo2 = payload.get('spo2')
                        temp = payload.get('temperature')
                        finger = payload.get('finger_detected')
                        fall = data.get('fall_result', {}).get('fall_detected', False)
                        anomaly = data.get('vitals_result', {}).get('anomaly', False)
                        print(f"[LIVE PACKET] Finger: {finger} | HR: {hr} BPM | SpO2: {spo2}% | Temp: {temp}C | Anomaly: {anomaly} | Fall: {fall}")
                    else:
                        print(f"[WARN] Backend returned HTTP {res.status_code}")
                except json.JSONDecodeError:
                    pass
                except requests.RequestException:
                    print("[WARN] Backend not responding yet, retrying...")
                    time.sleep(1)
            else:
                # Print status messages from ESP32
                if any(k in line for k in ["WiFi", "SENSOR", "MPU", "REPORT", "Starting", "READY"]):
                    print(f"[ESP32 LOG] {line}")
        except (serial.SerialException, serial.SerialTimeoutException) as se:
            print(f"[PORT CLOSED] {COM_PORT} disconnected or busy: {se}. Reconnecting...")
            if ser:
                try:
                    ser.close()
                except Exception:
                    pass
            ser = None
            time.sleep(2)
        except KeyboardInterrupt:
            print("\nStopping bridge...")
            break
        except Exception as ex:
            print(f"[ERROR] {ex}")
            time.sleep(1)

    if ser and ser.is_open:
        ser.close()

if __name__ == "__main__":
    run_bridge()
