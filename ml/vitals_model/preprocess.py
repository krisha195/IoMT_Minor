import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import joblib

# Dynamic paths relative to project root
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BIDMC_PATH = os.path.join(BASE_DIR, "bidmc-ppg-and-respiration-dataset-1.0.0", "bidmc-ppg-and-respiration-dataset-1.0.0", "bidmc_csv")
SAVE_PATH  = os.path.join(BASE_DIR, "ml", "vitals_model")
WINDOW_SIZE = 30  # 30-second rolling window

def load_all_patients():
    all_data = []
    print(f"Scanning BIDMC records from: {BIDMC_PATH}")
    for i in range(1, 54):
        filename = f"bidmc_{i:02d}_Numerics.csv"
        filepath = os.path.join(BIDMC_PATH, filename)
        if not os.path.exists(filepath):
            continue
        try:
            df = pd.read_csv(filepath)
            df.columns = df.columns.str.strip()
            
            # Extract clinical HR and SpO2
            subset = df[['HR', 'SpO2']].copy()

            # BIDMC does not provide a temperature waveform. Restore the
            # original project contract with a reproducible modeled temperature
            # feature; this is synthetic and must not be described as measured.
            np.random.seed(42 + i)
            n_samples = len(subset)
            base_temp = 36.8 + np.random.normal(0, 0.15)
            drift = np.cumsum(np.random.normal(0, 0.005, size=n_samples))
            drift = drift - np.mean(drift)
            temp = base_temp + 0.004 * (subset['HR'] - 75) + drift
            subset['temperature'] = np.clip(temp, 35.8, 38.2).round(2)
            
            subset['patient_id'] = i
            
            all_data.append(subset)
        except Exception as e:
            print(f"Skipping {filename}: {e}")
            
    if not all_data:
        raise FileNotFoundError(f"No BIDMC files found at {BIDMC_PATH}")
        
    return pd.concat(all_data, ignore_index=True)

def clean(df):
    df = df.dropna()
    # Filter physiologically plausible human limits
    df = df[(df['HR'] >= 30) & (df['HR'] <= 220)]
    df = df[(df['SpO2'] >= 60) & (df['SpO2'] <= 100)]
    df = df[(df['temperature'] >= 34.0) & (df['temperature'] <= 42.0)]
    return df.reset_index(drop=True)

def create_sequences(data, patient_ids, window_size):
    sequences = []
    sequence_patient_ids = []
    for patient_id in np.unique(patient_ids):
        patient_data = data[patient_ids == patient_id]
        for i in range(len(patient_data) - window_size + 1):
            sequences.append(patient_data[i:i + window_size])
            sequence_patient_ids.append(patient_id)
    return (
        np.array(sequences, dtype=np.float32),
        np.array(sequence_patient_ids, dtype=np.int32),
    )

def preprocess():
    print("==================================================")
    print("   BIDMC Preprocessing: 3 Features [HR, SpO2, Synthetic Temp]")
    print("==================================================")
    df = load_all_patients()
    print(f"Total rows loaded: {len(df)}")

    df = clean(df)
    print(f"Rows after cleaning: {len(df)}")

    features = df[['HR', 'SpO2', 'temperature']].values
    patient_ids = df['patient_id'].values

    print("Fitting MinMaxScaler on 3 features...")
    scaler = MinMaxScaler(feature_range=(0.0, 1.0))
    features_scaled = scaler.fit_transform(features)

    print(f"Slicing 30-second sliding sequences (Window={WINDOW_SIZE})...")
    sequences, sequence_patient_ids = create_sequences(
        features_scaled, patient_ids, WINDOW_SIZE
    )
    print(f"Generated sequence tensor shape: {sequences.shape} (N, 30, 3)")

    os.makedirs(SAVE_PATH, exist_ok=True)
    np.save(os.path.join(SAVE_PATH, "sequences.npy"), sequences)
    np.save(os.path.join(SAVE_PATH, "sequence_patient_ids.npy"), sequence_patient_ids)
    joblib.dump(scaler, os.path.join(SAVE_PATH, "scaler.pkl"))
    print(f"[OK] Saved sequences.npy ({sequences.shape}) and scaler.pkl to {SAVE_PATH}")
    return sequences, scaler

if __name__ == "__main__":
    preprocess()
