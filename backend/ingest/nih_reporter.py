"""Import Temple awards from NIH RePORTER.

    uv run python -m ingest.nih_reporter                 # fetch FY2022-2026 and load
    uv run python -m ingest.nih_reporter --offline       # reload from the cached raw JSON
    uv run python -m ingest.nih_reporter --years 2024-2026

Every imported record is a 'public-award-record': funding history, not proof that a
study is active or recruiting.
"""

import argparse
import json
import re
import sqlite3
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app import config
from app.colleges import college_for
from app.db import connect, init_schema

API_URL = "https://api.reporter.nih.gov/v2/projects/search"
ORG_NAME = "TEMPLE UNIV OF THE COMMONWEALTH"
PAGE_SIZE = 500
SOURCE = "nih-reporter"
SOURCE_LABEL = "NIH RePORTER"
VERIFICATION = "public-award-record"
RAW_DIR = config.BACKEND_DIR / "data" / "raw"

AGENCY_LABELS = {"ALLCDC": "CDC"}
EMPTY_DEPARTMENTS = {"NONE", "MISCELLANEOUS"}
SMALL_WORDS = {"of", "and", "the", "for", "in", "on", "to", "a"}
HEADER = re.compile(
    r"^(\d+\.\s*)?(project\s+)?(summary|abstract|narrative|description|public health relevance)\b[^.]{0,40}$",
    re.IGNORECASE,
)


# ---------- fetch ----------

def fetch(fiscal_years: list[int]) -> list[dict]:
    records: list[dict] = []
    offset = 0
    with httpx.Client(timeout=60) as client:
        while True:
            body = {
                "criteria": {"org_names": [ORG_NAME], "fiscal_years": fiscal_years},
                "offset": offset,
                "limit": PAGE_SIZE,
            }
            data = _post_with_retry(client, body)
            records += data["results"]
            offset += PAGE_SIZE
            if offset >= data["meta"]["total"]:
                return records
            time.sleep(1)  # RePORTER asks for at most one request per second


def _post_with_retry(client: httpx.Client, body: dict, attempts: int = 3) -> dict:
    for attempt in range(attempts):
        try:
            res = client.post(API_URL, json=body)
            res.raise_for_status()
            return res.json()
        except httpx.HTTPError:
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** (attempt + 1))
    raise AssertionError("unreachable")


# ---------- normalize ----------

def title_case(text: str, small_words: bool = True) -> str:
    words = text.lower().split()
    out = []
    for i, word in enumerate(words):
        if small_words and i > 0 and word in SMALL_WORDS:
            out.append(word)
            continue
        word = word.title()
        if word.startswith("Mc") and len(word) > 2:
            word = "Mc" + word[2:].capitalize()
        out.append(word)
    return " ".join(out)


def person_name(pi: dict) -> str:
    parts = [pi.get("first_name"), pi.get("middle_name"), pi.get("last_name")]
    return title_case(" ".join(p for p in parts if p and p.strip()), small_words=False)


def department_of(record: dict) -> str | None:
    dept = (record.get("organization") or {}).get("dept_type")
    return None if not dept or dept in EMPTY_DEPARTMENTS else dept


def org_type_of(record: dict) -> str | None:
    return (record.get("organization_type") or {}).get("name")


def paragraphs(text: str | None) -> list[str]:
    """Undo NIH's hard line wrapping and drop a leading 'PROJECT SUMMARY'-style header."""
    if not text:
        return []
    lines = [line.strip() for line in text.replace("\r", "").split("\n")]
    while lines and (not lines[0] or HEADER.match(lines[0])):
        lines.pop(0)
    if not lines:
        return []

    wrap_width = max(len(line) for line in lines)
    paras: list[list[str]] = [[]]
    for line in lines:
        if not line:
            paras.append([])
            continue
        paras[-1].append(line)
        # A short line ending a sentence marks the end of a paragraph.
        if line[-1] in ".!?:" and len(line) < 0.7 * wrap_width:
            paras.append([])
    return [re.sub(r"\s+", " ", " ".join(p)) for p in paras if p]


def summary_of(record: dict, abstract: list[str], max_len: int = 320) -> str:
    source = " ".join(paragraphs(record.get("phr_text"))) or " ".join(abstract)
    if not source:
        return record.get("project_title") or ""
    sentences = re.split(r"(?<=[.!?])\s+", source)
    out = ""
    for sentence in sentences:
        if out and len(out) + len(sentence) > max_len:
            break
        out = f"{out} {sentence}".strip()
    return out if len(out) <= max_len else out[: max_len - 1].rsplit(" ", 1)[0] + "…"


def project_id_of(record: dict) -> str:
    pid = f"nih-{record['core_project_num']}"
    return f"{pid}-{record['subproject_id']}" if record.get("subproject_id") else pid


def researcher_id_of(pi: dict) -> str:
    return f"r-nih-{pi['profile_id']}"


def _year(date: str | None, fallback: int) -> int:
    return int(date[:4]) if date else fallback


def normalize(records: list[dict]) -> dict:
    """Turn raw RePORTER records into rows for each table. Pure: no I/O."""
    # RePORTER occasionally returns the same application twice across pages.
    unique = {(project_id_of(r), r["appl_id"]): r for r in records}
    by_project: dict[str, list[dict]] = defaultdict(list)
    for (pid, _), record in unique.items():
        by_project[pid].append(record)

    projects, award_years, team, colleges, project_areas = [], [], [], [], []
    areas: dict[str, dict] = {}
    researchers: dict[str, dict] = {}
    pi_colleges: dict[str, Counter] = defaultdict(Counter)
    unmapped: list[tuple[str, list[str]]] = []  # (project_id, researcher_ids) awaiting a college

    for pid, recs in by_project.items():
        recs.sort(key=lambda r: (r["fiscal_year"], r["appl_id"]))
        latest = recs[-1]
        abstract = paragraphs(latest.get("abstract_text"))
        agency = AGENCY_LABELS.get(latest.get("agency_code"), latest.get("agency_code") or "NIH")
        activity = latest.get("activity_code")
        admin = latest.get("agency_ic_admin") or {}
        dept = department_of(latest)

        projects.append({
            "id": pid,
            "award_number": latest["core_project_num"],
            "title": latest.get("project_title") or "",
            "summary": summary_of(latest, abstract),
            "abstract": "\n\n".join(abstract),
            "terms": "; ".join(t for t in (latest.get("pref_terms") or "").split(";") if t),
            "agency": agency,
            "activity_code": activity,
            "funder": f"{agency} {activity}" if activity else agency,
            "admin_ic": admin.get("abbreviation"),
            "admin_ic_name": admin.get("name"),
            "department": title_case(dept) if dept else None,
            "start_date": (latest.get("project_start_date") or "")[:10] or None,
            "end_date": (latest.get("project_end_date") or "")[:10] or None,
            "start_year": _year(latest.get("project_start_date"), recs[0]["fiscal_year"]),
            "end_year": _year(latest.get("project_end_date"), latest["fiscal_year"]),
            "latest_fy": latest["fiscal_year"],
            "latest_amount": latest.get("award_amount"),
            "is_active": int(bool(latest.get("is_active"))),
            "source": SOURCE,
            "source_label": SOURCE_LABEL,
            "source_url": latest.get("project_detail_url") or f"https://reporter.nih.gov/project-details/{latest['appl_id']}",
            "verification": VERIFICATION,
            "updated_at": (latest.get("date_added") or "")[:10] or datetime.now(timezone.utc).date().isoformat(),
        })

        for r in recs:
            award_years.append({
                "project_id": pid,
                "fiscal_year": r["fiscal_year"],
                "appl_id": r["appl_id"],
                "award_amount": r.get("award_amount"),
                "admin_ic": (r.get("agency_ic_admin") or {}).get("abbreviation"),
            })

        # Areas: every institute that administered or funded the award.
        ics = {(admin.get("abbreviation"), admin.get("name"))}
        for r in recs:
            ics |= {(f.get("abbreviation"), f.get("name")) for f in r.get("agency_ic_fundings") or []}
        for abbr, name in sorted(i for i in ics if i[0] and i[1]):
            area_id = abbr.lower()
            areas.setdefault(area_id, {
                "id": area_id,
                "name": name,
                "abbreviation": abbr,
                "definition": f"Awards administered or funded by the {name} ({abbr}).",
            })
            project_areas.append({"project_id": pid, "area_id": area_id})

        college = college_for(org_type_of(latest), dept)
        pis = sorted(latest.get("principal_investigators") or [], key=lambda p: not p.get("is_contact_pi"))
        rids = []
        for position, pi in enumerate(pis):
            rid = researcher_id_of(pi)
            rids.append(rid)
            team.append({
                "project_id": pid,
                "position": position,
                "researcher_id": rid,
                "name": person_name(pi),
                "role": "Contact PI" if pi.get("is_contact_pi") else "Co-PI",
            })
            # Latest award wins for the researcher's department.
            prev = researchers.get(rid)
            if prev is None or latest["fiscal_year"] >= prev["_fy"]:
                researchers[rid] = {
                    "id": rid,
                    "nih_profile_id": pi["profile_id"],
                    "name": person_name(pi),
                    "department": title_case(dept) if dept else (prev or {}).get("department"),
                    "college": None,
                    "verified": 0,
                    "source": SOURCE,
                    "verification": VERIFICATION,
                    "updated_at": projects[-1]["updated_at"],
                    "_fy": latest["fiscal_year"],
                }
            if college:
                pi_colleges[rid][college] += 1

        if college:
            colleges.append({"project_id": pid, "college": college})
        else:
            unmapped.append((pid, rids))

    # Awards with no department take the most common college of their PIs' other awards.
    still_unmapped = []
    for pid, rids in unmapped:
        votes = sum((pi_colleges[r] for r in rids), Counter())
        if votes:
            colleges.append({"project_id": pid, "college": votes.most_common(1)[0][0]})
        else:
            still_unmapped.append(pid)

    for rid, row in researchers.items():
        row.pop("_fy")
        if pi_colleges[rid]:
            row["college"] = pi_colleges[rid].most_common(1)[0][0]

    return {
        "projects": projects,
        "award_years": award_years,
        "project_colleges": colleges,
        "researchers": list(researchers.values()),
        "project_team": team,
        "research_areas": list(areas.values()),
        "project_areas": project_areas,
        "unmapped_project_ids": still_unmapped,
    }


# ---------- load ----------

def _insert(conn: sqlite3.Connection, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    cols = list(rows[0])
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})"
    conn.executemany(sql, [tuple(r[c] for c in cols) for r in rows])


def load(conn: sqlite3.Connection, data: dict) -> None:
    """Replace all NIH rows in one transaction, so a rerun gives the same result."""
    with conn:
        conn.execute("DELETE FROM projects WHERE source = ?", (SOURCE,))  # cascades to child tables
        conn.execute("DELETE FROM researchers WHERE source = ?", (SOURCE,))
        conn.execute("DELETE FROM research_areas")
        conn.execute("DELETE FROM projects_fts")
        for table in ("projects", "award_years", "project_colleges", "researchers", "project_team",
                      "research_areas", "project_areas"):
            _insert(conn, table, data[table])

        people: dict[str, list[str]] = defaultdict(list)
        for member in data["project_team"]:
            people[member["project_id"]].append(member["name"])
        conn.executemany(
            "INSERT INTO projects_fts (project_id, title, abstract, terms, people) VALUES (?, ?, ?, ?, ?)",
            [(p["id"], p["title"], p["abstract"], p["terms"], ", ".join(people[p["id"]])) for p in data["projects"]],
        )


# ---------- CLI ----------

def parse_years(spec: str) -> list[int]:
    if "-" in spec:
        start, end = (int(x) for x in spec.split("-"))
        return list(range(start, end + 1))
    return [int(x) for x in spec.split(",")]


def report(conn: sqlite3.Connection, data: dict) -> str:
    count = lambda sql: conn.execute(sql).fetchone()[0]
    by_college = conn.execute(
        "SELECT college, COUNT(*) FROM project_colleges GROUP BY college ORDER BY 2 DESC").fetchall()
    lines = [
        f"projects:       {count('SELECT COUNT(*) FROM projects')}",
        f"  active:       {count('SELECT COUNT(*) FROM projects WHERE is_active = 1')}",
        f"award years:    {count('SELECT COUNT(*) FROM award_years')}",
        f"researchers:    {count('SELECT COUNT(*) FROM researchers')}",
        f"research areas: {count('SELECT COUNT(*) FROM research_areas')}",
        f"no abstract:    {count('SELECT COUNT(*) FROM projects WHERE length(abstract) = 0')}",
        f"no college:     {len(data['unmapped_project_ids'])}",
        "by college:     " + ", ".join(f"{c} {n}" for c, n in by_college),
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", default="2022-2026", help="fiscal years, e.g. 2022-2026 or 2024,2025")
    parser.add_argument("--offline", action="store_true", help="load from the cached raw JSON instead of the API")
    args = parser.parse_args()

    years = parse_years(args.years)
    raw_path = RAW_DIR / f"nih_reporter_FY{years[0]}-{years[-1]}.json"
    conn = connect(config.DB_PATH)
    init_schema(conn)
    started = datetime.now(timezone.utc).isoformat(timespec="seconds")
    run_id = conn.execute(
        "INSERT INTO ingest_runs (source, started_at, fiscal_years) VALUES (?, ?, ?)",
        (SOURCE, started, args.years),
    ).lastrowid
    conn.commit()

    try:
        if args.offline:
            records = json.loads(raw_path.read_text())
        else:
            records = fetch(years)
            RAW_DIR.mkdir(parents=True, exist_ok=True)
            raw_path.write_text(json.dumps(records))
        data = normalize(records)
        load(conn, data)
    except Exception as exc:
        with conn:
            conn.execute("UPDATE ingest_runs SET finished_at = ?, error = ? WHERE id = ?",
                         (datetime.now(timezone.utc).isoformat(timespec="seconds"), repr(exc), run_id))
        raise

    with conn:
        conn.execute(
            "UPDATE ingest_runs SET finished_at = ?, records_fetched = ?, projects_loaded = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(timespec="seconds"), len(records), len(data["projects"]), run_id),
        )
    print(f"fetched {len(records)} records from {'cache' if args.offline else 'NIH RePORTER'}")
    print(report(conn, data))


if __name__ == "__main__":
    main()
