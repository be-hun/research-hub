"""Read queries. Every value returned comes from a stored record; nothing is generated."""

import re
import sqlite3
from collections import Counter
from datetime import date

from app import models
from app.colleges import COLLEGE_NAMES
from app.topics import AREA_TO_TOPIC, BY_ID as TOPICS_BY_ID

PAGE_SIZE = 10
# NIH center grants are stored as a parent award plus component sub-projects whose money is part of
# the parent's. Lists, counts and totals use parents only so nothing is counted twice.
PARENT_ONLY = "(p.source != 'nih-reporter' OR p.id = 'nih-' || p.award_number)"
STATUS_LABELS = {"active": "Active", "ended": "Ended"}
STUDENT_NOTICE = (
    "This is a public award record: funding history, not a confirmed study. "
    "Contact the investigator to ask whether students are involved."
)
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "into", "is", "it", "of",
    "on", "or", "research", "study", "studies", "that", "the", "to", "using", "what", "who", "with", "about",
    "projects", "project", "temple",
}
FIELD_LABELS = {"title": "title", "abstract": "abstract", "terms": "subject terms", "people": "investigators"}


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
        agency=row["agency"],
        active=bool(row["is_active"]),
        amount=row["latest_amount"] or None,
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
    """Active awards, largest first, one per college and spread across sources so the home page shows breadth."""
    rows = conn.execute("""
        SELECT p.*, c.college FROM projects p JOIN project_colleges c ON c.project_id = p.id
        WHERE p.is_active = 1 AND length(p.abstract) > 0 AND {PARENT_ONLY}
        ORDER BY p.latest_amount DESC
    """.format(PARENT_ONLY=PARENT_ONLY)).fetchall()
    picked, colleges, sources = [], set(), set()
    for new_source_only in (True, False):
        for r in rows:
            if len(picked) == limit:
                break
            if r["college"] in colleges or (new_source_only and r["source"] in sources):
                continue
            picked.append(r)
            colleges.add(r["college"])
            sources.add(r["source"])
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
    by_year = conn.execute("""
        SELECT fiscal_year, SUM(award_amount) AS amount FROM award_years
        WHERE project_id = ? AND award_amount IS NOT NULL GROUP BY fiscal_year ORDER BY fiscal_year
    """, (project_id,)).fetchall()
    topic_ids = sorted({AREA_TO_TOPIC[r["area_id"]] for r in conn.execute(
        "SELECT area_id FROM project_areas WHERE project_id = ?", (project_id,)) if r["area_id"] in AREA_TO_TOPIC})
    return models.ProjectDetail(
        **base.model_dump(),
        abstract=[p for p in row["abstract"].split("\n\n") if p] or [row["summary"]],
        methodologies=[],
        fundingByYear=[models.YearAmount(fiscalYear=r["fiscal_year"], amount=r["amount"]) for r in by_year],
        topics=[models.TopicRef(id=t, name=TOPICS_BY_ID[t].name) for t in topic_ids],
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
        WHERE t1.project_id = ? AND {PARENT_ONLY} ORDER BY p.latest_fy DESC LIMIT ?
    """.format(PARENT_ONLY=PARENT_ONLY), (row["id"], limit))]
    if len(same_pi) < limit:
        tokens = _tokens(row["title"])
        if tokens:
            for r in conn.execute(f"""
                SELECT f.project_id FROM projects_fts f JOIN projects p ON p.id = f.project_id
                WHERE projects_fts MATCH ? AND {PARENT_ONLY}
                ORDER BY bm25(projects_fts, 0, 10, 3, 1, 2) LIMIT 10
            """, (_fts_query(tokens),)):
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
        SELECT p.id, p.title, p.latest_fy, p.start_year, p.agency, p.source_label, t.role
        FROM project_team t JOIN projects p ON p.id = t.project_id
        WHERE t.researcher_id = ? ORDER BY p.latest_fy DESC, p.start_year DESC
    """, (researcher_id,)).fetchall()
    ids = [p["id"] for p in projects]
    n = len(ids)
    first_year = min((p["start_year"] for p in projects), default=None)
    agencies = Counter(p["agency"] for p in projects)
    funded_by = (f"{next(iter(agencies))}-funded" if len(agencies) == 1
                 else "federally funded")
    breakdown = f" ({', '.join(f'{c} {a}' for a, c in agencies.most_common())})" if len(agencies) > 1 else ""
    summary = (
        f"Investigator on {n} {funded_by} award{'s' if n != 1 else ''}{breakdown} at Temple"
        + (f" since {first_year}" if first_year else "")
        + (f", most recently “{projects[0]['title']}”." if projects else ".")
    )
    sources = " and ".join(sorted({p["source_label"] for p in projects})) or "public award"
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
        about=f"This profile is built from public {sources} records and has not been confirmed by the researcher.",
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
        evidence=[f"{row['source_label']} {label}" for label in fields],
    )


def _marks(values: list) -> str:
    return ",".join("?" * len(values))


def _filters(colleges, funders, verification, status, topics) -> dict[str, tuple[str, list]]:
    """One SQL condition per filter dimension, so facet counts can leave their own dimension out."""
    out: dict[str, tuple[str, list]] = {}
    if colleges:
        out["college"] = (f"p.id IN (SELECT project_id FROM project_colleges WHERE college IN ({_marks(colleges)}))",
                          list(colleges))
    if funders:
        out["funder"] = (f"(p.agency IN ({_marks(funders)}) OR p.funder IN ({_marks(funders)}))",
                         list(funders) + list(funders))
    if verification:
        out["verification"] = (f"p.verification IN ({_marks(verification)})", list(verification))
    flags = [1 if s == "active" else 0 for s in status or [] if s in STATUS_LABELS]
    if flags:
        out["status"] = (f"p.is_active IN ({_marks(flags)})", flags)
    if topics:
        areas = [a for t in topics if t in TOPICS_BY_ID for a in TOPICS_BY_ID[t].areas]
        out["topic"] = ((f"p.id IN (SELECT project_id FROM project_areas WHERE area_id IN ({_marks(areas)}))", areas)
                        if areas else ("0", []))
    return out


def _base(tokens: list[str], filters: dict[str, tuple[str, list]], skip: str | None = None) -> tuple[str, list]:
    if tokens:
        sql, params = "FROM projects_fts f JOIN projects p ON p.id = f.project_id WHERE projects_fts MATCH ?", [_fts_query(tokens)]
    else:
        sql, params = "FROM projects p WHERE 1", []
    sql += f" AND {PARENT_ONLY}"
    for dim, (cond, values) in filters.items():
        if dim != skip:
            sql += f" AND {cond}"
            params += values
    return sql, params


def _facets(conn: sqlite3.Connection, tokens: list[str], filters: dict) -> models.Facets:
    def ids_sql(skip: str) -> tuple[str, list]:
        base, params = _base(tokens, filters, skip)
        return f"SELECT p.id {base}", params

    sql, params = ids_sql("college")
    colleges = conn.execute(
        f"SELECT college, COUNT(*) n FROM project_colleges WHERE project_id IN ({sql}) GROUP BY college ORDER BY n DESC",
        params).fetchall()
    base, params = _base(tokens, filters, "funder")
    funders = conn.execute(f"SELECT p.agency, COUNT(*) n {base} GROUP BY p.agency ORDER BY n DESC", params).fetchall()
    base, params = _base(tokens, filters, "status")
    status = conn.execute(f"SELECT p.is_active, COUNT(*) n {base} GROUP BY p.is_active ORDER BY p.is_active DESC",
                          params).fetchall()
    sql, params = ids_sql("topic")
    per_topic: Counter = Counter()
    project_topics: dict[str, set[str]] = {}
    for r in conn.execute(f"SELECT project_id, area_id FROM project_areas WHERE project_id IN ({sql})", params):
        if r["area_id"] in AREA_TO_TOPIC:
            project_topics.setdefault(r["project_id"], set()).add(AREA_TO_TOPIC[r["area_id"]])
    for topic_ids in project_topics.values():
        per_topic.update(topic_ids)

    return models.Facets(
        colleges=[models.FacetValue(value=r["college"], label=COLLEGE_NAMES.get(r["college"], r["college"]), count=r["n"])
                  for r in colleges],
        funders=[models.FacetValue(value=r["agency"], label=r["agency"], count=r["n"]) for r in funders],
        status=[models.FacetValue(value="active" if r["is_active"] else "ended",
                                  label="Active" if r["is_active"] else "Ended", count=r["n"]) for r in status],
        topics=[models.FacetValue(value=t, label=TOPICS_BY_ID[t].name, count=n) for t, n in per_topic.most_common()],
    )


def search(
    conn: sqlite3.Connection,
    q: str,
    page: int = 1,
    colleges: list[str] | None = None,
    funders: list[str] | None = None,
    verification: list[str] | None = None,
    status: list[str] | None = None,
    topics: list[str] | None = None,
) -> models.SearchResponse:
    tokens = _tokens(q)
    filters = _filters(colleges, funders, verification, status, topics)
    base, params = _base(tokens, filters)
    if tokens:
        order = "bm25(projects_fts, 0, 10, 3, 1, 2), p.is_active DESC"
        cols = "p.*, f.people"
    else:
        order = "p.is_active DESC, p.latest_fy DESC, p.latest_amount DESC"
        cols = "p.*, '' AS people"

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
        interpretedAs=f"Keywords: {', '.join(tokens)}" if tokens else "All awards",
        total=total,
        page=page,
        pageSize=PAGE_SIZE,
        results=results,
        facets=_facets(conn, tokens, filters),
    )
