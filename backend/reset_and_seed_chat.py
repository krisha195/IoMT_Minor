import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))
from database import get_db

def seed_chat():
    conn = get_db()
    c = conn.cursor()

    # Reset all existing messages
    c.execute("TRUNCATE TABLE messages RESTART IDENTITY CASCADE;")
    print("All previous messages truncated.")

    # Base time: 25 minutes ago
    base_time = datetime.now(timezone.utc) - timedelta(minutes=25)

    conversation = [
        # (sender_id, receiver_id, message, minute_offset)
        (
            1, 2,
            "System: Abnormal health readings detected. Patient's temperature and heart rate are elevated.",
            0
        ),
        (
            1, 2,
            "Hello Rahul. I noticed your temperature is higher than normal. Are you feeling unwell?",
            2
        ),
        (
            2, 1,
            "Yes doctor. I have been experiencing fever, body pain and extreme weakness since morning.",
            4
        ),
        (
            1, 2,
            "I understand. Have you been experiencing chills, headache or dizziness as well?",
            6
        ),
        (
            2, 1,
            "Yes, I have a headache and occasional chills. I don't feel like eating anything.",
            8
        ),
        (
            1, 2,
            "How long have you been experiencing these symptoms?",
            10
        ),
        (
            2, 1,
            "Since last night. I thought it would get better, but I am feeling more tired today.",
            12
        ),
        (
            1, 2,
            "Your monitoring device also recorded an elevated heart rate of 108 BPM and a temperature of 38.5°C. Please arrange a clinical assessment today.",
            14
        ),
        (
            2, 1,
            "Okay doctor. Should I continue wearing the monitoring device?",
            16
        ),
        (
            1, 2,
            "Yes, please keep wearing it if comfortable. It will help us monitor your vital readings. Stay hydrated and take adequate rest.",
            18
        ),
        (
            2, 1,
            "Okay doctor. Thank you for checking on me.",
            20
        ),
        (
            1, 2,
            "You're welcome, Rahul. If you experience breathing difficulty, confusion or severe weakness, seek urgent medical attention.",
            22
        ),
    ]

    for sender_id, receiver_id, text, offset in conversation:
        ts = base_time + timedelta(minutes=offset)
        c.execute(
            """INSERT INTO messages (sender_id, receiver_id, message, timestamp, is_read)
               VALUES (%s, %s, %s, %s, %s)""",
            (sender_id, receiver_id, text, ts, True)
        )

    conn.commit()
    print(f"Successfully inserted {len(conversation)} test case messages!")
    conn.close()

if __name__ == "__main__":
    seed_chat()

