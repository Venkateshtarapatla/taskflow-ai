import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.user import User

# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

# Load backend/.env
BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


# ============================================================
# JWT CONFIGURATION
# ============================================================

SECRET_KEY = os.getenv("SECRET_KEY")

ALGORITHM = os.getenv(
    "JWT_ALGORITHM",
    "HS256",
)

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "60",
    )
)


if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is not configured. "
        "Please add SECRET_KEY to backend/.env"
    )


# ============================================================
# PASSWORD HASHING
# ============================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    """Hash a plain-text password."""

    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """Verify a plain-text password against its hash."""

    return pwd_context.verify(
        plain_password,
        hashed_password,
    )


# ============================================================
# JWT TOKEN CREATION
# ============================================================


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token."""

    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(
            UTC
        ) + expires_delta
    else:
        expire = datetime.now(
            UTC
        ) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update(
        {
            "exp": expire,
        }
    )

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    return encoded_jwt


# ============================================================
# JWT TOKEN VERIFICATION
# ============================================================


def decode_access_token(
    token: str,
) -> dict | None:
    """Decode and validate a JWT access token."""

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        return payload

    except JWTError:
        return None


# ============================================================
# HTTP BEARER AUTHENTICATION
# ============================================================

security = HTTPBearer()


# ============================================================
# USER AUTHENTICATION
# ============================================================


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User | None:
    """Authenticate a user using email and password."""

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user is None:
        return None

    if not verify_password(
        password,
        user.hashed_password,
    ):
        return None

    return user


# ============================================================
# CURRENT USER
# ============================================================


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """Get the currently authenticated user from JWT."""

    token = credentials.credentials

    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    try:
        user_id = int(user_id)
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        ) from error

    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.id == user_id)
            .first()
        )

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={
                    "WWW-Authenticate": "Bearer",
                },
            )

        return user

    finally:
        db.close()