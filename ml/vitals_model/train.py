import numpy as np
import os
import matplotlib.pyplot as plt
import joblib
from sklearn.metrics import r2_score, accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint

BASE_DIR    = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SAVE_PATH   = os.path.join(BASE_DIR, "ml", "vitals_model")
MODEL_PATH  = os.path.join(BASE_DIR, "ml", "saved_models")
WINDOW_SIZE = 30
N_FEATURES  = 3  # [HR, SpO2, Synthetic Temperature]

def build_transformer_encoder(window_size=30, n_features=3, d_model=64, num_heads=4, ff_dim=128, num_layers=2, dropout=0.1):
    """
    Transformer Encoder Architecture for Multivariate Time-Series Anomaly Detection.
    Replaces traditional LSTM Autoencoder:
    - Parallel multi-head self-attention captures complex non-linear coupling across vitals.
    - Eliminates vanishing gradients and sequential recurrence bottlenecks.
    """
    inputs = layers.Input(shape=(window_size, n_features), name="vitals_input")

    # 1. Linear Projection to d_model space
    x = layers.Dense(d_model, name="input_projection")(inputs)

    # 2. Learnable Positional Encoding
    positions = tf.range(start=0, limit=window_size, delta=1)
    pos_embedding = layers.Embedding(input_dim=window_size, output_dim=d_model, name="temporal_pos_embedding")(positions)
    x = x + pos_embedding
    x = layers.Dropout(dropout)(x)

    # 3. Stacked Transformer Encoder Blocks
    for i in range(num_layers):
        # Multi-Head Self-Attention
        attn_output = layers.MultiHeadAttention(
            num_heads=num_heads,
            key_dim=d_model // num_heads,
            dropout=dropout,
            name=f"multi_head_attention_{i+1}"
        )(x, x)
        x = layers.Add(name=f"residual_attn_{i+1}")([x, attn_output])
        x = layers.LayerNormalization(epsilon=1e-6, name=f"layernorm_attn_{i+1}")(x)

        # Feed-Forward Sub-Network
        ffn = layers.Dense(ff_dim, activation='relu', name=f"ffn_dense1_{i+1}")(x)
        ffn = layers.Dropout(dropout)(ffn)
        ffn = layers.Dense(d_model, name=f"ffn_dense2_{i+1}")(ffn)
        x = layers.Add(name=f"residual_ffn_{i+1}")([x, ffn])
        x = layers.LayerNormalization(epsilon=1e-6, name=f"layernorm_ffn_{i+1}")(x)

    # 4. Reconstruction Projection Head
    outputs = layers.Dense(n_features, activation='linear', name="reconstructed_vitals")(x)

    model = Model(inputs=inputs, outputs=outputs, name="Vitals_Transformer_Encoder")
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3), loss='mse')
    return model

def train():
    os.makedirs(MODEL_PATH, exist_ok=True)
    seq_file = os.path.join(SAVE_PATH, "sequences.npy")
    patient_file = os.path.join(SAVE_PATH, "sequence_patient_ids.npy")
    if not os.path.exists(seq_file):
        raise FileNotFoundError(f"{seq_file} not found. Run 'python preprocess.py' first.")
    if not os.path.exists(patient_file):
        raise FileNotFoundError(
            f"{patient_file} not found. Re-run 'python preprocess.py' with patient-safe preprocessing."
        )

    print("Loading sequences...")
    sequences = np.load(seq_file)
    print(f"Loaded sequence tensor: {sequences.shape} (Windows: {len(sequences)}, Timesteps: {sequences.shape[1]}, Features: {sequences.shape[2]})")

    sequence_patient_ids = np.load(patient_file)
    if len(sequence_patient_ids) != len(sequences):
        raise ValueError("Sequence count does not match patient ID count")

    # Patient-level 80/20 split prevents windows from the same BIDMC
    # recording appearing in both training and validation.
    unique_patients = np.unique(sequence_patient_ids)
    split_index = int(len(unique_patients) * 0.8)
    rng = np.random.default_rng(42)
    rng.shuffle(unique_patients)
    train_patients = set(unique_patients[:split_index])
    val_patients = set(unique_patients[split_index:])
    train_mask = np.array([patient_id in train_patients for patient_id in sequence_patient_ids])
    val_mask = np.array([patient_id in val_patients for patient_id in sequence_patient_ids])
    X_train = sequences[train_mask]
    X_val = sequences[val_mask]
    print(f"Train set: {X_train.shape} | Validation set: {X_val.shape}")

    print("Building Transformer Encoder Model...")
    model = build_transformer_encoder(WINDOW_SIZE, N_FEATURES)
    model.summary()

    target_model_path = os.path.join(MODEL_PATH, "vitals_transformer.keras")

    callbacks = [
        EarlyStopping(monitor='val_loss', patience=6, restore_best_weights=True, verbose=1),
        ModelCheckpoint(target_model_path, monitor='val_loss', save_best_only=True, verbose=1)
    ]

    print("Beginning training...")
    history = model.fit(
        X_train, X_train,
        validation_data=(X_val, X_val),
        epochs=40,
        batch_size=64,
        callbacks=callbacks,
        verbose=1
    )

    print("Computing statistical anomaly threshold on training distribution...")
    X_train_pred = model.predict(X_train, batch_size=128, verbose=0)
    train_errors = np.mean(np.square(X_train - X_train_pred), axis=(1, 2))
    
    mean_err = float(np.mean(train_errors))
    std_err  = float(np.std(train_errors))
    threshold = float(mean_err + 2.0 * std_err)

    threshold_file = os.path.join(MODEL_PATH, "vitals_threshold.npy")
    np.save(threshold_file, threshold)
    print(f"[OK] Anomaly threshold saved to {threshold_file}: {threshold:.6f} (Mean: {mean_err:.6f}, Std: {std_err:.6f})")

    # Plot & Save Loss Curve
    plt.figure(figsize=(10, 4))
    plt.plot(history.history['loss'], label='Train Loss (MSE)', color='#0284c7', lw=2)
    plt.plot(history.history['val_loss'], label='Val Loss (MSE)', color='#e11d48', lw=2)
    plt.title('Vitals Transformer Encoder Reconstruction Loss')
    plt.xlabel('Epoch')
    plt.ylabel('MSE Loss')
    plt.grid(True, alpha=0.3)
    plt.legend()
    loss_plot_path = os.path.join(SAVE_PATH, "training_loss_transformer.png")
    plt.savefig(loss_plot_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"[OK] Training curve saved to {loss_plot_path}")

    # Compute Comprehensive Evaluation Metrics
    scaler_file = os.path.join(SAVE_PATH, "scaler.pkl")
    if os.path.exists(scaler_file):
        scaler = joblib.load(scaler_file)
        X_val_pred = model.predict(X_val, batch_size=128, verbose=0)
        
        # Flatten for physical units evaluation
        val_flat = X_val.reshape(-1, N_FEATURES)
        pred_flat = X_val_pred.reshape(-1, N_FEATURES)
        val_phys = scaler.inverse_transform(val_flat)
        pred_phys = scaler.inverse_transform(pred_flat)

        mae_hr = float(np.mean(np.abs(val_phys[:, 0] - pred_phys[:, 0])))
        mae_spo2 = float(np.mean(np.abs(val_phys[:, 1] - pred_phys[:, 1])))
        mae_temp = float(np.mean(np.abs(val_phys[:, 2] - pred_phys[:, 2])))

        r2_hr = float(r2_score(val_phys[:, 0], pred_phys[:, 0]))
        r2_spo2 = float(r2_score(val_phys[:, 1], pred_phys[:, 1]))
        r2_temp = float(r2_score(val_phys[:, 2], pred_phys[:, 2]))

        hr_acc = float(np.mean(np.abs(val_phys[:, 0] - pred_phys[:, 0]) <= 3.0) * 100)
        spo2_acc = float(np.mean(np.abs(val_phys[:, 1] - pred_phys[:, 1]) <= 1.5) * 100)
        temp_acc = float(np.mean(np.abs(val_phys[:, 2] - pred_phys[:, 2]) <= 0.15) * 100)
        overall_fidelity = (hr_acc + spo2_acc + temp_acc) / 3.0

        val_sample_errors = np.mean(np.square(X_val - X_val_pred), axis=(1, 2))
        specificity = float(np.mean(val_sample_errors <= threshold) * 100)

        print("\n" + "=" * 70)
        print("  VITALS TRANSFORMER ENCODER: FACTOR & ACCURACY EVALUATION")
        print("=" * 70)
        print(f"  Physical Mean Absolute Error (MAE):")
        print(f"    - Heart Rate (HR)                : +/- {mae_hr:.2f} BPM")
        print(f"    - Blood Oxygen (SpO2)            : +/- {mae_spo2:.2f} %")
        print(f"    - Temperature (synthetic)        : +/- {mae_temp:.3f} C")
        print()
        print(f"  Clinical Tolerance Fidelity Accuracy:")
        print(f"    - HR within +/- 3 BPM            : {hr_acc:.2f}%")
        print(f"    - SpO2 within +/- 1.5%          : {spo2_acc:.2f}%")
        print(f"    - Temp within +/- 0.15 C        : {temp_acc:.2f}%")
        print(f"    - Overall Clinical Fidelity      : {overall_fidelity:.2f}%")
        print()
        print(f"  Variance Explained (R² Score):")
        print(f"    - Heart Rate R²                  : {r2_hr:.4f}")
        print(f"    - SpO2 R²                        : {r2_spo2:.4f}")
        print(f"    - Temperature R²                 : {r2_temp:.4f}")
        print()
        print(f"  Normal Specificity (False Alarm Suppr): {specificity:.2f}%")
        print(f"  False Alarm Rate on Normal Telemetry : {100.0 - specificity:.2f}%")
        print("=" * 70)

    print("[SUCCESS] Vitals Transformer Encoder training complete!")

if __name__ == "__main__":
    train()
