import hmac

import bcrypt


def hash_password(password: str) -> str:
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise ValueError("Password must be at most 72 UTF-8 bytes")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, stored_password: str) -> bool:
    if stored_password.startswith("$2"):
        try:
            return bcrypt.checkpw(
                password.encode("utf-8"),
                stored_password.encode("ascii"),
            )
        except ValueError:
            return False
    return hmac.compare_digest(password, stored_password)


def is_legacy_password(stored_password: str) -> bool:
    return not stored_password.startswith("$2")
