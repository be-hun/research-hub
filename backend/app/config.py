import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent

DB_PATH = Path(os.environ.get("HUB_DB", BACKEND_DIR / "data" / "hub.db"))
if not DB_PATH.is_absolute():
    DB_PATH = BACKEND_DIR / DB_PATH

CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
