import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# ============================================================
# DIRECTORY CONFIGURATION
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

configured_database_url = os.getenv("DATABASE_URL")

if configured_database_url:
    DATABASE_URL = configured_database_url
else:
    DATABASE_PATH = BACKEND_DIR / "taskflow.db"
    DATABASE_URL = f"sqlite:///{DATABASE_PATH}"


# ============================================================
# DATABASE ENGINE
# ============================================================

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        DATABASE_URL,
    )


# ============================================================
# SQLALCHEMY BASE
# ============================================================

Base = declarative_base()


# ============================================================
# DATABASE SESSION
# ============================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)