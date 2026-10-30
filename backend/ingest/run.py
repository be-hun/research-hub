"""Import Temple awards from every source into the database.

    uv run python -m ingest.run                    # fetch NIH and NSF, then load
    uv run python -m ingest.run --offline          # reload from the cached raw JSON, no API calls
    uv run python -m ingest.run --years 2024-2026  # NIH fiscal years; NSF awards running since the first year

Every imported record is a 'public-award-record': funding history, not proof that a
study is active or recruiting.
"""

import argparse
import json
import sqlite3
from datetime import datetime, timezone

from app import config
from app.db import connect, init_schema
from ingest import nih_reporter, nsf_awards
from ingest.load import load, merge

RAW_DIR = config.BACKEND_DIR / "data" / "raw"


def parse_years(spec: str) -> list[int]:
    if "-" in spec:
        start, end = (int(x) for x in spec.split("-"))
        return list(range(start, end + 1))
    return [int(x) for x in spec.split(",")]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _cached(path, fetch, offline: bool) -> list[dict]:
    if offline:
        return json.loads(path.read_text())
    records = fetch()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(records))
    return records


def report(conn: sqlite3.Connection, data: dict) -> str:
    count = lambda sql: conn.execute(sql).fetchone()[0]
    by_source = conn.execute("SELECT source, COUNT(*) FROM projects GROUP BY source").fetchall()
    by_college = conn.execute(
        "SELECT college, COUNT(*) FROM project_colleges GROUP BY college ORDER BY 2 DESC").fetchall()
    shared = count("""SELECT COUNT(*) FROM (SELECT t.researcher_id FROM project_team t JOIN projects p ON p.id = t.project_id
                      GROUP BY t.researcher_id HAVING COUNT(DISTINCT p.source) > 1)""")
    return "\n".join([
        f"projects:       {count('SELECT COUNT(*) FROM projects')} ({', '.join(f'{s} {n}' for s, n in by_source)})",
        f"  active:       {count('SELECT COUNT(*) FROM projects WHERE is_active = 1')}",
        f"award years:    {count('SELECT COUNT(*) FROM award_years')}",
        f"researchers:    {count('SELECT COUNT(*) FROM researchers')} ({shared} with awards from both NIH and NSF)",
        f"research areas: {count('SELECT COUNT(*) FROM research_areas')}",
        f"no abstract:    {count('SELECT COUNT(*) FROM projects WHERE length(abstract) = 0')}",
        f"no college:     {len(data['unmapped_project_ids'])}",
        "by college:     " + ", ".join(f"{c} {n}" for c, n in by_college),
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", default="2022-2026", help="NIH fiscal years, e.g. 2022-2026 or 2024,2025")
    parser.add_argument("--offline", action="store_true", help="load from the cached raw JSON instead of the APIs")
    args = parser.parse_args()

    years = parse_years(args.years)
    conn = connect(config.DB_PATH)
    init_schema(conn)
    run_id = conn.execute(
        "INSERT INTO ingest_runs (source, started_at, fiscal_years) VALUES (?, ?, ?)",
        ("nih-reporter,nsf-awards", _now(), args.years),
    ).lastrowid
    conn.commit()

    try:
        nih = _cached(RAW_DIR / f"nih_reporter_FY{years[0]}-{years[-1]}.json",
                      lambda: nih_reporter.fetch(years), args.offline)
        nsf = _cached(RAW_DIR / f"nsf_awards_from{years[0]}.json",
                      lambda: nsf_awards.fetch(years[0]), args.offline)
        data = merge([nih_reporter.normalize(nih), nsf_awards.normalize(nsf)])
        load(conn, data)
    except Exception as exc:
        with conn:
            conn.execute("UPDATE ingest_runs SET finished_at = ?, error = ? WHERE id = ?", (_now(), repr(exc), run_id))
        raise

    with conn:
        conn.execute(
            "UPDATE ingest_runs SET finished_at = ?, records_fetched = ?, projects_loaded = ? WHERE id = ?",
            (_now(), len(nih) + len(nsf), len(data["projects"]), run_id),
        )
    where = "cache" if args.offline else "the APIs"
    print(f"read {len(nih)} NIH and {len(nsf)} NSF records from {where}")
    print(report(conn, data))


if __name__ == "__main__":
    main()
