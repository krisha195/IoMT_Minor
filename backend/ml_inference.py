import numpy as np
import joblib
import os
import tensorflow as tf
from keras.layers import BatchNormalization
from collections import deque
from typing import Dict

# Compatibility patch for deserializing models in Keras 3
_orig_from_config = BatchNormalization.from_config
@classmethod
def _patched_bn_from_config(cls, config):
    for k in ['renorm', 'renorm_clipping', 'renorm_momentum']:
        config.pop(k, None)
    return _orig_from_config(config)

BatchNormalization.from_config = _patched_bn_from_config

if hasattr(tf.keras.layers, 'MultiHeadAttention'):
    _orig_mha_from_config = tf.keras.layers.MultiHeadAttention.from_config
    @classmethod
    def _patched_mha_from_config(cls, config):
        config.pop('use_gate', None)
        return _orig_mha_from_config(config)
    tf.keras.layers.MultiHeadAttention.from_config = _patched_mha_from_config

BASE = os.path.dirname(__file__)
MODELS = os.path.join(BASE, "..", "ml", "saved_models")
FALL_SCALER = os.path.join(BASE, "..", "ml", "fall_model", "scaler.pkl")
VITALS_SCALER = os.path.join(BASE, "..", "ml", "vitals_model", "scaler.pkl")

# Load Vitals Model: Multi-Head Attention Transformer Encoder Autoencoder
TRANSFORMER_MODEL = os.path.join(MODELS, "vitals_transformer.keras")
print("[ML INFERENCE] Loading Vitals Transformer Encoder model...")
vitals_model = tf.keras.models.load_model(TRANSFORMER_MODEL, compile=False)

vitals_threshold = float(np.load(os.path.join(MODELS, "vitals_threshold.npy")))
vitals_scaler    = joblib.load(VITALS_SCALER)

# Load Fall Model: Temporal Convolutional Network (TCN) + Self-Attention
TCN_ATTN_MODEL = os.path.join(MODELS, "fall_tcn_attention.keras")
print("[ML INFERENCE] Loading Fall TCN + Attention model...")
fall_model = tf.keras.models.load_model(TCN_ATTN_MODEL, compile=False)

fall_scaler = joblib.load(FALL_SCALER)

if vitals_model.input_shape[1:] != (30, 3):
    raise RuntimeError(
        "Incompatible vitals model: expected input shape (None, 30, 3), "
        f"got {vitals_model.input_shape}. Retrain on HR, SpO2, and temperature."
    )
if getattr(vitals_scaler, "n_features_in_", None) != 3:
    raise RuntimeError(
        "Incompatible vitals scaler: expected 3 features (HR, SpO2, temperature), "
        f"got {getattr(vitals_scaler, 'n_features_in_', None)}."
    )

if fall_model.input_shape[1:] != (200, 9):
    raise RuntimeError(
        "Incompatible fall model: expected input shape (None, 200, 9), "
        f"got {fall_model.input_shape}. Use the matching production artifact."
    )
if getattr(fall_scaler, "n_features_in_", None) != 9:
    raise RuntimeError(
        "Incompatible fall scaler: expected 9 features, "
        f"got {getattr(fall_scaler, 'n_features_in_', None)}."
    )

# Dynamically extract window sizes and feature dimensions from loaded models
VITALS_WINDOW   = vitals_model.input_shape[1] if vitals_model.input_shape[1] is not None else 30
VITALS_FEATURES = vitals_model.input_shape[2] if vitals_model.input_shape[2] is not None else 3

FALL_WINDOW   = fall_model.input_shape[1] if fall_model.input_shape[1] is not None else 200
FALL_FEATURES = fall_model.input_shape[2] if fall_model.input_shape[2] is not None else 9

# Rolling window buffers per patient
vitals_buffers: Dict[int, deque] = {}
fall_buffers:   Dict[int, deque] = {}
fall_previous_accelerations: Dict[int, np.ndarray] = {}

def infer_vitals(patient_id: int, hr, spo2, temperature=None):
    if hr is None or spo2 is None:
        return {"anomaly": False, "score": 0.0, "threshold": vitals_threshold}

    buf = vitals_buffers.setdefault(patient_id, deque(maxlen=VITALS_WINDOW))
    
    temp_val = float(temperature) if temperature is not None else 36.8
    raw_feat = [[float(hr), float(spo2), temp_val]]

    scaled = vitals_scaler.transform(raw_feat)[0]
    buf.append(scaled)

    # Prime buffer immediately on startup so ML detection is active from first packet
    if len(buf) < VITALS_WINDOW:
        while len(buf) < VITALS_WINDOW:
            buf.appendleft(scaled)

    seq = np.array(buf, dtype=np.float32)[np.newaxis]   # (1, 30, n_features)
    recon = vitals_model.predict(seq, verbose=0)
    score = float(np.mean(np.square(seq - recon)))
    return {"anomaly": score > vitals_threshold, "score": round(score, 6), "threshold": vitals_threshold}

def infer_fall(patient_id: int, ax, ay, az, gx=0.0, gy=0.0, gz=0.0):
    ax = float(ax) if ax is not None else 0.0
    ay = float(ay) if ay is not None else 0.0
    az = float(az) if az is not None else 0.0
    gx = float(gx) if gx is not None else 0.0
    gy = float(gy) if gy is not None else 0.0
    gz = float(gz) if gz is not None else 0.0

    buf = fall_buffers.setdefault(patient_id, deque(maxlen=FALL_WINDOW))
    
    acceleration = np.array([ax, ay, az], dtype=np.float32)
    previous_acceleration = fall_previous_accelerations.get(patient_id)
    fall_previous_accelerations[patient_id] = acceleration
    impact_delta = (
        float(np.linalg.norm(acceleration - previous_acceleration))
        if previous_acceleration is not None else 0.0
    )

    # Build feature row matching FALL_FEATURES expected by TCN model
    if FALL_FEATURES == 9:
        # [ax1, ay1, az1, ax2, ay2, az2, gx, gy, gz]
        raw_feat = np.array([[ax, ay, az, ax, ay, az, gx, gy, gz]], dtype=np.float32)
    elif FALL_FEATURES == 6:
        raw_feat = np.array([[ax, ay, az, gx, gy, gz]], dtype=np.float32)
    else:
        raw_feat = np.array([[ax, ay, az]], dtype=np.float32)

    n_scaler = getattr(fall_scaler, "n_features_in_", raw_feat.shape[1])
    if n_scaler == raw_feat.shape[1]:
        scaled = fall_scaler.transform(raw_feat)[0]
    else:
        scaled = raw_feat[0]

    buf.append(scaled)

    # Prime buffer immediately on startup
    if len(buf) < FALL_WINDOW:
        while len(buf) < FALL_WINDOW:
            buf.appendleft(scaled)

    # Compare consecutive samples so a static sensor offset cannot look like an impact.
    if impact_delta < 1.8:
        return {"fall_detected": False, "confidence": 0.0}

    seq = np.array(buf, dtype=np.float32)[np.newaxis]   # (1, 200, 9)
    prob = float(fall_model.predict(seq, verbose=0)[0][0])
    return {"fall_detected": prob > 0.75, "confidence": round(prob, 4)}
