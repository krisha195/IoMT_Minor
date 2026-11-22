import os
import numpy as np
import joblib
import tensorflow as tf

if hasattr(tf.keras.layers, 'MultiHeadAttention'):
    _orig_mha = tf.keras.layers.MultiHeadAttention.from_config
    @classmethod
    def _patched_mha(cls, config):
        config.pop('use_gate', None)
        return _orig_mha(config)
    tf.keras.layers.MultiHeadAttention.from_config = _patched_mha

BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SAVE_PATH  = os.path.join(BASE_DIR, "ml", "fall_model")
MODEL_PATH = os.path.join(BASE_DIR, "ml", "saved_models")

def run_stress_test():
    print("=" * 80)
    print("  STRESS-TESTING WEARABLE FALL DETECTION MODEL ON REAL-WORLD EDGE CASES")
    print("=" * 80)

    model_file = os.path.join(MODEL_PATH, "fall_tcn_attention.keras")
    scaler_file = os.path.join(SAVE_PATH, "scaler.pkl")

    model = tf.keras.models.load_model(model_file)
    scaler = joblib.load(scaler_file)

    test_cases = {}

    # Case 1: Ideal Clean Fall (Freefall -> 5g Impact -> Motionless Rest)
    t = np.linspace(0, 0.5, 100) # 100 samples (200Hz, 0.5s)
    clean_fall = np.zeros((100, 6), dtype=np.float32)
    # 0-35: Freefall (acc mag ~ 0.2g)
    clean_fall[0:35, 0:3] = np.random.normal(0.1, 0.05, (35, 3))
    # 35: Impact spike (5g in Z and Y)
    clean_fall[35:45, 1] = np.sin(np.linspace(0, np.pi, 10)) * 5.0
    clean_fall[35:45, 2] = np.sin(np.linspace(0, np.pi, 10)) * 4.0
    clean_fall[35:45, 3:6] = np.random.normal(0, 50, (10, 3)) # high rotation
    # 45-100: Motionless Rest (lying on back, 1g on Z, 0 gyro)
    clean_fall[45:100, 2] = 1.0 # 1g gravity
    clean_fall[45:100, 3:6] = 0.0 # zero gyro
    test_cases["1. Ideal High-Impact Fall (Freefall -> 5g Spike -> Rest)"] = clean_fall

    # Case 2: Soft Fall / Slide (Elderly slipping slowly out of chair, peak only 1.2g)
    soft_fall = np.zeros((100, 6), dtype=np.float32)
    # Slow drift from upright to horizontal over 0.5s
    soft_fall[:, 0] = np.linspace(0, 0.2, 100) # subtle tilt
    soft_fall[:, 1] = np.linspace(0, 0.8, 100) # transition from Y
    soft_fall[:, 2] = np.linspace(1.0, 0.3, 100) # loss of vertical gravity
    soft_fall[35:45, 1] += 0.3 # slight bump (peak only 1.2g)
    soft_fall[:, 3:6] = np.random.normal(0, 5.0, (100, 3)) # minimal slow rotation
    test_cases["2. Soft Slow Fall / Slide from Chair (Peak only 1.2g)"] = soft_fall

    # Case 3: Vigorous Arm Movement / Clapping / Gesturing (High kinetic ADL without freefall)
    arm_gesture = np.zeros((100, 6), dtype=np.float32)
    arm_gesture[:, 0] = np.sin(np.linspace(0, 6*np.pi, 100)) * 2.5 # 2.5g waving
    arm_gesture[:, 1] = np.cos(np.linspace(0, 6*np.pi, 100)) * 2.0
    arm_gesture[:, 2] = 1.0 + np.sin(np.linspace(0, 4*np.pi, 100)) * 1.5
    arm_gesture[:, 3:6] = np.sin(np.linspace(0, 8*np.pi, 100))[:, None] * 250.0 # high angular velocity
    test_cases["3. Vigorous Arm Gesture / Rhythmic Movement (No Freefall)"] = arm_gesture

    # Case 4: Sensor Dropped on Table (Freefall -> Sharp Impact -> Rest, but NOT on a human)
    drop_on_table = np.zeros((100, 6), dtype=np.float32)
    # 0-35: 0g freefall
    drop_on_table[0:35, 0:3] = np.random.normal(0.0, 0.02, (35, 3))
    # 35-38: Very sharp mechanical shock (12g for 3 samples)
    drop_on_table[35:38, 2] = 12.0
    drop_on_table[35:38, 3:6] = np.random.normal(0, 300, (3, 3))
    # 38-100: Dead still (lying flat on table)
    drop_on_table[38:100, 2] = 1.0
    test_cases["4. Device Dropped from Hand onto Hard Table"] = drop_on_table

    # Case 5: Fall with Post-Fall Agitation / Crawling (No motionless rest)
    fall_with_crawling = np.copy(clean_fall)
    # Instead of motionless rest after sample 45, patient is moving/trying to stand:
    fall_with_crawling[45:100, 0:3] += np.sin(np.linspace(0, 4*np.pi, 55))[:, None] * 1.2
    fall_with_crawling[45:100, 3:6] += np.cos(np.linspace(0, 4*np.pi, 55))[:, None] * 80.0
    test_cases["5. Real Fall followed by Active Movement / Crawling (No Flat Rest)"] = fall_with_crawling

    # Case 6: Stumble and Immediate Recovery (Jerk spike, then continued walking)
    stumble_recover = np.zeros((100, 6), dtype=np.float32)
    # Walking baseline
    stumble_recover[:, 2] = 1.0 + np.sin(np.linspace(0, 3*np.pi, 100)) * 0.4
    # Stumble spike at sample 35 (3.0g forward jerk)
    stumble_recover[35:42, 0] = 3.2
    stumble_recover[35:42, 3] = 180.0 # rotational jerk
    # Immediate recovery (normal walking continues)
    stumble_recover[43:100, 2] = 1.0 + np.sin(np.linspace(0, 4*np.pi, 57)) * 0.5
    stumble_recover[43:100, 0] = np.sin(np.linspace(0, 4*np.pi, 57)) * 0.3
    test_cases["6. Stumble / Trip with Immediate Stride Recovery"] = stumble_recover

    print(f"\nEvaluating {len(test_cases)} edge-case scenarios:\n")
    print(f"{'Scenario':<65} | {'Model Prob':<10} | {'Verdict'}")
    print("-" * 90)

    for name, sample in test_cases.items():
        # Expand 6 channels to 9 channels: [ax, ay, az, gx, gy, gz, ax, ay, az]
        if sample.shape[1] == 6:
            sample_9 = np.hstack([sample, sample[:, 0:3]])
        else:
            sample_9 = sample

        # Interpolate / resample to 200 samples to match model input shape
        if len(sample_9) != 200:
            indices = np.linspace(0, len(sample_9) - 1, 200)
            sample_200 = np.zeros((200, 9), dtype=np.float32)
            for c in range(9):
                sample_200[:, c] = np.interp(indices, np.arange(len(sample_9)), sample_9[:, c])
        else:
            sample_200 = sample_9

        sample_scaled = scaler.transform(sample_200).reshape(1, 200, 9)
        prob = float(model.predict(sample_scaled, verbose=0)[0][0])
        pred = "FALL DETECTED" if prob >= 0.5 else "NORMAL (ADL)"
        print(f"{name:<65} | {prob*100:6.2f}%   | {pred}")

if __name__ == "__main__":
    run_stress_test()
