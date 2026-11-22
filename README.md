# PulseNet IoMT Health and Recovery Monitor

This project contains a FastAPI backend, a React/Vite frontend, ESP32
integration, and two machine-learning inference pipelines:

- Fall detection from SisFall inertial data.
- Vital-sign anomaly detection from real BIDMC HR and SpO2 data.

## Canonical project layout

```text
backend/                         FastAPI API, database, inference, simulator
frontend/                        React/Vite web application
hardware/                        ESP32 sketch, serial bridge, wiring guide
ml/
  fall_model/                    Fall preprocessing, training, evaluation
  vitals_model/                  Vitals preprocessing, training, evaluation
  saved_models/                  Models used by backend/ml_inference.py
  test_models.py                 Inference smoke test
```

The raw SisFall and BIDMC datasets and generated training arrays are not
included in this repository. Obtain the datasets from their respective
authorized sources and place them in the paths expected by the preprocessing
scripts before retraining. The trained runtime models and threshold remain in
`ml/saved_models/`.

## Sensor and alert flow

The ESP32/MAX30102/temperature/MPU sensor setup sends real:

- Heart rate
- SpO2
- Temperature
- Acceleration
- Gyroscope or motion-derived status

The vitals Transformer model analyzes HR, SpO2, and temperature sequences.
The BIDMC dataset has no real temperature channel, so the temperature training
feature is generated reproducibly and is synthetic—not a measured clinical
temperature. The fall
TCN model analyzes 200-sample, 9-channel motion windows. Rule-based alerts
also monitor fixed clinical limits, motion context, resting abnormalities,
finger removal, and low SpO2.

The two models work independently and do not share an end-to-end combined
training target. Their outputs are combined in the alert decision layer:

- A fall prediction generates a fall alert.
- An abnormal vitals prediction generates a vitals-anomaly alert.
- When both predictions are true, the backend adds a
  `cross_modal_critical` alert.
- Motion status changes the interpretation of elevated heart rate.
- The explainable risk score combines motion, HR, SpO2, temperature, fall,
  and recent anomaly information.

This is separate-model ML with rule-based cross-modal fusion, not a
standalone combined neural fusion model.

The dashboard provides:

- Live HR, SpO2, temperature, and motion
- Motion-aware health risk score
- Rolling personal baselines
- Clinical threshold ranges
- Fall, vitals-anomaly, temperature, and motion alerts
- Patient, caregiver, medication, surgery, and recovery features

The vitals anomaly benchmark uses synthetic deterioration cases. It is not
clinically labeled validation and must not be presented as a medical diagnosis
system.

## Setup

Create `backend/.env` from `backend/.env.example`, then configure PostgreSQL
and the secrets on that machine. Install and start the application:

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001

cd ../frontend
npm install
npm run dev
```

For hardware use, update the ESP32 Wi-Fi credentials and backend IP using
`hardware/esp32_vitals/README.md`, then flash
`hardware/esp32_vitals/esp32_vitals.ino`.

## Render deployment

Deploy the backend as a Web Service from the repository root:

- Build command: `pip install -r backend/requirements.txt`
- Start command: `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment: set `SECRET_KEY`, `DATABASE_URL` (the PostgreSQL internal URL),
  and `CORS_ORIGINS` (the deployed frontend origin).

Deploy `frontend/` as a Static Site with `npm install && npm run build`,
publish `dist`, and set `VITE_API_BASE_URL` to the backend's HTTPS URL. Add a
rewrite from `/*` to `/index.html` for the client-side routes. Render's free
PostgreSQL databases expire after 30 days; use a durable database plan for
ongoing production data.

Local demo accounts are available only when `SEED_DEMO_DATA=true`:

- Doctor: `doctor` / `doctor123`
- Patient: `patient1` / `patient123`

Keep raw datasets out of source-control when possible. The generated arrays
and scalers under `ml/fall_model/` and `ml/vitals_model/` are local training
artifacts; the `.keras` files and threshold under `ml/saved_models/` are the
runtime artifacts.

## Validation performed

The training run used these shapes (the generated arrays are not included):

| Pipeline | Dataset/artifact | Shape |
|---|---|---|
| Fall | Training windows | `(14948, 200, 9)` |
| Fall | Held-out windows | `(946, 200, 9)` |
| Fall | Runtime model input | `(None, 200, 9)` |
| Vitals | Sequences | `(23824, 30, 3)` |
| Vitals | Validation sequences | Patient-level held-out |
| Vitals | Runtime model input/output | `(None, 30, 3)` |

`python ml/test_models.py` successfully loads both runtime models and
produces the expected normal/anomalous and normal/fall smoke-test results.

### Verified metrics

- Fall, held-out unseen subjects:
  - Accuracy: `93.45%`
  - ROC-AUC: `97.80%`
  - Sensitivity: `87.40%`
  - Specificity: `97.38%`
  - False-alarm rate: `2.62%`
- Vitals, patient-level validation:
  - HR reconstruction fidelity: `99.15%`
  - SpO2 reconstruction fidelity: `99.98%`
  - Synthetic-temperature reconstruction fidelity: `100.00%`
  - Average clinical tolerance fidelity: `99.71%`
  - Synthetic anomaly sensitivity: `100.00%`
  - Normal specificity: `95.94%`

The vitals sensitivity and specificity are benchmarked against synthetic
deterioration cases, not clinically labeled anomaly events.

## Important limitations

1. The fall model now uses the exact production format: 200 timesteps and
   nine channels. The retraining pipeline creates this format directly.
2. The fall evaluation has a held-out-subject dataset, which is preferable
   to a random window split. Do not report the random split in the legacy
   `train.py` as the final generalization score.
3. The vitals anomaly model is trained on HR, SpO2, and a reproducibly
   generated synthetic temperature feature. It does not validate real clinical
   temperature anomalies. Real LM35/skin-temperature measurements remain used
   by the rule-based alerts and dashboard.
4. Demo users are intended for local development only. Configure secrets
   through environment variables, use the hashed-password flow, restrict
   CORS, and remove demo seed data before deployment.
5. The ESP32 ingestion endpoint is currently unauthenticated and should use
   device credentials or a secure hardware token before Internet deployment.

## Model smoke test

```powershell
python ml/test_models.py
```
