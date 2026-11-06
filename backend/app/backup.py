"""Dump the database to a file before an import or deployment.

Supabase also keeps its own daily backups (Pro plan); this dump is the one you control and can restore anywhere:
    pg_restore --clean --no-owner -d "$DATABASE_URL" data/backups/hub-<stamp>.dump
Needs `pg_dump` from the PostgreSQL client tools, at least the server's major version (Supabase runs 17).
"""

import argparse
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from app import config
from app.db import _TABLES


def create_backup(database_url: str, destination_dir: Path) -> Path:
    pg_dump = shutil.which("pg_dump")
    if not pg_dump:
        raise FileNotFoundError("pg_dump not found. Install the PostgreSQL 17 client tools, or pass --no-backup.")
    destination_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = destination_dir / f"hub-{stamp}.dump"
    # Only this app's tables, so the dump doesn't depend on whatever else lives in the database.
    tables = [arg for name in [*_TABLES, "schema_meta"] for arg in ("--table", name)]
    subprocess.run([pg_dump, "--format=custom", "--no-owner", "--file", str(destination), *tables, database_url],
                   check=True)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--destination", type=Path, default=config.BACKEND_DIR / "data" / "backups")
    args = parser.parse_args()
    print(create_backup(config.DATABASE_URL, args.destination))


if __name__ == "__main__":
    main()
