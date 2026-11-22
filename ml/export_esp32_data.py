import os
import psycopg2
import pandas as pd
import numpy as np
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(BASE_DIR, "backend", ".env"))

OUTPUT_DIR = os.path.join(BASE_DIR, "ml", "real_esp32_data")

def export_db_vitals():
    """
    Exports live ESP32 telemetry recorded in PostgreSQL database
    for model fine-tuning and empirical patent evidence.
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("Connecting to PostgreSQL iomt_db...")
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        dbname=os.getenv('DB_NAME', 'iomt_db'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'krisha1311')
    )
    
    query = """
        SELECT id, patient_id, timestamp, hr, spo2, temperature, 
               ax, ay, az, motion_score, motion_status, finger_detected
        FROM vitals
        ORDER BY timestamp ASC
    """
    print("Executing extraction query...")
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    csv_path = os.path.join(OUTPUT_DIR, "real_esp32_vitals.csv")
    df.to_csv(csv_path, index=False)
    print(f"[OK] Exported {len(df)} real sensor readings to {csv_path}")
    
    # Filter valid optical contact readings for vitals model calibration
    valid_vitals = df[(df['finger_detected'] == True) & (df['hr'].notnull()) & (df['spo2'].notnull())]
    print(f"Valid sensor contact entries: {len(valid_vitals)}")
    
    if len(valid_vitals) >= 30:
        vitals_array = valid_vitals[['hr', 'spo2', 'temperature']].values.astype(np.float32)
        npy_path = os.path.join(OUTPUT_DIR, "real_vitals_array.npy")
        np.save(npy_path, vitals_array)
        print(f"[OK] Saved numpy array for fine-tuning to {npy_path}")
    else:
        print("[NOTE] Less than 30 valid readings in database yet. Keep streaming from ESP32 to accumulate fine-tuning data.")

if __name__ == "__main__":
    export_db_vitals()
