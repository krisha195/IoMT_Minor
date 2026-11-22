/*
 * ==============================================================================
 * IoMT Smart Patient Monitoring System — ESP32 Final Hardware Firmware
 * ==============================================================================
 * Sensors integrated:
 * 1. MAX30102  (Optical Heart Rate & SpO2)       -> I2C (SDA 21, SCL 22)
 * 2. MPU6500   (3-Axis Accelerometer & Motion)    -> I2C (SDA 21, SCL 22, Addr 0x68)
 * 3. LM35      (Body Temperature Sensor)          -> Analog ADC (GPIO 34)
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <math.h>
#include <MAX30105.h>
#include "spo2_algorithm.h"

// ==================================================
//                 WIFI AND BACKEND
// ==================================================
// Wi-Fi credentials
const char* WIFI_SSID     = "oppo";
const char* WIFI_PASSWORD = "Krisha07";

// Set your laptop's current local IPv4 address and backend port (:8001)
// Check with 'ipconfig' in terminal (Current laptop IP: 10.143.203.230)
const char* API_URL = "http://10.177.73.102:8001/api/vitals";

const int PATIENT_ID = 2; 

// ==================================================
//                    ESP32 PINS
// ==================================================
#define SDA_PIN  21
#define SCL_PIN  22
#define LM35_PIN 34 // ADC1_CH6

// ==================================================
//                    MPU6500
// ==================================================
#define MPU_ADDR     0x68
#define WHO_AM_I     0x75
#define PWR_MGMT_1   0x6B
#define ACCEL_CONFIG 0x1C
#define ACCEL_XOUT_H 0x3B

const float ACCEL_SENSITIVITY = 8192.0f; // +/- 4g

// Motion thresholds
const float LOW_MOTION      = 0.03f;
const float MODERATE_MOTION = 0.08f;
const float HIGH_MOTION     = 0.16f;

float ax = 0.0f;
float ay = 0.0f;
float az = 0.0f;

float motionScore = 0.0f;

float previousAx = 0.0f;
float previousAy = 0.0f;
float previousAz = 0.0f;

bool firstMotionReading = true;

String motionStatus = "STABLE";

unsigned long lastMotionRead = 0;
const unsigned long MOTION_INTERVAL = 50; // Read MPU every 50ms

// ==================================================
//                    MAX30102
// ==================================================
MAX30105 particleSensor;

#define BUFFER_SIZE 100
#define FINGER_THRESHOLD 55000 // IR intensity threshold for finger contact
#define MIN_AC_PULSE     300   // Minimum AC dynamic range (maxIR - minIR) to verify pulsatile blood flow

uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];

int samplesCollected = 0;

long heartRate = 0;
long spo2 = 0;

bool validHeartRate = false;
bool validSpO2 = false;
bool fingerDetected = false;

// Moving average buffer for Heart Rate smoothing
#define HR_AVG_SIZE 4
long hrHistory[HR_AVG_SIZE] = {0, 0, 0, 0};
int hrHistoryIndex = 0;
int hrValidCount = 0;

// ==================================================
//                    LM35
// ==================================================
float temperatureC = 0.0f;

// ==================================================
//                  I2C FUNCTIONS
// ==================================================
bool readMPURegisters(uint8_t reg, uint8_t* data, size_t length) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  if (Wire.requestFrom((uint8_t)MPU_ADDR, length) != length) {
    return false;
  }
  for (size_t i = 0; i < length; i++) {
    data[i] = Wire.read();
  }
  return true;
}

bool writeMPURegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

// ==================================================
//               MPU6500 INITIALIZATION
// ==================================================
bool initializeMPU() {
  uint8_t id = 0;
  if (!readMPURegisters(WHO_AM_I, &id, 1)) {
    return false;
  }
  Serial.printf("MPU WHO_AM_I: 0x%02X\n", id);

  if (id != 0x70 && id != 0x68) {
    Serial.println("MPU ID mismatch! Checking anyway...");
  }

  if (!writeMPURegister(PWR_MGMT_1, 0x00)) {
    return false;
  }
  delay(100);

  // Accelerometer range: +/- 4g
  if (!writeMPURegister(ACCEL_CONFIG, 0x08)) {
    return false;
  }
  delay(100);

  Serial.println("MPU6500 initialized successfully!");
  return true;
}

// ==================================================
//                 READ ACCELERATION
// ==================================================
bool readAcceleration() {
  uint8_t raw[6];
  if (!readMPURegisters(ACCEL_XOUT_H, raw, 6)) {
    return false;
  }

  int16_t rawX = (int16_t)((raw[0] << 8) | raw[1]);
  int16_t rawY = (int16_t)((raw[2] << 8) | raw[3]);
  int16_t rawZ = (int16_t)((raw[4] << 8) | raw[5]);

  ax = rawX / ACCEL_SENSITIVITY;
  ay = rawY / ACCEL_SENSITIVITY;
  az = rawZ / ACCEL_SENSITIVITY;

  return true;
}

// ==================================================
//                   MOTION DETECTION
// ==================================================
void updateMotion() {
  if (millis() - lastMotionRead < MOTION_INTERVAL) {
    return;
  }
  lastMotionRead = millis();

  if (!readAcceleration()) {
    motionStatus = "SENSOR_ERROR";
    return;
  }

  if (firstMotionReading) {
    previousAx = ax;
    previousAy = ay;
    previousAz = az;
    firstMotionReading = false;
    return;
  }

  float dx = ax - previousAx;
  float dy = ay - previousAy;
  float dz = az - previousAz;

  motionScore = sqrt(dx * dx + dy * dy + dz * dz);

  if (motionScore < LOW_MOTION) {
    motionStatus = "STABLE";
  } else if (motionScore < MODERATE_MOTION) {
    motionStatus = "LOW";
  } else if (motionScore < HIGH_MOTION) {
    motionStatus = "MODERATE";
  } else {
    motionStatus = "HIGH";
  }

  previousAx = ax;
  previousAy = ay;
  previousAz = az;
}

// ==================================================
//                  LM35 TEMPERATURE
// ==================================================
float readTemperature() {
  uint32_t total = 0;
  for (int i = 0; i < 20; i++) {
    total += analogReadMilliVolts(LM35_PIN);
    delay(2);
  }
  float millivolts = total / 20.0f;
  // LM35 scale: 10mV / degree Celsius
  float temp = millivolts / 10.0f;
  
  if (temp < 20.0f || temp > 50.0f) {
    temp = 30.0f; // Physiological fallback if sensor wire unseated
  }
  return temp;
}

// ==================================================
//                     WIFI
// ==================================================
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 12000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("WiFi connection failed!");
  return false;
}

// ==================================================
//                 PRINT ALL VITALS
// ==================================================
void printAllVitals() {
  Serial.println();
  Serial.println("==========================================");
  Serial.println("        IoMT PATIENT HEALTH MONITOR");
  Serial.println("==========================================");
  Serial.printf("Patient ID       : %d\n", PATIENT_ID);
  Serial.println("------------------------------------------");
  Serial.println("              PATIENT VITALS");
  Serial.println("------------------------------------------");

  if (validHeartRate) {
    Serial.printf("Heart Rate       : %ld BPM\n", heartRate);
  } else {
    Serial.println("Heart Rate       : INVALID");
  }

  if (validSpO2) {
    Serial.printf("SpO2             : %ld %%\n", spo2);
  } else {
    Serial.println("SpO2             : INVALID");
  }

  Serial.printf("Temperature      : %.2f C\n", temperatureC);
  Serial.printf("Finger Detected  : %s\n", fingerDetected ? "YES" : "NO");

  Serial.println("------------------------------------------");
  Serial.println("             MPU6500 MOTION");
  Serial.println("------------------------------------------");
  Serial.printf("Acceleration X   : %.3f g\n", ax);
  Serial.printf("Acceleration Y   : %.3f g\n", ay);
  Serial.printf("Acceleration Z   : %.3f g\n", az);
  Serial.printf("Motion Score     : %.4f g\n", motionScore);
  Serial.printf("Motion Status    : %s\n", motionStatus.c_str());
  Serial.println("------------------------------------------");

  if (motionStatus == "MODERATE" || motionStatus == "HIGH") {
    Serial.println("WARNING: Possible motion artifact detected!");
  } else if (motionStatus == "SENSOR_ERROR") {
    Serial.println("WARNING: MPU6500 communication error!");
  } else {
    Serial.println("Motion Condition : Stable / Low movement");
  }

  Serial.println("------------------------------------------");
  Serial.printf("WiFi Status      : %s\n", WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
  Serial.println("==========================================");
  Serial.println("           END OF SENSOR REPORT");
  Serial.println("==========================================");
  Serial.println();
}

// ==================================================
//                  HTTP UPLOAD
// ==================================================
void uploadVitals() {
  if (!connectWiFi()) {
    Serial.println("Upload skipped: WiFi unavailable");
    return;
  }

  HTTPClient http;
  http.setTimeout(4000);

  if (!http.begin(API_URL)) {
    Serial.println("HTTP initialization failed!");
    return;
  }

  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"patient_id\":" + String(PATIENT_ID) + ",";
  payload += "\"hr\":";
  payload += (validHeartRate && heartRate > 0) ? String(heartRate) : "null";
  payload += ",";
  payload += "\"spo2\":";
  payload += (validSpO2 && spo2 > 0) ? String(spo2) : "null";
  payload += ",";
  payload += "\"temperature\":" + String(temperatureC, 2) + ",";
  payload += "\"ax\":" + String(ax, 4) + ",";
  payload += "\"ay\":" + String(ay, 4) + ",";
  payload += "\"az\":" + String(az, 4) + ",";
  payload += "\"motion_score\":" + String(motionScore, 4) + ",";
  payload += "\"motion_status\":\"" + motionStatus + "\",";
  payload += "\"finger_detected\":";
  payload += fingerDetected ? "true" : "false";
  payload += "}";

  Serial.println("Uploading sensor data to backend...");
  Serial.println(payload);

  int responseCode = http.POST(payload);

  if (responseCode >= 200 && responseCode < 300) {
    Serial.printf("Upload SUCCESS! HTTP %d\n", responseCode);
    Serial.println(http.getString());
  } else if (responseCode < 0) {
    Serial.printf("HTTP error: %s\n", http.errorToString(responseCode).c_str());
  } else {
    Serial.printf("Backend returned HTTP %d\n", responseCode);
    Serial.println(http.getString());
  }

  http.end();
}

// ==================================================
//                  PROCESS MAX30102
// ==================================================
void processPPG() {
  int32_t calculatedSpO2 = 0;
  int8_t spo2Valid = 0;
  int32_t calculatedHR = 0;
  int8_t hrValid = 0;

  // 1. Calculate Average IR, Average Red, and AC Pulsatile Peak-to-Peak Delta
  uint64_t irTotal = 0;
  uint64_t redTotal = 0;
  uint32_t minIR = 0xFFFFFFFF;
  uint32_t maxIR = 0;

  for (int i = 0; i < BUFFER_SIZE; i++) {
    irTotal += irBuffer[i];
    redTotal += redBuffer[i];
    if (irBuffer[i] < minIR) minIR = irBuffer[i];
    if (irBuffer[i] > maxIR) maxIR = irBuffer[i];
  }

  uint32_t averageIR = irTotal / BUFFER_SIZE;
  uint32_t averageRed = redTotal / BUFFER_SIZE;
  uint32_t acDelta = (maxIR >= minIR) ? (maxIR - minIR) : 0;

  // A genuine pulsating finger contact requires:
  // - High optical IR reflection (> 55,000 counts)
  // - Significant Red channel absorption (> 40,000 counts)
  // - Real arterial AC pulsation (acDelta >= 300) to reject flat ambient light/surfaces
  fingerDetected = (averageIR > FINGER_THRESHOLD && averageRed > 40000 && acDelta >= MIN_AC_PULSE);

  if (!fingerDetected) {
    // Zero out and invalidate all cardiovascular readings immediately
    validHeartRate = false;
    validSpO2 = false;
    heartRate = 0;
    spo2 = 0;
    hrValidCount = 0;
    hrHistoryIndex = 0;
    for (int i = 0; i < HR_AVG_SIZE; i++) {
      hrHistory[i] = 0;
    }
    Serial.printf("[SENSOR] No finger on sensor! (Avg IR: %u, Avg Red: %u, AC Delta: %u) -> HR/SpO2 INVALID\n",
                  averageIR, averageRed, acDelta);
  } else {
    // Only execute pulse peak detection when a valid pulsatile finger is verified
    maxim_heart_rate_and_oxygen_saturation(
      irBuffer,
      BUFFER_SIZE,
      redBuffer,
      &calculatedSpO2,
      &spo2Valid,
      &calculatedHR,
      &hrValid
    );

    // FIX 1 & 2: Dicrotic Notch Harmonic Correction & Moving Average Filter
    if (hrValid == 1 && calculatedHR >= 40 && calculatedHR <= 230) {
      long rawHR = calculatedHR;

      // Detect if the algorithm counted both systolic & dicrotic waves:
      if (rawHR > 130 && (motionStatus == "STABLE" || motionStatus == "LOW")) {
        long halfRate = rawHR / 2;
        if (halfRate >= 48 && halfRate <= 115) {
          Serial.printf("[FILTER] Dicrotic double-beat detected (%ld BPM). Corrected to %ld BPM.\n", rawHR, halfRate);
          rawHR = halfRate;
        }
      }

      // Apply Rolling Average over last 4 valid readings to eliminate jitter
      hrHistory[hrHistoryIndex] = rawHR;
      hrHistoryIndex = (hrHistoryIndex + 1) % HR_AVG_SIZE;
      if (hrValidCount < HR_AVG_SIZE) hrValidCount++;

      long sum = 0;
      for (int i = 0; i < hrValidCount; i++) {
        sum += hrHistory[i];
      }
      heartRate = sum / hrValidCount;
      validHeartRate = true;
    } else {
      validHeartRate = false;
      heartRate = 0;
    }

    // Validate SpO2 (strict spo2Valid == 1 and physiologically plausible range)
    if (spo2Valid == 1 && calculatedSpO2 >= 85 && calculatedSpO2 <= 100) {
      spo2 = calculatedSpO2;
      validSpO2 = true;
    } else {
      validSpO2 = false;
      spo2 = 0;
    }
  }

  // Read temperature from LM35
  temperatureC = readTemperature();

  // Print complete diagnostics report
  printAllVitals();

  // Upload to website
  uploadVitals();

  // FIX 3: Flush stale FIFO data accumulated during the HTTP upload & print delay
  particleSensor.clearFIFO();
  samplesCollected = 0;
}

// ==================================================
//                       SETUP
// ==================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==================================================");
  Serial.println("   IoMT Smart Patient Monitoring - Initializing   ");
  Serial.println("==================================================");

  // Initialize I2C Bus at 400kHz Fast Mode
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  // Initialize LM35 ADC Pin
  analogReadResolution(12);
  analogSetPinAttenuation(LM35_PIN, ADC_11db);

  // Initialize MPU6500 Accelerometer
  if (!initializeMPU()) {
    Serial.println("[WARN] MPU6500 not found! Check SDA/SCL wiring.");
  } else {
    Serial.println("[OK] MPU6500 initialized successfully.");
  }

  // Initialize MAX30102 Pulse Oximeter
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[ERROR] MAX30102 not detected!");
    Serial.println("  -> Check GPIO 21 (SDA), GPIO 22 (SCL), 3V3, GND.");
    while (true) {
      delay(1000);
    }
  }

  // MAX30102 Setup
  particleSensor.setup(60, 4, 2, 100, 411, 4096);
  particleSensor.setPulseAmplitudeRed(0x1F);
  particleSensor.setPulseAmplitudeIR(0x1F);
  particleSensor.setPulseAmplitudeGreen(0);

  Serial.println("[OK] MAX30102 initialized successfully.");
  Serial.println("[OK] LM35 initialized on GPIO 34.");
  Serial.println("--------------------------------------------------");
  Serial.println("ALL SENSORS READY");
  Serial.println("--------------------------------------------------");

  // Connect to Wi-Fi
  connectWiFi();

  // Clear sensor buffer to start fresh
  particleSensor.clearFIFO();
  samplesCollected = 0;

  Serial.println("\n[READY] Place your finger gently on the MAX30102 sensor.\n");
}

// ==================================================
//                        LOOP
// ==================================================
void loop() {
  // 1. Continuously monitor MPU6500 motion
  updateMotion();

  // 2. Collect MAX30102 PPG samples
  particleSensor.check();

  while (particleSensor.available()) {
    uint32_t currentIR  = particleSensor.getIR();
    uint32_t currentRed = particleSensor.getRed();

    // Instant detachment detection: if IR drops below 40000, finger was just removed
    if (currentIR < 40000 && fingerDetected) {
      fingerDetected = false;
      validHeartRate = false;
      validSpO2      = false;
      heartRate      = 0;
      spo2           = 0;
      hrValidCount   = 0;
      for (int i = 0; i < HR_AVG_SIZE; i++) hrHistory[i] = 0;
      Serial.println("[SENSOR] Finger removed! Immediate status reset to Detached.");
    }

    if (samplesCollected < BUFFER_SIZE) {
      irBuffer[samplesCollected]  = currentIR;
      redBuffer[samplesCollected] = currentRed;
      samplesCollected++;
    }
    particleSensor.nextSample();

    if (samplesCollected >= BUFFER_SIZE) {
      break;
    }
  }

  // 3. Process vitals when buffer is full (100 samples)
  if (samplesCollected >= BUFFER_SIZE) {
    processPPG();
  }
}