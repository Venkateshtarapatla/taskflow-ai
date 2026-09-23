import os
from pathlib import Path

import pytest


# ============================================================
# TEST DATABASE CONFIGURATION
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DATABASE_PATH = BACKEND_DIR / "test_taskflow.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE_PATH}"


# Import database components only after DATABASE_URL is configured.
from app.db.database import Base, engine  # noqa: E402


# ============================================================
# DATABASE RESET
# ============================================================

@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    yield