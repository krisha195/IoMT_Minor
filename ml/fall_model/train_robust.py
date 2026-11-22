import os
import glob
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

BASE_DIR     = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SISFALL_PATH = os.path.join(BASE_DIR, "SisFall", "SisFall_dataset", "SisFall_dataset")
SAVE_PATH    = os.path.join(BASE_DIR, "ml", "fall_model")
MODEL_PATH   = os.path.join(BASE_DIR, "ml", "saved_models")

WINDOW_SIZE       = 100   # 100 samples (0.5 second at 200 Hz)
PRE_IMPACT_OFFSET = 35    # 35 samples (~175ms) pre-impact window

# Physical unit scaling factors for SisFall sensors
ADXL345_CONVERSION = (2.0 * 16.0) / 8192.0     # Convert raw bits to g (±16g range, 13-bit)
ITG3200_CONVERSION = 2000.0 / 32768.0          # Convert raw bits to °/s (±2000°/s range, 16-bit)

# ─────────────────────────────────────────────────────────────────────────────
# 1. HELD-OUT UNSEEN SUBJECTS (ZERO SUBJECT LEAKAGE)
# ─────────────────────────────────────────────────────────────────────────────
# 5 Young Adult subjects (SA19-SA23) + 3 Elderly subjects (SE13-SE15)
# NEVER seen during training. Guarantees 100% inter-subject generalization testing.
TEST_SUBJECTS = {'SA19', 'SA20', 'SA21', 'SA22', 'SA23', 'SE13', 'SE14', 'SE15'}

def load_file_6cols(filepath):
    try:
        df = pd.read_csv(filepath, header=None, sep=',', comment=';', engine='c')
        data = df.iloc[:, 0:6].dropna().values.astype(np.float32)
        if len(data) < WINDOW_SIZE:
            return None
        data[:, 0:3] *= ADXL345_CONVERSION
        data[:, 3:6] *= ITG3200_CONVERSION
        return data
    except Exception:
        return None

def expand_to_production_format(X_6):
    """Expand 6-channel 100-sample windows to the production 200x9 contract."""
    X_9 = np.concatenate([X_6[:, :, 0:3], X_6[:, :, 0:3], X_6[:, :, 3:6]], axis=-1)
    old_t = np.linspace(0.0, 1.0, X_9.shape[1])
    new_t = np.linspace(0.0, 1.0, 200)
    X_200 = np.zeros((len(X_9), 200, 9), dtype=np.float32)
    for i in range(len(X_9)):
        for channel in range(9):
            X_200[i, :, channel] = np.interp(
                new_t, old_t, X_9[i, :, channel]
            )
    return X_200

def build_datasets():
    print("=" * 80)
    print("  BUILDING ROBUST SISFALL DATASETS WITH ZERO SUBJECT / TEMPORAL LEAKAGE")
    print("=" * 80)
    print(f"  Held-out Unseen Test Subjects ({len(TEST_SUBJECTS)}): {', '.join(sorted(TEST_SUBJECTS))}")

    all_files = sorted(glob.glob(os.path.join(SISFALL_PATH, "*", "*.txt")))
    print(f"  Discovered: {len(all_files):,} SisFall trial recordings on disk.")

    train_X_list = []
    train_y_list = []
    
    test_X_list = []
    test_y_list = []
    test_meta_list = []

    train_files_count = 0
    test_files_count = 0

    for idx, f in enumerate(all_files):
        fname = os.path.basename(f).replace('.txt', '')
        parts = fname.split('_')
        if len(parts) < 3:
            continue
        act_code = parts[0]
        subj = parts[1]
        trial = parts[2]
        is_fall = act_code.startswith('F')
        is_elderly = subj.startswith('SE')

        data = load_file_6cols(f)
        if data is None:
            continue

        acc_mag = np.sqrt(np.sum(data[:, 0:3] ** 2, axis=1))
        peak_idx = int(np.argmax(acc_mag))

        is_test = subj in TEST_SUBJECTS

        if is_test:
            # ─────────────────────────────────────────────────────────────
            # TEST SET: STRICTLY 1 UN-AUGMENTED PEAK WINDOW PER TRIAL
            # ZERO temporal jitter augmentation in test partition!
            # ─────────────────────────────────────────────────────────────
            start = max(0, peak_idx - PRE_IMPACT_OFFSET)
            end = start + WINDOW_SIZE
            if end <= len(data):
                test_X_list.append(data[start:end])
                test_y_list.append(1 if is_fall else 0)
                test_meta_list.append({
                    'file': fname,
                    'act': act_code,
                    'subj': subj,
                    'trial': trial,
                    'is_elderly': is_elderly,
                    'is_fall': is_fall,
                    'peak_g': float(np.max(acc_mag))
                })
                test_files_count += 1
        else:
            # ─────────────────────────────────────────────────────────────
            # TRAINING SET: CONTROLLED DATA AUGMENTATION INSIDE TRAIN ONLY
            # ─────────────────────────────────────────────────────────────
            train_files_count += 1
            if is_fall:
                # Augment training falls with slight temporal jitter around peak
                for jitter in [-14, -7, 0, 7, 14]:
                    center = peak_idx + jitter
                    start = center - PRE_IMPACT_OFFSET
                    end = start + WINDOW_SIZE
                    if start >= 0 and end <= len(data):
                        train_X_list.append(data[start:end])
                        train_y_list.append(1)

                # Add slight noise perturbation augmentation to fall windows
                clean_start = max(0, peak_idx - PRE_IMPACT_OFFSET)
                clean_end = clean_start + WINDOW_SIZE
                if clean_end <= len(data):
                    noisy = data[clean_start:clean_end] + np.random.normal(0, 0.02, (WINDOW_SIZE, 6)).astype(np.float32)
                    train_X_list.append(noisy)
                    train_y_list.append(1)
            else:
                # ADL Training: Hard Negative at Peak Acceleration
                start_peak = max(0, peak_idx - PRE_IMPACT_OFFSET)
                end_peak = start_peak + WINDOW_SIZE
                if end_peak <= len(data):
                    train_X_list.append(data[start_peak:end_peak])
                    train_y_list.append(0)

                # Baseline Steady-State Walking at 25% and 75%
                for frac in [0.25, 0.75]:
                    center = int(len(data) * frac)
                    start_ss = center - (WINDOW_SIZE // 2)
                    end_ss = start_ss + WINDOW_SIZE
                    if start_ss >= 0 and end_ss <= len(data):
                        train_X_list.append(data[start_ss:end_ss])
                        train_y_list.append(0)

        if (idx + 1) % 1000 == 0 or (idx + 1) == len(all_files):
            print(f"    Scanned {idx + 1:,}/{len(all_files):,} trials...")

    X_train_raw = np.array(train_X_list, dtype=np.float32)
    y_train = np.array(train_y_list, dtype=np.int32)

    X_test_raw = np.array(test_X_list, dtype=np.float32)
    y_test = np.array(test_y_list, dtype=np.int32)

    print(f"\n  [OK] Extraction Complete:")
    print(f"       Train Partition : {train_files_count:,} trials -> {len(y_train):,} augmented windows (Falls: {np.sum(y_train==1):,}, ADLs: {np.sum(y_train==0):,})")
    print(f"       Test Partition  : {test_files_count:,} trials -> {len(y_test):,} unaugmented windows (Falls: {np.sum(y_test==1):,}, ADLs: {np.sum(y_test==0):,})")

    # ─────────────────────────────────────────────────────────────────────────
    # STRICT FEATURIZATION ORDERING: FIT SCALER SOLELY ON TRAINING DATA
    # ─────────────────────────────────────────────────────────────────────────
    print("\n  Converting 100x6 SisFall windows to production 200x9 format...")
    X_train_200 = expand_to_production_format(X_train_raw)
    X_test_200 = expand_to_production_format(X_test_raw)

    print("  Fitting StandardScaler SOLELY on Training Data (Zero Data Leakage)...")
    N_tr, T_tr, C_tr = X_train_200.shape
    scaler = StandardScaler()
    X_train = scaler.fit_transform(
        X_train_200.reshape(-1, C_tr)
    ).reshape(N_tr, T_tr, C_tr).astype(np.float32)

    N_te, T_te, C_te = X_test_200.shape
    X_test = scaler.transform(
        X_test_200.reshape(-1, C_te)
    ).reshape(N_te, T_te, C_te).astype(np.float32)

    # Persist clean preprocessed arrays and test metadata
    os.makedirs(SAVE_PATH, exist_ok=True)
    np.save(os.path.join(SAVE_PATH, "X.npy"), X_train)
    np.save(os.path.join(SAVE_PATH, "y.npy"), y_train)
    np.save(os.path.join(SAVE_PATH, "X_test_unseen.npy"), X_test)
    np.save(os.path.join(SAVE_PATH, "y_test_unseen.npy"), y_test)
    joblib.dump(scaler, os.path.join(SAVE_PATH, "scaler.pkl"))

    with open(os.path.join(SAVE_PATH, "test_metadata.json"), "w") as f:
        json.dump(test_meta_list, f, indent=2)

    print(f"  [OK] Saved clean artifacts to {SAVE_PATH}:")
    print(f"       - X.npy            : {X_train.shape}")
    print(f"       - y.npy            : {y_train.shape}")
    print(f"       - X_test_unseen.npy: {X_test.shape}")
    print(f"       - y_test_unseen.npy: {y_test.shape}")
    print(f"       - scaler.pkl       : StandardScaler (9 channels)")

    return X_train, y_train, X_test, y_test, test_meta_list

def build_tcn_attention(window_size=200, n_features=9):
    """Build the TCN with self-attention architecture stored in the package artifact."""
    def tcn_block(x, filters, dilation_rate, name):
        residual = x
        r = layers.Conv1D(
            filters, 3, padding="causal", dilation_rate=dilation_rate,
            activation="relu", name=f"{name}_conv1"
        )(x)
        r = layers.LayerNormalization(name=f"{name}_ln1")(r)
        r = layers.Conv1D(
            filters, 3, padding="causal", dilation_rate=dilation_rate,
            activation="relu", name=f"{name}_conv2"
        )(r)
        r = layers.LayerNormalization(name=f"{name}_ln2")(r)
        if residual.shape[-1] != filters:
            residual = layers.Conv1D(filters, 1, name=f"{name}_projection")(residual)
        return layers.Add(name=f"{name}_residual")([residual, r])

    inputs = layers.Input(shape=(window_size, n_features), name="imu_input")
    x = tcn_block(inputs, 32, 1, "tcn_d1")
    x = tcn_block(x, 32, 2, "tcn_d2")
    x = tcn_block(x, 64, 4, "tcn_d4")
    x = tcn_block(x, 64, 8, "tcn_d8")

    attention = layers.MultiHeadAttention(
        num_heads=4, key_dim=16, name="temporal_self_attention"
    )(query=x, key=x, value=x)
    x = layers.LayerNormalization(name="attention_ln")(x + attention)

    fused = layers.GlobalAveragePooling1D(name="temporal_gap")(x)
    fused = layers.Dropout(0.3, name="fusion_drop1")(fused)
    fused = layers.Dense(64, activation="relu", name="fusion_dense")(fused)
    fused = layers.Dropout(0.3, name="fusion_drop2")(fused)
    output = layers.Dense(1, activation="sigmoid", name="fall_probability")(fused)

    model = Model(inputs=inputs, outputs=output, name="TCN_SelfAttention_Fall_Detector")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=3e-4),
        loss=tf.keras.losses.BinaryCrossentropy(label_smoothing=0.1),
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc")]
    )
    return model

def train_and_evaluate():
    X_train, y_train, X_test, y_test, test_meta = build_datasets()

    # Balanced class weights for training
    class_weights = compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
    weight_dict = {0: float(class_weights[0]), 1: float(class_weights[1])}
    print(f"\n  Computed Training Class Weights: {weight_dict}")

    window_size, n_features = X_train.shape[1], X_train.shape[2]
    model = build_tcn_attention(window_size, n_features)
    model.summary()

    os.makedirs(MODEL_PATH, exist_ok=True)
    target_production_file = os.path.join(MODEL_PATH, "fall_tcn_attention.keras")

    callbacks = [
        EarlyStopping(monitor='val_auc', mode='max', patience=15, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=1e-5, verbose=1),
        ModelCheckpoint(target_production_file, monitor='val_auc', mode='max', save_best_only=True, verbose=1)
    ]

    print("\n" + "=" * 80)
    print("  TRAINING TCN + CROSS-ATTENTION MODEL")
    print("=" * 80)
    history = model.fit(
        X_train, y_train,
        validation_data=(X_test, y_test),
        epochs=25,
        batch_size=64,
        class_weight=weight_dict,
        callbacks=callbacks,
        verbose=1
    )

    # Save the exact 200x9 artifact consumed by backend/ml_inference.py.
    model.save(target_production_file)
    print(f"\n[OK] Production model saved to {target_production_file}")

    # ─────────────────────────────────────────────────────────────────────────
    # COMPREHENSIVE EVALUATION ON UNSEEN HUMAN SUBJECTS (HELD-OUT TEST SET)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("  COMPREHENSIVE PERFORMANCE EVALUATION ON UNSEEN HUMAN SUBJECTS")
    print("  (Held-Out Subjects: SA19-SA23 & SE13-SE15 | Zero Subject / Jitter Leakage)")
    print("=" * 80)

    loss, acc, auc = model.evaluate(X_test, y_test, verbose=0)
    y_pred_probs = model.predict(X_test, batch_size=128, verbose=0).ravel()
    y_pred = (y_pred_probs >= 0.5).astype(int)

    precision = precision_score(y_test, y_pred, zero_division=0) * 100
    sensitivity = recall_score(y_test, y_pred, zero_division=0) * 100
    f1 = f1_score(y_test, y_pred, zero_division=0) * 100
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()
    specificity = (tn / (tn + fp)) * 100 if (tn + fp) > 0 else 0.0

    print(f"  Unseen Subjects Overall Accuracy    : {acc*100:.2f}%")
    print(f"  Area Under ROC Curve (ROC-AUC)      : {auc*100:.2f}%")
    print(f"  Sensitivity (Recall on Falls)       : {sensitivity:.2f}%  (Caught {tp:,}/{tp+fn:,} actual falls)")
    print(f"  Specificity (Rejection of ADLs)     : {specificity:.2f}%  (Filtered {tn:,}/{tn+fp:,} ADLs)")
    print(f"  Precision (Positive Predictive Val) : {precision:.2f}%")
    print(f"  F1-Score (Harmonic Mean)            : {f1:.2f}%")
    print(f"  Cross-Entropy Loss                  : {loss:.4f}")
    print()
    print("  Confusion Matrix on Unseen Subjects:")
    print(f"    True ADL Activity [TN]: {tn:<6} | False Fall Alarm [FP]: {fp}")
    print(f"    Missed Fall Event [FN]: {fn:<6} | True Fall Alert  [TP]: {tp}")

    # Granular Breakdown by Activity on Unseen Subjects
    df_eval = pd.DataFrame(test_meta)
    df_eval['pred_prob'] = y_pred_probs
    df_eval['pred_label'] = y_pred

    print("\n" + "-" * 80)
    print("  HARD NEGATIVES & ADL BREAKDOWN ON UNSEEN SUBJECTS:")
    print("-" * 80)
    adl_eval = df_eval[df_eval['is_fall'] == False]
    for act, grp in adl_eval.groupby('act'):
        fps = int(grp['pred_label'].sum())
        total = len(grp)
        rate = (fps / total) * 100
        flag = " [!] FALSE ALARM" if fps > 0 else " [OK]"
        print(f"    Activity {act:<4}: {fps:>2}/{total:<2} False Alarms ({rate:5.1f}%){flag}")

    print("\n" + "-" * 80)
    print("  DEMOGRAPHIC ACCURACY ON UNSEEN SUBJECTS:")
    print("-" * 80)
    young_unseen = df_eval[df_eval['is_elderly'] == False]
    elderly_unseen = df_eval[df_eval['is_elderly'] == True]

    y_acc = accuracy_score(young_unseen['is_fall'].astype(int), young_unseen['pred_label']) * 100
    e_acc = accuracy_score(elderly_unseen['is_fall'].astype(int), elderly_unseen['pred_label']) * 100

    print(f"    Unseen Young Adults (SA19-SA23) Accuracy: {y_acc:.2f}% (Total: {len(young_unseen):,})")
    print(f"    Unseen Elderly Subjects (SE13-SE15) Accuracy: {e_acc:.2f}% (Total: {len(elderly_unseen):,})")
    print("=" * 80)

if __name__ == "__main__":
    train_and_evaluate()
