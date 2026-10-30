"""Read queries. Every value returned comes from a stored record; nothing is generated."""

import re
import sqlite3
from collections import Counter
from datetime import date

from app import models

PAGE_SIZE = 10
STUDENT_NOTICE = (
    "This is an NIH award record: funding history, not a confirmed study. "
    "Contact the investigator to ask whether students are involved."
)
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "into", "is", "it", "of",
    "on", "or", "research", "study", "studies", "that", "the", "to", "using", "what", "who", "with", "about",
    "projects", "project", "temple",
}
FIELD_LABELS = {"title": "title", "abstract": "abstract", "terms": "NIH terms", "people": "investigators"}


# ---------- shared ----------

def _colleges(conn: sqlite3.Connection, ids: list[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {i: [] for i in ids}
    if ids:
        rows = conn.execute(
            f"SELECT project_id, college FROM project_colleges WHERE project_id IN ({','.join('?' * len(ids))})", ids)
        for r in rows:
            out[r["project_id"]].append(r["college"])
    return out


def _contact_pi(conn: sqlite3.Connection, project_id: str) -> str:
    row = conn.execute(
        "SELECT name FROM project_team WHERE project_id = ? ORDER BY position LIMIT 1", (project_id,)).fetchone()
    return row["name"] if row else ""


def _project(conn: sqlite3.Connection, row: sqlite3.Row, colleges: list[str]) -> models.Project:
    return models.Project(
        id=row["id"],
        title=row["title"],
        summary=row["summary"],
        colleges=colleges,
        verification=row["verification"],
        pi=models.PI(name=_contact_pi(conn, row["id"]), department=row["department"] or "Temple University"),
        funder=row["funder"],
        startYear=row["start_year"],
        endYear=row["end_year"],
        source=models.Source(label=row["source_label"], url=row["source_url"]),
        updatedAt=row["updated_at"],
    )


def _projects(conn: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[models.Project]:
    colleges = _colleges(conn, [r["id"] for r in rows])
    return [_project(conn, r, colleges[r["id"]]) for r in rows]


def _month_year(iso: str | None) -> str:
    return date.fromisoformat(iso).strftime("%b %Y") if iso else "n/a"


def _initials(name: str) -> str:
    parts = name.split()
    return (parts[0][0] + parts[-1][0]).upper() if parts else ""


# ---------- projects ----------

def featured(conn: sqlite3.Connection, limit: int = 3) -> list[models.Project]:
    """Active parent awards, largest first, one per college so the home page spans colleges."""
    rows = conn.execute("""
        SELECT p.*, c.college FROM projects p JOIN project_colleges c ON c.project_id = p.id
        WHERE p.is_active = 1 AND p.id = 'nih-' || p.award_number AND length(p.abstract) > 0
        ORDER BY p.latest_amount DESC
    """).fetchall()
    picked, seen = [], set()
    for r in rows:
        if r["college"] not in seen:
            seen.add(r["college"])
            picked.append(r)
        if len(picked) == limit:
            break
    return _projects(conn, picked)


def projects_by_ids(conn: sqlite3.Connection, ids: list[str]) -> list[models.Project]:
    if not ids:
        return []
    rows = conn.execute(f"SELECT * FROM projects WHERE id IN ({','.join('?' * len(ids))})", ids).fetchall()
    by_id = {r["id"]: r for r in rows}
    return _projects(conn, [by_id[i] for i in ids if i in by_id])


def project_detail(conn: sqlite3.Connection, project_id: str) -> models.ProjectDetail | None:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        return None
    colleges = _colleges(conn, [project_id])[project_id]
    team = conn.execute("""
        SELECT t.researcher_id, t.name, t.role, r.department, r.college
        FROM project_team t LEFT JOIN researchers r ON r.id = t.researcher_id
        WHERE t.project_id = ? ORDER BY t.position
    """, (project_id,)).fetchall()
    amount = row["latest_amount"]
    base = _project(conn, row, colleges)
    return models.ProjectDetail(
        **base.model_dump(),
        abstract=[p for p in row["abstract"].split("\n\n") if p] or [row["summary"]],
        methodologies=[],
        funding=models.Funding(
            agency=f"{row['admin_ic_name']} ({row['agency']})" if row["admin_ic_name"] else row["agency"],
            mechanism=row["activity_code"] or "",
            period=f"{_month_year(row['start_date'])} – {_month_year(row['end_date'])}",
            total=f"${amount:,} in FY{row['latest_fy']}" if amount else "n/a",
            awardNumber=row["award_number"],
        ),
        team=[
            models.TeamMember(
                researcherId=t["researcher_id"],
                name=t["name"],
                role=t["role"],
                department=t["department"] or row["department"] or "",
                college=t["college"] or (colleges[0] if colleges else None),
            )
            for t in team
        ],
        students=models.Students(skills=[], notice=STUDENT_NOTICE),
        relatedProjectIds=related_ids(conn, row),
    )


def related_ids(conn: sqlite3.Connection, row: sqlite3.Row, limit: int = 3) -> list[str]:
    """Same investigators' other awards first, then awards with similar titles."""
    same_pi = [r["project_id"] for r in conn.execute("""
        SELECT DISTINCT t2.project_id FROM project_team t1
        JOIN project_team t2 ON t2.researcher_id = t1.researcher_id AND t2.project_id != t1.project_id
        JOIN projects p ON p.id = t2.project_id
        WHERE t1.project_id = ? ORDER BY p.latest_fy DESC LIMIT ?
    """, (row["id"], limit))]
    if len(same_pi) < limit:
        tokens = _tokens(row["title"])
        if tokens:
            for r in conn.execute(
                "SELECT project_id FROM projects_fts WHERE projects_fts MATCH ? ORDER BY bm25(projects_fts, 0, 10, 3, 1, 2) LIMIT 10",
                (_fts_query(tokens),),
            ):
                if r["project_id"] != row["id"] and r["project_id"] not in same_pi:
                    same_pi.append(r["project_id"])
                if len(same_pi) == limit:
                    break
    return same_pi


# ---------- researchers ----------

def _distinctive_terms(conn: sqlite3.Connection, project_ids: list[str], limit: int = 6) -> list[str]:
    """Terms frequent in these projects but rare across Temple (drops generic ones like 'Data')."""
    all_rows = conn.execute("SELECT id, terms FROM projects").fetchall()
    df = Counter()
    for r in all_rows:
        df.update({t.strip() for t in r["terms"].split(";") if t.strip()})
    total = len(all_rows) or 1
    mine = Counter()
    for r in all_rows:
        if r["id"] in project_ids:
            mine.update({t.strip() for t in r["terms"].split(";") if t.strip()})
    ranked = [t for t, n in mine.most_common() if df[t] / total < 0.05 and (n > 1 or len(project_ids) == 1)]
    return ranked[:limit]


def researcher(conn: sqlite3.Connection, researcher_id: str) -> models.ResearcherProfile | None:
    row = conn.execute("SELECT * FROM researchers WHERE id = ?", (researcher_id,)).fetchone()
    if not row:
        return None
    projects = conn.execute("""
        SELECT p.id, p.title, p.latest_fy, p.start_year, t.role FROM project_team t JOIN projects p ON p.id = t.project_id
        WHERE t.researcher_id = ? ORDER BY p.latest_fy DESC, p.start_year DESC
    """, (researcher_id,)).fetchall()
    ids = [p["id"] for p in projects]
    n = len(ids)
    first_year = min((p["start_year"] for p in projects), default=None)
    summary = (
        f"Investigator on {n} NIH-funded award{'s' if n != 1 else ''} at Temple"
        + (f" since {first_year}" if first_year else "")
        + (f", most recently “{projects[0]['title']}”." if projects else ".")
    )
    return models.ResearcherProfile(
        id=row["id"],
        name=row["name"],
        initials=_initials(row["name"]),
        title="Principal Investigator",
        college=row["college"],
        department=row["department"] or "",
        verified=bool(row["verified"]),
        summary=summary,
        focus=_distinctive_terms(conn, ids),
        about="This profile is built from public NIH RePORTER award records and has not been confirmed by the researcher.",
        projectIds=ids,
        publications=[],
    )


# ---------- search ----------

def _tokens(text: str) -> list[str]:
    seen: list[str] = []
    for t in re.findall(r"[a-z0-9]+", text.lower()):
        if len(t) > 1 and t not in STOPWORDS and t not in seen:
            seen.append(t)
    return seen[:12]


def _fts_query(tokens: list[str]) -> str:
    return " OR ".join(f'"{t}"' for t in tokens)


def _match(row: sqlite3.Row, tokens: list[str]) -> models.Match | None:
    """Explain a hit by which stored fields contain which query words."""
    hits: dict[str, list[str]] = {}
    for field in FIELD_LABELS:
        text = (row[field] or "").lower()
        found = [t for t in tokens if re.search(rf"\b{re.escape(t[:max(4, len(t) - 2)])}", text)]
        if found:
            hits[field] = found
    if not hits:
        return None
    words = sorted({t for found in hits.values() for t in found}, key=tokens.index)
    fields = [FIELD_LABELS[f] for f in hits]
    where = fields[0] if len(fields) == 1 else ", ".join(fields[:-1]) + " and " + fields[-1]
    return models.Match(
        reason=f"Matched {', '.join(f'“{w}”' for w in words)} in the {where}.",
        evidence=[f"NIH RePORTER {label}" for label in fields],
    )


def search(
    conn: sqlite3.Connection,
    q: str,
    page: int = 1,
    colleges: list[str] | None = None,
    funders: list[str] | None = None,
    verification: list[str] | None = None,
) -> models.SearchResponse:
    tokens = _tokens(q)
    where, params = [], []
    if colleges:
        where.append(f"p.id IN (SELECT project_id FROM project_colleges WHERE college IN ({','.join('?' * len(colleges))}))")
        params += colleges
    if funders:
        marks = ",".join("?" * len(funders))
        where.append(f"(p.agency IN ({marks}) OR p.funder IN ({marks}))")
        params += funders + funders
    if verification:
        where.append(f"p.verification IN ({','.join('?' * len(verification))})")
        params += verification

    if tokens:
        base = "FROM projects_fts f JOIN projects p ON p.id = f.project_id WHERE projects_fts MATCH ?"
        params = [_fts_query(tokens)] + params
        order = "bm25(projects_fts, 0, 10, 3, 1, 2), p.is_active DESC"
        cols = "p.*, f.people"
    else:
        base = "FROM projects p WHERE 1"
        order = "p.is_active DESC, p.latest_fy DESC, p.latest_amount DESC"
        cols = "p.*, '' AS people"
    if where:
        base += " AND " + " AND ".join(where)

    total = conn.execute(f"SELECT COUNT(*) {base}", params).fetchone()[0]
    page = max(page, 1)
    rows = conn.execute(
        f"SELECT {cols} {base} ORDER BY {order} LIMIT ? OFFSET ?", params + [PAGE_SIZE, (page - 1) * PAGE_SIZE]
    ).fetchall()

    results = _projects(conn, rows)
    for project, row in zip(results, rows):
        project.match = _match(row, tokens) if tokens else None

    return models.SearchResponse(
        query=q,
        interpretedAs=f"Keywords: {', '.join(tokens)}" if tokens else "All projects",
        total=total,
        page=page,
        pageSize=PAGE_SIZE,
        results=results,
    )
