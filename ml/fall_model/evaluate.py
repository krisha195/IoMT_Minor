import os
import numpy as np
import joblib
import tensorflow as tf
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

BASE_DIR    = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL_PATH  = os.path.join(BASE_DIR, "ml", "saved_models", "fall_tcn_attention.keras")
SCALER_PATH = os.path.join(BASE_DIR, "ml", "fall_model", "scaler.pkl")
UNSEEN_X    = os.path.join(BASE_DIR, "ml", "fall_model", "X_test_unseen.npy")
UNSEEN_Y    = os.path.join(BASE_DIR, "ml", "fall_model", "y_test_unseen.npy")

def convert_to_model_input(X_6, scaler):
    """
    Adapts 6-channel 100-sample raw recordings to the 9-channel 200-sample 
    format expected by the loaded TCN + Attention Fall Model.
    """
    N = len(X_6)
    if X_6.ndim == 3 and X_6.shape[1:] == (200, 9):
        X_scaled = scaler.transform(
            X_6.reshape(-1, 9)
        ).reshape(N, 200, 9)
        return X_scaled
    # Expand to [ax1, ay1, az1, ax2, ay2, az2, gx, gy, gz].
    X_9 = np.concatenate([
        X_6[:, :, 0:3],
        X_6[:, :, 0:3],
        X_6[:, :, 3:6],
    ], axis=-1)
    
    # Resample from 100 timesteps to 200 timesteps
    t_old = np.linspace(0, 1, 100)
    t_new = np.linspace(0, 1, 200)
    X_200 = np.zeros((N, 200, 9), dtype=np.float32)
    for i in range(N):
        for c in range(9):
            X_200[i, :, c] = np.interp(t_new, t_old, X_9[i, :, c])
            
    n_scaler = getattr(scaler, "n_features_in_", 6)
    if n_scaler == 9:
        X_scaled = scaler.transform(X_200.reshape(-1, 9)).reshape(N, 200, 9)
    else:
        X_scaled_6 = scaler.transform(X_200[:, :, :6].reshape(-1, 6)).reshape(N, 200, 6)
        X_scaled = np.concatenate([
            X_scaled_6[:, :, 0:3],
            X_scaled_6[:, :, 0:3],
            X_scaled_6[:, :, 3:6],
        ], axis=-1)
        
    return X_scaled

def evaluate_fall_model():
    print("=" * 75)
    print("  FALL TCN + ATTENTION MODEL: COMPREHENSIVE PERFORMANCE EVALUATION")
    print("=" * 75)

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
    if not os.path.exists(UNSEEN_X) or not os.path.exists(UNSEEN_Y):
        raise FileNotFoundError(f"Unseen test data not found in {os.path.dirname(UNSEEN_X)}")

    print(f"Loading model: {MODEL_PATH}")
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    scaler = joblib.load(SCALER_PATH)

    X_unseen = np.load(UNSEEN_X)
    y_unseen = np.load(UNSEEN_Y)
    print(f"Test Set: Held-Out Unseen Subjects (SA19-SA23, SE13-SE15)")
    print(f"Total Test Samples: {len(y_unseen):,} (Falls: {np.sum(y_unseen==1):,}, ADLs: {np.sum(y_unseen==0):,})")

    print("\nRunning inference on unseen subject test set...")
    X_input = convert_to_model_input(X_unseen, scaler)
    y_probs = model.predict(X_input, batch_size=128, verbose=0).ravel()

    for name, threshold in [("Standard Decision Boundary", 0.50), ("Production Alert Boundary", 0.75)]:
        y_pred = (y_probs >= threshold).astype(int)
        acc = accuracy_score(y_unseen, y_pred) * 100
        sens = recall_score(y_unseen, y_pred) * 100
        prec = precision_score(y_unseen, y_pred) * 100
        f1 = f1_score(y_unseen, y_pred) * 100
        auc = roc_auc_score(y_unseen, y_probs) * 100
        cm = confusion_matrix(y_unseen, y_pred)
        tn, fp, fn, tp = cm.ravel()
        spec = (tn / (tn + fp)) * 100

        print("\n" + "-" * 75)
        print(f"  METRIC SUITE: {name.upper()} (Threshold = {threshold:.2f})")
        print("-" * 75)
        print(f"  Classification Accuracy            : {acc:.2f}%")
        print(f"  Area Under ROC Curve (ROC-AUC)     : {auc:.2f}%")
        print(f"  Sensitivity (Recall on Falls)      : {sens:.2f}% ({tp:,}/{tp+fn:,} falls caught)")
        print(f"  Specificity (ADL False Alarm Reject): {spec:.2f}% ({tn:,}/{tn+fp:,} ADLs rejected)")
        print(f"  Precision (Positive Predictive Val): {prec:.2f}%")
        print(f"  F1-Score                           : {f1:.2f}%")
        print(f"  False Alarm Rate                   : {100 - spec:.2f}%")
        print()
        print("  Confusion Matrix:")
        print(f"    True ADL Normal [TN]: {tn:<6} | False Alarm [FP]: {fp}")
        print(f"    Missed Fall     [FN]: {fn:<6} | Detected Fall[TP]: {tp}")
    print("=" * 75)

if __name__ == "__main__":
    evaluate_fall_model()
