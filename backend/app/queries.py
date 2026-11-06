"""Read queries. Every value returned comes from a stored record; nothing is generated."""

import re
from collections import Counter, defaultdict
from datetime import date

from app import models
from app.colleges import COLLEGE_NAMES
from app.db import Connection, Row
from app.topics import BY_ID as TOPICS_BY_ID
from ingest.funders import CATEGORIES as FUNDING_TYPES

PAGE_SIZE = 10
# NIH center grants are stored as a parent award plus component sub-projects whose money is part of
# the parent's. Lists, counts and totals use parents only so nothing is counted twice.
PARENT_ONLY = "(p.source != 'nih-reporter' OR p.id = 'nih-' || p.award_number)"
KIND_LABELS = {"award": "Grants", "trial": "Clinical trials", "publication": "Publications"}
STATUS_LABELS = {"active": "Active", "ended": "Ended", "recruiting": "Recruiting"}
# Registry statuses of a trial that is taking participants: the search filter `status=recruiting`.
RECRUITING = ("Recruiting", "Not yet recruiting", "Enrolling by invitation")
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
# Full-text search takes three parameters: any of the words, all of them, and the words as a phrase.
# Then ts_rank, higher is better, with weights per schema.sql and normalization 1 (divide by log length) so a long
# abstract that repeats a word doesn't outrank a title about it. Checked against the SQLite bm25 top 10.
FTS_FROM = ("projects_fts f JOIN projects p ON p.id = f.project_id "
            "CROSS JOIN to_tsquery('english', ?) AS query CROSS JOIN to_tsquery('english', ?) AS all_words "
            "CROSS JOIN phraseto_tsquery('english', ?) AS phrase")
# What a record must contain to be a result. strict: the phrase or every word ("supply chain" never lists a record
# that only says "supply"). any: one of the words, used only when no record has them all. web: the query as typed,
# with "quoted phrases" and -excluded words (websearch_to_tsquery), used when the query has either.
MATCH_SQL = {
    "strict": "(f.document @@ phrase OR f.document @@ all_words)",
    "any": "f.document @@ query",
    "web": "f.document @@ websearch_to_tsquery('english', ?)",
}
# The words as a phrase first ("supply chain", not a paper that says "supply" and "chain"), then all of them, then
# relevance.
FTS_RANK = ("f.document @@ phrase DESC, f.document @@ all_words DESC, "
            "ts_rank('{0.1, 0.2, 0.3, 1.0}', f.document, query, 1) DESC")
# Snippets: about 30 words of the abstract around the matched words, each matched word wrapped in ⟦ ⟧.
HEADLINE_OPTIONS = 'StartSel=⟦, StopSel=⟧, MaxWords=32, MinWords=14, MaxFragments=1, FragmentDelimiter=" … "'


def _marks(values: list) -> str:
    return ",".join("?" * len(values))


# ---------- shared ----------

def _by_project(conn: Connection, sql: str, ids: list[str]) -> dict[str, list[Row]]:
    out: dict[str, list[Row]] = defaultdict(list)
    if ids:
        for r in conn.execute(sql.format(marks=_marks(ids)), ids):
            out[r["project_id"]].append(r)
    return out


def _projects(conn: Connection, rows: list[Row]) -> list[models.Project]:
    ids = [r["id"] for r in rows]
    colleges = _by_project(conn, "SELECT project_id, college FROM project_colleges WHERE project_id IN ({marks}) ORDER BY college", ids)
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


def topic_ids(conn: Connection, project_id: str) -> list[str]:
    return [r["topic_id"] for r in conn.execute(
        "SELECT topic_id FROM project_topics WHERE project_id = ? ORDER BY method, topic_id", (project_id,))]


# ---------- projects ----------

def featured(conn: Connection, limit: int = 3) -> list[models.Project]:
    """Active grants, largest first, one per college and spread across sources so the home page shows breadth."""
    rows = conn.execute(f"""
        SELECT p.*, c.college FROM projects p JOIN project_colleges c ON c.project_id = p.id
        WHERE p.kind = 'award' AND p.is_active = 1 AND length(p.abstract) > 0 AND {PARENT_ONLY}
        ORDER BY p.latest_amount DESC NULLS LAST, p.id
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


def projects_by_ids(conn: Connection, ids: list[str]) -> list[models.Project]:
    if not ids:
        return []
    rows = conn.execute(f"SELECT * FROM projects WHERE id IN ({_marks(ids)})", ids).fetchall()
    by_id = {r["id"]: r for r in rows}
    return _projects(conn, [by_id[i] for i in ids if i in by_id])


def _facts(row: Row, funders: list[Row]) -> list[models.Fact]:
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


def project_detail(conn: Connection, project_id: str) -> models.ProjectDetail | None:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        return None
    colleges = [r["college"] for r in conn.execute(
        "SELECT college FROM project_colleges WHERE project_id = ? ORDER BY college", (project_id,))]
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


def related_ids(conn: Connection, row: Row, limit: int = 3) -> list[str]:
    """Same investigators' other records first, then records with similar titles."""
    same_pi = [r["project_id"] for r in conn.execute(f"""
        SELECT p.id AS project_id FROM project_team t1
        JOIN project_team t2 ON t2.researcher_id = t1.researcher_id AND t2.project_id != t1.project_id
        JOIN projects p ON p.id = t2.project_id
        WHERE t1.project_id = ? AND t1.researcher_id IS NOT NULL AND {PARENT_ONLY}
        GROUP BY p.id ORDER BY p.kind = ? DESC, p.latest_fy DESC, p.id LIMIT ?
    """, (row["id"], row["kind"], limit))]
    if len(same_pi) < limit:
        tokens = _tokens(row["title"])
        if tokens:
            for r in conn.execute(f"""
                SELECT f.project_id FROM {FTS_FROM}
                WHERE f.document @@ query AND {PARENT_ONLY}
                ORDER BY {FTS_RANK}, p.id LIMIT 10
            """, _fts_params(tokens)):
                if r["project_id"] != row["id"] and r["project_id"] not in same_pi:
                    same_pi.append(r["project_id"])
                if len(same_pi) == limit:
                    break
    return same_pi


# ---------- researchers ----------

def _distinctive_terms(conn: Connection, project_ids: list[str], limit: int = 6) -> list[str]:
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
    # Ties: rarer across Temple first, then alphabetical, so the order doesn't depend on row order.
    ordered = sorted(mine.items(), key=lambda kv: (-kv[1], df[kv[0]], kv[0]))
    ranked = [t for t, n in ordered if df[t] / total < 0.05 and (n > 1 or len(project_ids) == 1)]
    return ranked[:limit]


# ---------- search ----------

def _tokens(text: str) -> list[str]:
    seen: list[str] = []
    for t in re.findall(r"[a-z0-9]+", re.sub(r"['\u2019]s\b", "", text.lower())):  # "Alzheimer's" is one word
        if len(t) > 1 and t not in STOPWORDS and t not in seen:
            seen.append(t)
    return seen[:12]


def _fts_params(tokens: list[str]) -> list[str]:
    """Any of the words, all of them, and the phrase, as Postgres tsqueries. Tokens are [a-z0-9]+ only: nothing to escape."""
    return [" | ".join(tokens), " & ".join(tokens), " ".join(tokens)]


def _web_query(q: str) -> str | None:
    """The query for websearch_to_tsquery when it uses "quotes" or -exclusions, else None."""
    q = q.replace("\u201c", '"').replace("\u201d", '"')
    return q if '"' in q or re.search(r"(?:^|\s)-\w", q) else None


def _positive(q: str) -> str:
    """The query without its -excluded words, for ranking and highlighting."""
    return re.sub(r"(?:^|\s)-\S+", " ", q)


def _snippets(conn: Connection, ids: list[str], tsquery: str) -> dict[str, str]:
    """Headlines from the stored abstract (or summary) for these records only; the FTS copy has punctuation stripped.

    None for a record whose text has no query word, or whose only text is its title (the card already shows it).
    """
    if not ids:
        return {}
    rows = conn.execute(f"""
        SELECT id, title, COALESCE(NULLIF(abstract, ''), summary) AS text,
               ts_headline('english', COALESCE(NULLIF(abstract, ''), summary), to_tsquery('english', ?), ?) AS snippet
        FROM projects WHERE id IN ({_marks(ids)})
    """, [tsquery, HEADLINE_OPTIONS] + ids).fetchall()
    out = {}
    for r in rows:
        snippet = " ".join((r["snippet"] or "").split())
        if "⟦" not in snippet or (r["text"] or "").strip() == (r["title"] or "").strip():
            continue
        text, plain = " ".join((r["text"] or "").split()), snippet.replace("⟦", "").replace("⟧", "")
        if not text.startswith(plain[:24]):
            snippet = "… " + snippet
        if not text.endswith(plain[-24:]):
            snippet += " …"
        out[r["id"]] = snippet
    return out


def _match(row: Row, tokens: list[str]) -> models.Match | None:
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
    conds, values = [], []
    if "active" in (status or []):
        conds.append("p.is_active = 1")
    if "ended" in (status or []):
        conds.append("(p.is_active = 0 AND p.kind != 'publication')")
    if "recruiting" in (status or []):
        conds.append(f"(p.kind = 'trial' AND p.status_label IN ({_marks(RECRUITING)}))")
        values += RECRUITING
    if conds:
        out["status"] = ("(" + " OR ".join(conds) + ")", values)
    if topics:
        out["topic"] = (f"p.id IN (SELECT project_id FROM project_topics WHERE topic_id IN ({_marks(topics)}))",
                        list(topics))
    return out


def _base(tokens: list[str], filters: dict[str, tuple[str, list]], skip: str | None = None,
          mode: str = "strict", web: str | None = None) -> tuple[str, list]:
    """FROM and WHERE for a search. mode is a MATCH_SQL key; "web" also takes the raw query."""
    if tokens:
        sql, params = f"FROM {FTS_FROM} WHERE {MATCH_SQL[mode]}", _fts_params(tokens) + ([web] if mode == "web" else [])
    else:
        sql, params = "FROM projects p WHERE TRUE", []
    sql += f" AND {PARENT_ONLY}"
    for dim, (cond, values) in filters.items():
        if dim != skip:
            sql += f" AND {cond}"
            params += values
    return sql, params


def _facets(conn: Connection, tokens: list[str], filters: dict, mode: str = "strict", web: str | None = None) -> models.Facets:
    """Counts per filter value for the same matches as the list (same mode), each ignoring its own filter."""
    def ids_sql(skip: str) -> tuple[str, list]:
        base, params = _base(tokens, filters, skip, mode, web)
        return f"SELECT p.id {base}", params

    base, params = _base(tokens, filters, "kind", mode, web)
    kinds = conn.execute(f"SELECT p.kind, COUNT(*) n {base} GROUP BY p.kind ORDER BY n DESC, p.kind", params).fetchall()
    sql, params = ids_sql("college")
    colleges = conn.execute(
        f"SELECT college, COUNT(*) n FROM project_colleges WHERE project_id IN ({sql}) GROUP BY college ORDER BY n DESC, college",
        params).fetchall()
    sql, params = ids_sql("funding")
    funding = conn.execute(f"""SELECT category, COUNT(DISTINCT project_id) n FROM project_funders
                               WHERE project_id IN ({sql}) GROUP BY category ORDER BY n DESC, category""", params).fetchall()
    base, params = _base(tokens, filters, "funder", mode, web)
    funders = conn.execute(f"SELECT p.agency, COUNT(*) n {base} AND p.kind = 'award' GROUP BY p.agency ORDER BY n DESC, p.agency",
                           params).fetchall()
    base, params = _base(tokens, filters, "status", mode, web)
    status = conn.execute(f"""SELECT p.is_active, COUNT(*) n {base} AND p.kind != 'publication'
                              GROUP BY p.is_active ORDER BY p.is_active DESC""", params).fetchall()
    recruiting = conn.execute(f"""SELECT COUNT(*) {base} AND p.kind = 'trial'
                                  AND p.status_label IN ({_marks(RECRUITING)})""", params + list(RECRUITING)).fetchone()[0]
    sql, params = ids_sql("topic")
    topics = conn.execute(f"""SELECT topic_id, COUNT(*) n FROM project_topics WHERE project_id IN ({sql})
                              GROUP BY topic_id ORDER BY n DESC, topic_id""", params).fetchall()

    return models.Facets(
        kinds=[models.FacetValue(value=r["kind"], label=KIND_LABELS[r["kind"]], count=r["n"]) for r in kinds],
        colleges=[models.FacetValue(value=r["college"], label=COLLEGE_NAMES.get(r["college"], r["college"]), count=r["n"])
                  for r in colleges],
        fundingTypes=[models.FacetValue(value=r["category"], label=FUNDING_TYPES.get(r["category"], "Other"), count=r["n"])
                      for r in funding],
        funders=[models.FacetValue(value=r["agency"], label=r["agency"], count=r["n"]) for r in funders],
        status=[models.FacetValue(value="active" if r["is_active"] else "ended",
                                  label="Active" if r["is_active"] else "Ended", count=r["n"]) for r in status]
               + [models.FacetValue(value="recruiting", label="Recruiting trials", count=recruiting)] * bool(recruiting),
        topics=[models.FacetValue(value=r["topic_id"], label=TOPICS_BY_ID[r["topic_id"]].name, count=r["n"])
                for r in topics if r["topic_id"] in TOPICS_BY_ID],
    )


def search(
    conn: Connection,
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
    """Records that contain the phrase or every word, phrase first; records with any word only when none has them all.

    A query with "quotes" or -exclusions is read by websearch_to_tsquery instead (same fallback).
    """
    web = _web_query(q)
    tokens = _tokens(_positive(web) if web else q)
    filters = _filters(colleges, funders, verification, status, topics, kinds, funding)
    page = max(page, 1)
    if not tokens:
        base, params = _base(tokens, filters)
        total = conn.execute(f"SELECT COUNT(*) {base}", params).fetchone()[0]
        mode, match_mode = "strict", "browse"
        order = "p.kind = 'award' DESC, p.is_active DESC, p.latest_fy DESC, p.latest_amount DESC NULLS LAST, p.start_date DESC NULLS LAST, p.id"
        cols = "p.*, '' AS people"
    else:
        mode = "web" if web else "strict"
        base, params = _base(tokens, filters, mode=mode, web=web)
        total, phrases = conn.execute(f"SELECT COUNT(*), COUNT(*) FILTER (WHERE f.document @@ phrase) {base}",
                                      params).fetchone()
        if total == 0 and len(tokens) >= 2:
            mode = "any"
            base, params = _base(tokens, filters, mode=mode)
            total, phrases = conn.execute(f"SELECT COUNT(*), 0 {base}", params).fetchone()
        # Phrase matches rank first, so when any record has the phrase, the top result does.
        match_mode = "any" if mode == "any" else "phrase" if phrases and len(tokens) >= 2 else "all"
        order = f"{FTS_RANK}, p.is_active DESC, p.id"
        cols = "p.*, f.people"

    rows = conn.execute(
        f"SELECT {cols} {base} ORDER BY {order} LIMIT ? OFFSET ?", params + [PAGE_SIZE, (page - 1) * PAGE_SIZE]
    ).fetchall()

    results = _projects(conn, rows)
    if tokens:
        any_words, all_words, _ = _fts_params(tokens)
        snippets = _snippets(conn, [r["id"] for r in rows], any_words if mode == "any" else all_words)
        for project, row in zip(results, rows):
            project.match = _match(row, tokens)
            if snippet := snippets.get(row["id"]):
                project.match = project.match or models.Match(reason="Matched in the abstract.",
                                                              evidence=[f"{row['source_label']} abstract"])
                project.match.snippet = snippet

    return models.SearchResponse(
        query=q,
        interpretedAs=f"Keywords: {', '.join(tokens)}" if tokens else "All records",
        matchMode=match_mode,
        total=total,
        page=page,
        pageSize=PAGE_SIZE,
        results=results,
        facets=_facets(conn, tokens, filters, mode, web),
    )
