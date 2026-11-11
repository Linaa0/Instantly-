import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
from cryptography.fernet import Fernet
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"


def get_fernet() -> Fernet:
    key_str = settings.TOKEN_ENCRYPTION_KEY or settings.ENCRYPTION_KEY
    raw = key_str.encode("utf-8")
    try:
        return Fernet(raw)
    except Exception:
        derived = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
        return Fernet(derived)


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        return ""
    f = get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    f = get_fernet()
    return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

