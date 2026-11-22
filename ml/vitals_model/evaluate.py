import os
import numpy as np
import joblib
import tensorflow as tf
from sklearn.metrics import r2_score, accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

if hasattr(tf.keras.layers, 'MultiHeadAttention'):
    _orig_mha = tf.keras.layers.MultiHeadAttention.from_config
    @classmethod
    def _patched_mha(cls, config):
        config.pop('use_gate', None)
        return _orig_mha(config)
    tf.keras.layers.MultiHeadAttention.from_config = _patched_mha

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL_PATH = os.path.join(BASE_DIR, "ml", "saved_models", "vitals_transformer.keras")
THRESHOLD_PATH = os.path.join(BASE_DIR, "ml", "saved_models", "vitals_threshold.npy")
SCALER_PATH = os.path.join(BASE_DIR, "ml", "vitals_model", "scaler.pkl")
DATA_PATH = os.path.join(BASE_DIR, "ml", "vitals_model", "sequences.npy")
PATIENT_PATH = os.path.join(BASE_DIR, "ml", "vitals_model", "sequence_patient_ids.npy")

def evaluate_vitals_model():
    print("=" * 70)
    print("  VITALS TRANSFORMER ENCODER: COMPREHENSIVE PERFORMANCE EVALUATION")
    print("=" * 70)

    # 1. Load Model, Threshold, Scaler, and Data
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    threshold = float(np.load(THRESHOLD_PATH))
    scaler = joblib.load(SCALER_PATH)
    sequences = np.load(DATA_PATH)
    patient_ids = np.load(PATIENT_PATH)

    print(f"Dataset Size: {len(sequences):,} sequences of 30-sec windows (3 channels)")
    print(f"Calculated Anomaly Threshold: {threshold:.6f}")

    # 2. Patient-level 80/20 validation split
    unique_patients = np.unique(patient_ids)
    rng = np.random.default_rng(42)
    rng.shuffle(unique_patients)
    split_index = int(len(unique_patients) * 0.8)
    val_patients = set(unique_patients[split_index:])
    X_val = sequences[np.array([patient_id in val_patients for patient_id in patient_ids])]
    print(f"Validation Set Size: {len(X_val):,} samples")

    # 3. Model Predictions / Reconstruction
    print("\nRunning reconstruction inference on validation set...")
    X_pred = model.predict(X_val, batch_size=128, verbose=0)

    # Normalized Errors
    mse_norm = np.mean(np.square(X_val - X_pred))
    mae_norm = np.mean(np.abs(X_val - X_pred))
    rmse_norm = np.sqrt(mse_norm)

    # 4. Inverse Transform to Physical Units
    val_flat = X_val.reshape(-1, 3)
    pred_flat = X_pred.reshape(-1, 3)

    val_phys = scaler.inverse_transform(val_flat)
    pred_phys = scaler.inverse_transform(pred_flat)

    mae_hr = np.mean(np.abs(val_phys[:, 0] - pred_phys[:, 0]))
    mae_spo2 = np.mean(np.abs(val_phys[:, 1] - pred_phys[:, 1]))
    mae_temp = np.mean(np.abs(val_phys[:, 2] - pred_phys[:, 2]))
    r2_hr = r2_score(val_phys[:, 0], pred_phys[:, 0])
    r2_spo2 = r2_score(val_phys[:, 1], pred_phys[:, 1])
    r2_temp = r2_score(val_phys[:, 2], pred_phys[:, 2])

    # Reconstruction accuracy within clinical tolerance bands
    # HR within +/- 3 BPM, SpO2 within +/- 1.5%
    hr_acc = np.mean(np.abs(val_phys[:, 0] - pred_phys[:, 0]) <= 3.0) * 100
    spo2_acc = np.mean(np.abs(val_phys[:, 1] - pred_phys[:, 1]) <= 1.5) * 100
    temp_acc = np.mean(np.abs(val_phys[:, 2] - pred_phys[:, 2]) <= 0.15) * 100
    overall_recon_acc = (hr_acc + spo2_acc + temp_acc) / 3.0

    print("\n" + "-" * 70)
    print("  FACTOR 1: SIGNAL RECONSTRUCTION FIDELITY (NORMAL PATIENT DYNAMICS)")
    print("-" * 70)
    print(f"  Overall Mean Squared Error (MSE)   : {mse_norm:.6f} ({mse_norm*100:.4f}%)")
    print(f"  Overall Root Mean Sq Error (RMSE)  : {rmse_norm:.4f} ({rmse_norm*100:.2f}% of span)")
    print(f"  Overall Mean Absolute Error (MAE)  : {mae_norm:.4f} ({mae_norm*100:.2f}%)")
    print()
    print(f"  Physical Mean Absolute Error (MAE) :")
    print(f"    - Heart Rate (HR)                : +/- {mae_hr:.2f} BPM")
    print(f"    - Blood Oxygen (SpO2)            : +/- {mae_spo2:.2f} %")
    print(f"    - Temperature (synthetic)        : +/- {mae_temp:.3f} C")
    print()
    print(f"  Clinical Tolerance Reconstruction Accuracy:")
    print(f"    - HR within +/- 3 BPM             : {hr_acc:.2f}%")
    print(f"    - SpO2 within +/- 1.5%           : {spo2_acc:.2f}%")
    print(f"    - Temperature within +/- 0.15 C  : {temp_acc:.2f}%")
    print(f"    - Average Clinical Fidelity      : {overall_recon_acc:.2f}%")
    print()
    print(f"  Explained Variance (R² Score)      :")
    print(f"    - Heart Rate R²                  : {r2_hr:.4f}")
    print(f"    - SpO2 R²                        : {r2_spo2:.4f}")
    print(f"    - Temperature R²                 : {r2_temp:.4f}")

    # 5. Anomaly Detection Classification Performance
    # Validation window reconstruction errors
    val_sample_errors = np.mean(np.square(X_val - X_pred), axis=(1, 2))
    # Normal samples classified as normal (specificity)
    normal_preds = val_sample_errors > threshold # True = predicted anomaly
    specificity = np.mean(~normal_preds) * 100 # Correctly identified as normal

    # Create synthetic clinical deterioration benchmark cases (Hypoxia, Tachycardia, Sepsis, Bradycardia)
    num_anom = len(X_val)
    np.random.seed(42)
    anom_cases = []

    for i in range(num_anom):
        scenario = i % 4
        # Start from a baseline normal window
        base_norm = scaler.inverse_transform(X_val[i].copy())
        if scenario == 0:
            # Hypoxic Desaturation: SpO2 drops to 80-88%, HR compensatory spike to 105-125
            base_norm[:, 1] = np.linspace(base_norm[0, 1], np.random.uniform(78, 87), 30)
            base_norm[:, 0] += np.linspace(0, np.random.uniform(20, 40), 30)
        elif scenario == 1:
            # Tachycardic Event: HR escalates to 130-165 BPM
            base_norm[:, 0] = np.linspace(base_norm[0, 0], np.random.uniform(130, 165), 30)
        elif scenario == 2:
            # Severe sepsis-like drift: HR rises while SpO2 declines
            base_norm[:, 0] += np.linspace(5, 35, 30)
            base_norm[:, 1] -= np.linspace(1, 10, 30)
        elif scenario == 3:
            # Bradycardic Crash: HR drops below 40 BPM
            base_norm[:, 0] = np.linspace(base_norm[0, 0], np.random.uniform(30, 42), 30)

        # Scale back
        anom_scaled = scaler.transform(base_norm)
        anom_cases.append(anom_scaled)

    X_anom = np.array(anom_cases, dtype=np.float32)
    X_anom_pred = model.predict(X_anom, batch_size=128, verbose=0)
    anom_errors = np.mean(np.square(X_anom - X_anom_pred), axis=(1, 2))

    y_true = np.concatenate([np.zeros(len(val_sample_errors)), np.ones(len(anom_errors))])
    y_scores = np.concatenate([val_sample_errors, anom_errors])
    y_pred = (y_scores > threshold).astype(int)

    acc = accuracy_score(y_true, y_pred) * 100
    sens = recall_score(y_true, y_pred) * 100
    prec = precision_score(y_true, y_pred) * 100
    f1 = f1_score(y_true, y_pred) * 100
    auc = roc_auc_score(y_true, y_scores) * 100
    cm = confusion_matrix(y_true, y_pred)

    print("\n" + "-" * 70)
    print("  FACTOR 2: ANOMALY DETECTION & CLINICAL DETERIORATION PERFORMANCE")
    print("-" * 70)
    print(f"  Anomaly Detection Accuracy         : {acc:.2f}%")
    print(f"  Area Under ROC Curve (ROC-AUC)     : {auc:.2f}%")
    print(f"  Sensitivity (Recall on Anomalies)  : {sens:.2f}%  (Detects {cm[1, 1]:,}/{len(anom_errors):,} crises)")
    print(f"  Specificity (ADL / Normal Hold)    : {specificity:.2f}%  (Suppresses {cm[0, 0]:,}/{len(val_sample_errors):,} false alarms)")
    print(f"  Precision (Positive Predictive Val): {prec:.2f}%")
    print(f"  F1-Score                           : {f1:.2f}%")
    print(f"  False Alarm Rate                   : {100 - specificity:.2f}%")
    print()
    print("  Confusion Matrix:")
    print(f"    True Normal  [TN]: {cm[0, 0]:<6} | False Alarm [FP]: {cm[0, 1]}")
    print(f"    Missed Anom  [FN]: {cm[1, 0]:<6} | True Alert  [TP]: {cm[1, 1]}")
    print("=" * 70)

if __name__ == "__main__":
    evaluate_vitals_model()
