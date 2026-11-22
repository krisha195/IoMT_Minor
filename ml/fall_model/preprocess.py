import os
import glob
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import joblib

# Dynamic paths relative to project root
BASE_DIR     = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SISFALL_PATH = os.path.join(BASE_DIR, "SisFall", "SisFall_dataset", "SisFall_dataset")
SAVE_PATH    = os.path.join(BASE_DIR, "ml", "fall_model")

WINDOW_SIZE       = 100   # 100 samples (0.5 second at 200 Hz, aligns with backend buffer)
PRE_IMPACT_OFFSET = 35    # 35 samples (~175ms) pre-impact weightlessness, 65 samples impact & post-fall

# Physical unit scaling factors for SisFall sensors
ADXL345_CONVERSION = (2.0 * 16.0) / 8192.0     # Convert raw bits to g (±16g range, 13-bit)
ITG3200_CONVERSION = 2000.0 / 32768.0          # Convert raw bits to °/s (±2000°/s range, 16-bit)

def load_file_6cols(filepath):
    """
    Parses SisFall comma-separated text files, extracts ADXL345 (Accel) and ITG3200 (Gyro),
    and converts raw integer counts to physical units (g and °/s).
    """
    try:
        df = pd.read_csv(filepath, header=None, sep=',', comment=';', engine='c')
        data = df.iloc[:, 0:6].dropna().values.astype(np.float32)
        if len(data) < WINDOW_SIZE:
            return None
        # Convert Accel columns [0:3] to g
        data[:, 0:3] *= ADXL345_CONVERSION
        # Convert Gyro columns [3:6] to °/s
        data[:, 3:6] *= ITG3200_CONVERSION
        return data
    except Exception:
        return None

def preprocess():
    print("=" * 70)
    print("  SisFall Event-Centric Preprocessing (Noise-Free Peak Impact Extraction)")
    print("  All 38 Subjects: SA01-SA23 (Young Adults) & SE01-SE15 (Elderly)")
    print("=" * 70)

    if not os.path.exists(SISFALL_PATH):
        raise FileNotFoundError(f"SisFall dataset folder not found at {SISFALL_PATH}")

    os.makedirs(SAVE_PATH, exist_ok=True)

    fall_files = sorted(glob.glob(os.path.join(SISFALL_PATH, "*", "*F*.txt")))
    adl_files  = sorted(glob.glob(os.path.join(SISFALL_PATH, "*", "*D*.txt")))

    print(f"Discovered: {len(fall_files):,} Fall trial files | {len(adl_files):,} ADL trial files")

    X_list = []
    y_list = []

    # ──────────────────────────────────────────────────────────────────────────
    # 1. PROCESS FALL FILES (True Impact Shock Events)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n[1/3] Extracting impact-centered windows from Fall files...")
    for idx, f in enumerate(fall_files):
        data = load_file_6cols(f)
        if data is None:
            continue

        # Signal Vector Magnitude of linear acceleration
        acc_mag = np.sqrt(np.sum(data[:, 0:3] ** 2, axis=1))
        peak_idx = int(np.argmax(acc_mag))

        # Augmentation with slight temporal jitter offsets around the impact moment
        # Guarantees the network learns invariant phase transitions (freefall -> impact -> rest)
        for jitter in [-14, -7, 0, 7, 14]:
            center = peak_idx + jitter
            start = center - PRE_IMPACT_OFFSET
            end = start + WINDOW_SIZE
            if start >= 0 and end <= len(data):
                X_list.append(data[start:end])
                y_list.append(1)

        if (idx + 1) % 500 == 0 or (idx + 1) == len(fall_files):
            print(f"      Processed {idx + 1:,}/{len(fall_files):,} Fall files (Accumulated: {len(y_list):,} fall windows)...")

    n_falls = len(y_list)
    print(f"      [OK] Extracted {n_falls:,} high-purity, noise-free Fall samples (Label = 1).")

    # ──────────────────────────────────────────────────────────────────────────
    # 2. PROCESS ADL FILES (Hard Negatives & Daily Activity Baseline)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n[2/3] Extracting hard negatives (stumbling/jumping) & normal ADL patterns...")
    for idx, f in enumerate(adl_files):
        data = load_file_6cols(f)
        if data is None:
            continue

        acc_mag = np.sqrt(np.sum(data[:, 0:3] ** 2, axis=1))
        peak_idx = int(np.argmax(acc_mag))

        # A. Hard Negative Window: Centered around highest kinetic activity peak in the ADL
        start_peak = max(0, peak_idx - PRE_IMPACT_OFFSET)
        end_peak = start_peak + WINDOW_SIZE
        if end_peak <= len(data):
            X_list.append(data[start_peak:end_peak])
            y_list.append(0)

        # B. Steady-State Walking / Baseline Window: Sampled from 25% and 75% positions
        for frac in [0.25, 0.75]:
            center = int(len(data) * frac)
            start_ss = center - (WINDOW_SIZE // 2)
            end_ss = start_ss + WINDOW_SIZE
            if start_ss >= 0 and end_ss <= len(data):
                X_list.append(data[start_ss:end_ss])
                y_list.append(0)

        if (idx + 1) % 800 == 0 or (idx + 1) == len(adl_files):
            print(f"      Processed {idx + 1:,}/{len(adl_files):,} ADL files (Total samples: {len(y_list):,})...")

    X_arr = np.array(X_list, dtype=np.float32)
    y_arr = np.array(y_list, dtype=np.int32)
    total_samples = len(y_arr)
    n_adls = total_samples - n_falls

    print(f"\n      [OK] Total Dataset Constructed: {total_samples:,} Windows")
    print(f"           - Fall Windows (Label 1): {n_falls:,} ({n_falls/total_samples*100:.1f}%)")
    print(f"           - ADL Windows  (Label 0): {n_adls:,} ({n_adls/total_samples*100:.1f}%)")

    # ──────────────────────────────────────────────────────────────────────────
    # 3. STANDARDIZATION & DISK PERSISTENCE
    # ──────────────────────────────────────────────────────────────────────────
    print("\n[3/3] Standardizing features across 6 channels (channel-wise, memory-efficient)...")
    N, T, C = X_arr.shape

    # Compute per-channel mean & std over all windows and timesteps
    # X_arr is (N, T, C) float32 — reshape to (N*T, C) is done per-channel to avoid
    # sklearn's float64 upcast of the entire (N*T, C) array (which triggers OOM).
    channel_data = X_arr.reshape(-1, C)          # view, no copy
    means = channel_data.mean(axis=0)            # shape (C,), float32 arithmetic
    stds  = channel_data.std(axis=0)
    stds[stds == 0] = 1.0                        # guard against zero-variance channels

    # Standardize in-place, one channel at a time → peak extra memory ≈ one (N*T,) float32 column
    for c in range(C):
        channel_data[:, c] = (channel_data[:, c] - means[c]) / stds[c]

    # Build a fitted StandardScaler object for inference parity
    scaler = StandardScaler()
    scaler.mean_  = means.astype(np.float64)
    scaler.scale_ = stds.astype(np.float64)
    scaler.var_   = (stds ** 2).astype(np.float64)
    scaler.n_features_in_ = C
    scaler.n_samples_seen_ = np.int64(N * T)
    scaler.feature_names_in_ = None

    X_file = os.path.join(SAVE_PATH, "X.npy")
    y_file = os.path.join(SAVE_PATH, "y.npy")
    scaler_file = os.path.join(SAVE_PATH, "scaler.pkl")

    np.save(X_file, X_arr)
    np.save(y_file, y_arr)
    joblib.dump(scaler, scaler_file)

    print("\n" + "=" * 70)
    print("  SisFall Clean Preprocessing Complete!")
    print(f"  Saved artifacts to {SAVE_PATH}:")
    print(f"    - X.npy      : Shape {X_arr.shape} ({X_arr.nbytes / (1024*1024):.2f} MB)")
    print(f"    - y.npy      : Shape {y_arr.shape}")
    print(f"    - scaler.pkl : 6-Channel StandardScaler")
    print("=" * 70)

if __name__ == "__main__":
    preprocess()
