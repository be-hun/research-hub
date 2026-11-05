import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Read KEY=value lines from backend/.env. Real environment variables win."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(BACKEND_DIR / ".env")

# Postgres connection string. Production: Supabase's session pooler URI (Project > Connect), with sslmode=require.
DATABASE_URL = os.environ.get("DATABASE_URL", "")
# Connections each API process keeps for requests. Keep the total across processes under the pooler's limit.
DB_POOL_SIZE = int(os.environ.get("DB_POOL_SIZE", "5"))

CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
# Any localhost port in development, since Next.js moves to 3001, 3002... when 3000 is taken.
CORS_ORIGIN_REGEX = os.environ.get("CORS_ORIGIN_REGEX", r"http://localhost:\d+")
