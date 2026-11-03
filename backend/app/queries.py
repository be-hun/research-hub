"""Read queries. Every value returned comes from a stored record; nothing is generated."""

import re
import sqlite3
from collections import Counter, defaultdict
from datetime import date

from app import models
from app.colleges import COLLEGE_NAMES
from app.topics import BY_ID as TOPICS_BY_ID
from ingest.funders import CATEGORIES as FUNDING_TYPES

PAGE_SIZE = 10
# NIH center grants are stored as a parent award plus component sub-projects whose money is part of
# the parent's. Lists, counts and totals use parents only so nothing is counted twice.
PARENT_ONLY = "(p.source != 'nih-reporter' OR p.id = 'nih-' || p.award_number)"
KIND_LABELS = {"award": "Grants", "trial": "Clinical trials", "publication": "Publications"}
STATUS_LABELS = {"active": "Active", "ended": "Ended"}
NOTICES = {
    "award": "Funding record, not proof the study is active.",
    "trial": "Status may lag; check with the study team.",
    "publication": "Funders as reported by the paper.",
}
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "into", "is", "it", "of",
    "on", "or", "research", "study", "studies", "that", "the", "to", "using", "what", "who", "with", "about",
    "projects", "project", "temple",
}
FIELD_LABELS = {"title": "title", "abstract": "abstract", "terms": "subject terms", "people": "investigators"}


def _marks(values: list) -> str:
    return ",".join("?" * len(values))


# ---------- shared ----------

def _by_project(conn: sqlite3.Connection, sql: str, ids: list[str]) -> dict[str, list[sqlite3.Row]]:
    out: dict[str, list[sqlite3.Row]] = defaultdict(list)
    if ids:
        for r in conn.execute(sql.format(marks=_marks(ids)), ids):
            out[r["project_id"]].append(r)
    return out


def _projects(conn: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[models.Project]:
    ids = [r["id"] for r in rows]
    colleges = _by_project(conn, "SELECT project_id, college FROM project_colleges WHERE project_id IN ({marks})", ids)
    funders = _by_project(conn, """SELECT project_id, category FROM project_funders
                                   WHERE project_id IN ({marks}) ORDER BY position""", ids)
    leads = _by_project(conn, """SELECT project_id, name FROM project_team
                                 WHERE project_id IN ({marks}) ORDER BY position""", ids)
    out = []
    for r in rows:
        types = list(dict.fromkeys(FUNDING_TYPES.get(f["category"], "Other") for f in funders[r["id"]]))
        lead = leads[r["id"]][0]["name"] if leads[r["id"]] else ""
        out.append(models.Project(
            id=r["id"],
            kind=r["kind"],
            title=r["title"],
            summary=r["summary"],
            colleges=[c["college"] for c in colleges[r["id"]]],
            verification=r["verification"],
            pi=models.PI(name=lead, department=r["department"] or ""),
            funder=r["funder"],
            agency=r["agency"],
            active=bool(r["is_active"]),
            statusLabel=r["status_label"],
            fundingTypes=types,
            amount=r["latest_amount"] or None,
            startYear=r["start_year"],
            endYear=r["end_year"],
            source=models.Source(label=r["source_label"], url=r["source_url"]),
            updatedAt=r["updated_at"] or "",
        ))
    return out


def _month_year(iso: str | None) -> str:
    if not iso:
        return "n/a"
    try:
        return date.fromisoformat(iso[:10]).strftime("%b %Y") if len(iso) >= 10 else iso
    except ValueError:
        return iso


def _initials(name: str) -> str:
    parts = name.split()
    return (parts[0][0] + parts[-1][0]).upper() if parts else ""


def topic_ids(conn: sqlite3.Connection, project_id: str) -> list[str]:
    return [r["topic_id"] for r in conn.execute(
        "SELECT topic_id FROM project_topics WHERE project_id = ? ORDER BY method, topic_id", (project_id,))]


# ---------- projects ----------

def featured(conn: sqlite3.Connection, limit: int = 3) -> list[models.Project]:
    """Active grants, largest first, one per college and spread across sources so the home page shows breadth."""
    rows = conn.execute(f"""
        SELECT p.*, c.college FROM projects p JOIN project_colleges c ON c.project_id = p.id
        WHERE p.kind = 'award' AND p.is_active = 1 AND length(p.abstract) > 0 AND {PARENT_ONLY}
        ORDER BY p.latest_amount DESC
    """).fetchall()
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
    rows = conn.execute(f"SELECT * FROM projects WHERE id IN ({_marks(ids)})", ids).fetchall()
    by_id = {r["id"]: r for r in rows}
    return _projects(conn, [by_id[i] for i in ids if i in by_id])


def _facts(row: sqlite3.Row, funders: list[sqlite3.Row]) -> list[models.Fact]:
    kind, amount = row["kind"], row["latest_amount"]
    link = models.Fact(label={"award": "Award number", "trial": "Registry ID", "publication": "DOI"}[kind],
                       value=row["award_number"], href=row["source_url"])
    if kind == "trial":
        return [
            models.Fact(label="Status", value=row["status_label"]),
            models.Fact(label="Lead sponsor", value=row["funder"] or "Not listed"),
            models.Fact(label="Study dates", value=f"{_month_year(row['start_date'])} – {_month_year(row['end_date'])}"),
            models.Fact(label="Phase / type", value=row["activity_code"] or "Not listed"),
            link,
        ]
    if kind == "publication":
        return [
            models.Fact(label="Published", value=_month_year(row["start_date"])),
            models.Fact(label="Journal", value=row["activity_code"] or "Not listed"),
            models.Fact(label="Funders", value=f"{len(funders)} reported"),
            models.Fact(label="Source", value=row["source_label"]),
            link,
        ]
    return [
        models.Fact(label="Status", value=row["status_label"]),
        models.Fact(label="Funder", value=f"{row['admin_ic_name']} ({row['agency']})" if row["admin_ic_name"]
                    else row["agency"]),
        models.Fact(label="Award period", value=f"{_month_year(row['start_date'])} – {_month_year(row['end_date'])}"),
        models.Fact(label="Latest year", value=f"${amount:,} in FY{row['latest_fy']}" if amount else "n/a"),
        link,
    ]


def project_detail(conn: sqlite3.Connection, project_id: str) -> models.ProjectDetail | None:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        return None
    colleges = [r["college"] for r in conn.execute(
        "SELECT college FROM project_colleges WHERE project_id = ?", (project_id,))]
    team = conn.execute("""
        SELECT t.researcher_id, t.name, t.role, r.department, r.college
        FROM project_team t LEFT JOIN researchers r ON r.id = t.researcher_id
        WHERE t.project_id = ? ORDER BY t.position
    """, (project_id,)).fetchall()
    funders = conn.execute(
        "SELECT name, category FROM project_funders WHERE project_id = ? ORDER BY position", (project_id,)).fetchall()
    by_year = conn.execute("""
        SELECT fiscal_year, SUM(award_amount) AS amount FROM award_years
        WHERE project_id = ? AND award_amount IS NOT NULL GROUP BY fiscal_year ORDER BY fiscal_year
    """, (project_id,)).fetchall()
    amount = row["latest_amount"]
    base = _projects(conn, [row])[0]
    return models.ProjectDetail(
        **base.model_dump(),
        abstract=[p for p in row["abstract"].split("\n\n") if p] or [row["summary"]],
        methodologies=[],
        facts=_facts(row, funders),
        funders=[models.FunderRef(name=f["name"], type=FUNDING_TYPES.get(f["category"], "Other")) for f in funders],
        funding=models.Funding(
            agency=f"{row['admin_ic_name']} ({row['agency']})" if row["admin_ic_name"] else row["agency"],
            mechanism=row["activity_code"] or "",
            period=f"{_month_year(row['start_date'])} – {_month_year(row['end_date'])}",
            total=f"${amount:,} in FY{row['latest_fy']}" if amount else "n/a",
            awardNumber=row["award_number"],
        ),
        fundingByYear=[models.YearAmount(fiscalYear=r["fiscal_year"], amount=r["amount"]) for r in by_year],
        topics=[models.TopicRef(id=t, name=TOPICS_BY_ID[t].name) for t in topic_ids(conn, project_id) if t in TOPICS_BY_ID],
        team=[
            models.TeamMember(
                researcherId=t["researcher_id"],
                name=t["name"],
                role=t["role"],
                department=t["department"] or row["department"] or "",
                college=t["college"] or (colleges[0] if colleges and t["researcher_id"] else None),
            )
            for t in team
        ],
        students=models.Students(skills=[], notice=NOTICES[row["kind"]]),
        relatedProjectIds=related_ids(conn, row),
    )


def related_ids(conn: sqlite3.Connection, row: sqlite3.Row, limit: int = 3) -> list[str]:
    """Same investigators' other records first, then records with similar titles."""
    same_pi = [r["project_id"] for r in conn.execute(f"""
        SELECT DISTINCT t2.project_id FROM project_team t1
        JOIN project_team t2 ON t2.researcher_id = t1.researcher_id AND t2.project_id != t1.project_id
        JOIN projects p ON p.id = t2.project_id
        WHERE t1.project_id = ? AND t1.researcher_id IS NOT NULL AND {PARENT_ONLY}
        ORDER BY p.kind = ? DESC, p.latest_fy DESC LIMIT ?
    """, (row["id"], row["kind"], limit))]
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
    project_ids = set(project_ids)
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


def _filters(colleges, funders, verification, status, topics, kinds=None, funding=None) -> dict[str, tuple[str, list]]:
    """One SQL condition per filter dimension, so facet counts can leave their own dimension out."""
    out: dict[str, tuple[str, list]] = {}
    if kinds:
        out["kind"] = (f"p.kind IN ({_marks(kinds)})", list(kinds))
    if colleges:
        out["college"] = (f"p.id IN (SELECT project_id FROM project_colleges WHERE college IN ({_marks(colleges)}))",
                          list(colleges))
    if funding:
        out["funding"] = (f"p.id IN (SELECT project_id FROM project_funders WHERE category IN ({_marks(funding)}))",
                          list(funding))
    if funders:
        out["funder"] = (f"(p.agency IN ({_marks(funders)}) OR p.funder IN ({_marks(funders)}))",
                         list(funders) + list(funders))
    if verification:
        out["verification"] = (f"p.verification IN ({_marks(verification)})", list(verification))
    conds = []
    if "active" in (status or []):
        conds.append("p.is_active = 1")
    if "ended" in (status or []):
        conds.append("(p.is_active = 0 AND p.kind != 'publication')")
    if conds:
        out["status"] = ("(" + " OR ".join(conds) + ")", [])
    if topics:
        out["topic"] = (f"p.id IN (SELECT project_id FROM project_topics WHERE topic_id IN ({_marks(topics)}))",
                        list(topics))
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

    base, params = _base(tokens, filters, "kind")
    kinds = conn.execute(f"SELECT p.kind, COUNT(*) n {base} GROUP BY p.kind ORDER BY n DESC", params).fetchall()
    sql, params = ids_sql("college")
    colleges = conn.execute(
        f"SELECT college, COUNT(*) n FROM project_colleges WHERE project_id IN ({sql}) GROUP BY college ORDER BY n DESC",
        params).fetchall()
    sql, params = ids_sql("funding")
    funding = conn.execute(f"""SELECT category, COUNT(DISTINCT project_id) n FROM project_funders
                               WHERE project_id IN ({sql}) GROUP BY category ORDER BY n DESC""", params).fetchall()
    base, params = _base(tokens, filters, "funder")
    funders = conn.execute(f"SELECT p.agency, COUNT(*) n {base} AND p.kind = 'award' GROUP BY p.agency ORDER BY n DESC",
                           params).fetchall()
    base, params = _base(tokens, filters, "status")
    status = conn.execute(f"""SELECT p.is_active, COUNT(*) n {base} AND p.kind != 'publication'
                              GROUP BY p.is_active ORDER BY p.is_active DESC""", params).fetchall()
    sql, params = ids_sql("topic")
    topics = conn.execute(f"""SELECT topic_id, COUNT(*) n FROM project_topics WHERE project_id IN ({sql})
                              GROUP BY topic_id ORDER BY n DESC""", params).fetchall()

    return models.Facets(
        kinds=[models.FacetValue(value=r["kind"], label=KIND_LABELS[r["kind"]], count=r["n"]) for r in kinds],
        colleges=[models.FacetValue(value=r["college"], label=COLLEGE_NAMES.get(r["college"], r["college"]), count=r["n"])
                  for r in colleges],
        fundingTypes=[models.FacetValue(value=r["category"], label=FUNDING_TYPES.get(r["category"], "Other"), count=r["n"])
                      for r in funding],
        funders=[models.FacetValue(value=r["agency"], label=r["agency"], count=r["n"]) for r in funders],
        status=[models.FacetValue(value="active" if r["is_active"] else "ended",
                                  label="Active" if r["is_active"] else "Ended", count=r["n"]) for r in status],
        topics=[models.FacetValue(value=r["topic_id"], label=TOPICS_BY_ID[r["topic_id"]].name, count=r["n"])
                for r in topics if r["topic_id"] in TOPICS_BY_ID],
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
    kinds: list[str] | None = None,
    funding: list[str] | None = None,
) -> models.SearchResponse:
    tokens = _tokens(q)
    filters = _filters(colleges, funders, verification, status, topics, kinds, funding)
    base, params = _base(tokens, filters)
    if tokens:
        order = "bm25(projects_fts, 0, 10, 3, 1, 2), p.is_active DESC"
        cols = "p.*, f.people"
    else:
        order = "p.kind = 'award' DESC, p.is_active DESC, p.latest_fy DESC, p.latest_amount DESC"
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
        interpretedAs=f"Keywords: {', '.join(tokens)}" if tokens else "All records",
        total=total,
        page=page,
        pageSize=PAGE_SIZE,
        results=results,
        facets=_facets(conn, tokens, filters),
    )
