"""Create a consistent SQLite backup before an import or deployment."""

import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app import config
from app.db import connect


def create_backup(source: Path, destination_dir: Path) -> Path:
    if not source.exists():
        raise FileNotFoundError(source)
    destination_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = destination_dir / f"{source.stem}-{stamp}.sqlite3"
    source_conn = connect(source)
    destination_conn = sqlite3.connect(destination)
    try:
        source_conn.backup(destination_conn)
        result = destination_conn.execute("PRAGMA integrity_check").fetchone()[0]
        if result != "ok":
            raise sqlite3.DatabaseError(f"backup integrity check failed: {result}")
        destination_conn.commit()
    finally:
        destination_conn.close()
        source_conn.close()
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=config.DB_PATH)
    parser.add_argument("--destination", type=Path, default=config.BACKEND_DIR / "data" / "backups")
    args = parser.parse_args()
    print(create_backup(args.source, args.destination))


if __name__ == "__main__":
    main()
