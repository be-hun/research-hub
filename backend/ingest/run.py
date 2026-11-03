"""Import Temple awards from every source into the database.

    uv run python -m ingest.run                    # fetch every source, then load
    uv run python -m ingest.run --offline          # reload from the cached raw JSON, no API calls
    uv run python -m ingest.run --years 2024-2026  # NIH fiscal years; other sources start at the first year

Sources: NIH RePORTER and NSF Award Search (grants), USAspending.gov (other federal grants),
ClinicalTrials.gov (trials sponsored by or run at Temple) and OpenAlex (funded publications).
Award records are funding history, not proof that a study is active or recruiting.
"""

import argparse
import json
import sqlite3
from datetime import datetime, timezone

from app import config
from app.backup import create_backup
from app.db import connect, init_schema
from ingest import clinical_trials, nih_reporter, nsf_awards, openalex, usaspending
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
    by_kind = conn.execute("SELECT kind, COUNT(*), SUM(is_active) FROM projects GROUP BY kind").fetchall()
    by_type = conn.execute("""SELECT category, COUNT(DISTINCT project_id) FROM project_funders
                              GROUP BY category ORDER BY 2 DESC""").fetchall()
    confidence = dict(conn.execute("SELECT identity_confidence, COUNT(*) FROM researchers GROUP BY 1").fetchall())
    merged = count("SELECT COUNT(*) FROM researcher_aliases WHERE evidence = 'same-name-across-sources'")
    return "\n".join([
        f"records:        {count('SELECT COUNT(*) FROM projects')} ({', '.join(f'{s} {n}' for s, n in by_source)})",
        "  by kind:      " + ", ".join(f"{k} {n} ({a} active)" for k, n, a in by_kind),
        "  funding type: " + ", ".join(f"{c} {n}" for c, n in by_type),
        f"  with topic:   {count('SELECT COUNT(DISTINCT project_id) FROM project_topics')}",
        f"award years:    {count('SELECT COUNT(*) FROM award_years')}",
        f"researchers:    {count('SELECT COUNT(*) FROM researchers')} ({shared} found in more than one source)",
        "identity review:",
        f"  high:         {confidence.get('high', 0)} (one source person ID)",
        f"  medium:       {confidence.get('medium', 0)} (matched by name within one source)",
        f"  low:          {confidence.get('low', 0)} (combined across sources by name; {merged} merged identities)",
        f"research areas: {count('SELECT COUNT(*) FROM research_areas')}",
        f"no abstract:    {count('SELECT COUNT(*) FROM projects WHERE length(abstract) = 0')}",
        f"no college:     {len(data['unmapped_project_ids'])}",
        "by college:     " + ", ".join(f"{c} {n}" for c, n in by_college),
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", default="2022-2026", help="NIH fiscal years, e.g. 2022-2026 or 2024,2025")
    parser.add_argument("--offline", action="store_true", help="load from the cached raw JSON instead of the APIs")
    parser.add_argument("--no-backup", action="store_true", help="skip the pre-import SQLite backup")
    parser.add_argument("--publications-from", type=int, default=2024, help="first publication year (default 2024)")
    args = parser.parse_args()

    years = parse_years(args.years)
    if config.DB_PATH.exists() and not args.no_backup:
        print(f"backup: {create_backup(config.DB_PATH, config.BACKEND_DIR / 'data' / 'backups')}")
    conn = connect(config.DB_PATH)
    init_schema(conn)
    run_id = conn.execute(
        "INSERT INTO ingest_runs (source, started_at, fiscal_years) VALUES (?, ?, ?)",
        ("nih-reporter,nsf-awards,usaspending,clinicaltrials-gov,openalex", _now(), args.years),
    ).lastrowid
    conn.commit()

    try:
        nih = _cached(RAW_DIR / f"nih_reporter_FY{years[0]}-{years[-1]}.json",
                      lambda: nih_reporter.fetch(years), args.offline)
        nsf = _cached(RAW_DIR / f"nsf_awards_from{years[0]}.json",
                      lambda: nsf_awards.fetch(years[0]), args.offline)
        usa = _cached(RAW_DIR / f"usaspending_from{years[0]}.json",
                      lambda: usaspending.fetch(years[0]), args.offline)
        trials = _cached(RAW_DIR / "clinicaltrials_gov.json", clinical_trials.fetch, args.offline)
        pubs = _cached(RAW_DIR / f"openalex_from{args.publications_from}.json",
                       lambda: openalex.fetch(args.publications_from), args.offline)
        data = merge([
            nih_reporter.normalize(nih),
            nsf_awards.normalize(nsf),
            usaspending.normalize(usa, years[0]),
            clinical_trials.normalize(trials, years[0]),
            openalex.normalize(pubs),
        ])
        load(conn, data)
    except Exception as exc:
        with conn:
            conn.execute("UPDATE ingest_runs SET finished_at = ?, error = ? WHERE id = ?", (_now(), repr(exc), run_id))
        raise

    with conn:
        conn.execute(
            "UPDATE ingest_runs SET finished_at = ?, records_fetched = ?, projects_loaded = ? WHERE id = ?",
            (_now(), len(nih) + len(nsf) + len(usa) + len(trials) + len(pubs["works"]), len(data["projects"]), run_id),
        )
    where = "cache" if args.offline else "the APIs"
    print(f"read {len(nih)} NIH, {len(nsf)} NSF, {len(usa)} USAspending, {len(trials)} trial and "
          f"{len(pubs['works'])} publication records from {where}")
    print(report(conn, data))


if __name__ == "__main__":
    main()
