# ESP32 Hardware Integration Guide (MAX30102 + LM35)

This guide explains how to connect your ESP32 with **MAX30102** and **LM35** sensors and stream live telemetry into this IoMT software system in real time.

---

## 1. Pin Wiring Diagram

### Sensor 1: MAX30102 (Heart Rate & SpO₂)
| MAX30102 Pin | Connect to ESP32 Pin | Note |
| :--- | :--- | :--- |
| **SDA** | **GPIO 21** | I2C Data line |
| **SCL** | **GPIO 22** | I2C Clock line |
| **GND** | **GND** | Ground |
| **VIN / VCC** | **3V3** | 3.3V Power |

---

### Sensor 2: LM35 (Body / Ambient Temperature)
Looking at the flat face of the LM35 (with "LM35" text facing you):
```
    +--------+
    |  LM35  |
    +--------+
     |   |   |
     1   2   3
    VCC Data GND
```
| LM35 Pin | Description | Connect to ESP32 Pin |
| :--- | :--- | :--- |
| **Pin 1 (Left)** | **VCC** | **3V3** (or **VIN 5V** from USB) |
| **Pin 2 (Middle)**| **Data / Vout** | **GPIO 34** (ADC1 Channel 6) |
| **Pin 3 (Right)** | **GND** | **GND** |

---

## 2. Arduino IDE Setup

1. Open **Arduino IDE**.
2. Go to **Tools > Board > esp32 > DOIT ESP32 DEVKIT V1** (or your ESP32 board model).
3. Open **Sketch > Include Library > Manage Libraries...**
4. Search for:
   * **SparkFun MAX3010x Pulse and Proximity Sensor Library** by SparkFun
   * Click **Install**.
   *(No extra libraries required for LM35 or HTTP POST — they use built-in ESP32 core libraries `WiFi.h`, `HTTPClient.h`, `Wire.h`).*

---

## 3. Configure the Sketch (`esp32_vitals.ino`)

Open [`hardware/esp32_vitals/esp32_vitals.ino`](file:///c:/Users/patel%20krisha/Desktop/Minor/Minor_Project_New/hardware/esp32_vitals/esp32_vitals.ino) and update lines 29–37:

```cpp
// 1. Enter your Wi-Fi details (ESP32 and laptop must be on the same Wi-Fi network)
const char* WIFI_SSID     = "TP-Link_FA50";     // or your Mobile Hotspot
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// 2. Set the API URL with your computer's local IPv4 address (Port 8001 is required!)
const char* API_URL = "http://192.168.0.103:8001/api/vitals";

// 3. Set target Patient ID (2 = Rahul Mehta, 3 = Priya Singh)
const int PATIENT_ID = 2;
```

> **Note on your Computer's Local IP**:
> If your laptop is on Wi-Fi, open PowerShell and type `ipconfig`. Find your **IPv4 Address** (e.g. `192.168.1.x` or `10.143.203.94`) and update `API_URL`.

---

## 4. Run the Software & Hardware in Complete Sync

1. **Stop the Python Simulator** (so real hardware takes over):
   If you have the software simulator running in the background, you can stop it so all readings come purely from your physical ESP32.
2. **Backend Server is Listening**:
   The backend is configured to accept requests from any device on your local Wi-Fi:
   ```powershell
   py -3.11 -m uvicorn main:app --host 0.0.0.0 --port 8001
   ```
3. **Upload Sketch to ESP32**:
   - Plug your ESP32 into your computer via USB.
   - Select your COM port in **Tools > Port**.
   - Click **Upload** (arrow icon).
4. **Open Serial Monitor**:
   - Open **Tools > Serial Monitor** set to **115200 baud**.
   - You will see:
     ```text
     [Wi-Fi] Connected successfully!
     [OK] MAX30102 Pulse Oximeter initialized.
     [OK] LM35 Temperature sensor configured on GPIO 34.
     [READY] Place your finger on the MAX30102 sensor to begin.
     ```
5. **View Live in Browser**:
   Open [`http://localhost:5173/patient`](http://localhost:5173/patient) (or login as `patient1` / `patient123`).
   Place your finger gently on the MAX30102 sensor. You will immediately see:
   - Live Heart Rate and SpO₂ graphing on the dashboard.
   - Live temperature from LM35 updating in real time.
   - AI suggestions and risk assessment reflecting your real-world body readings.
