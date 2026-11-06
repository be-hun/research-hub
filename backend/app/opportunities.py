"""Funding calls from Grants.gov: search, filters and detail. Filters, sorting and counts are SQL.

The agency's text (title, synopsis, eligibility) is returned as stored, never rewritten. Dates are ISO text in the
database; every comparison with today happens in SQL against `current_date`.
"""

import re

from app import models
from app.db import Connection, Row
from app.queries import PARENT_ONLY, _marks, _projects

PAGE_SIZE = 20
OPEN = ["posted", "forecasted"]
PAST_AWARDS = 10
PROJECT_CALLS = 6
# Grants.gov applicant types for higher education: 06 public and state controlled, 20 private.
UNIVERSITY_CODES = ["06", "20"]
STATUS_LABELS = {"posted": "Open", "forecasted": "Forecasted", "closed": "Closed"}

# A posted call whose deadline has passed is closed, whatever Grants.gov's status still says, so it is filtered,
# counted and returned as closed. A forecasted call whose estimated deadline has passed is hidden the same way for
# now (the forecast is stale; the agency may still post it later).
STATUS_SQL = ("(CASE WHEN o.status IN ('posted', 'forecasted') AND o.close_date::date < current_date THEN 'closed' "
              "ELSE o.status END)")
UNIVERSITIES_SQL = ("EXISTS (SELECT 1 FROM opportunity_applicant_types t WHERE t.opportunity_id = o.id AND t.code IN "
                    f"({', '.join(repr(c) for c in UNIVERSITY_CODES)}))")
COLUMNS = (f"o.*, {STATUS_SQL} AS effective_status, o.close_date::date - current_date AS days_left, "
           f"{UNIVERSITIES_SQL} AS universities")
# The categories as an array; stored '; ' separated.
CATEGORIES_SQL = r"regexp_split_to_array(o.categories, '\s*;\s*')"
# Soonest deadline first, calls without one last.
DEADLINE_ORDER = "o.close_date::date ASC NULLS LAST, o.title, o.id"
# The query as typed (websearch_to_tsquery: "quoted phrases", -excluded words), plus the raw text, upper-cased, so an
# exact call number or agency label also matches. The FTS row is LEFT JOINed: a call without one still matches by number.
TEXT_FROM = ("opportunities o LEFT JOIN opportunities_fts f ON f.opportunity_id = o.id "
             "CROSS JOIN (SELECT websearch_to_tsquery('english', ?) AS query, upper(?) AS term) s")
TEXT_MATCH = "(f.document @@ s.query OR upper(o.number) = s.term OR upper(o.agency) = s.term)"
# An exact call number first, then ts_rank with schema.sql's weights, normalized by length like project search.
TEXT_RANK = ("upper(o.number) = s.term DESC, "
             "ts_rank('{0.1, 0.2, 0.3, 1.0}', f.document, s.query, 1) DESC NULLS LAST")


def _split(text: str | None) -> list[str]:
    return [part.strip() for part in (text or "").split(";") if part.strip()]


def _paragraphs(text: str | None) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text or "") if p.strip()]


def _programs(conn: Connection, ids: list[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {i: [] for i in ids}
    if ids:
        for r in conn.execute(f"""SELECT opportunity_id, aln FROM opportunity_programs
                                  WHERE opportunity_id IN ({_marks(ids)}) ORDER BY aln""", ids):
            out[r["opportunity_id"]].append(r["aln"])
    return out


def _fields(row: Row, programs: list[str]) -> dict:
    """The Opportunity fields of a row selected with COLUMNS."""
    return dict(
        id=row["id"],
        number=row["number"],
        title=row["title"],
        status=row["effective_status"],
        agency=row["agency"],
        agencyName=row["agency_name"],
        postedDate=row["posted_date"],
        closeDate=row["close_date"],
        closeDateEstimated=bool(row["close_date_estimated"]),
        closeDateNote=row["close_date_note"],
        daysLeft=row["days_left"],
        awardFloor=row["award_floor"],
        awardCeiling=row["award_ceiling"],
        expectedAwards=row["expected_awards"],
        universitiesEligible=bool(row["universities"]),
        categories=_split(row["categories"]),
        programs=programs,
        source=models.Source(label="Grants.gov", url=row["source_url"]),
        updatedAt=row["updated_at"],
    )


def _opportunities(conn: Connection, rows: list[Row]) -> list[models.Opportunity]:
    programs = _programs(conn, [r["id"] for r in rows])
    return [models.Opportunity(**_fields(r, programs[r["id"]])) for r in rows]


# ---------- search ----------

def _filters(agencies, statuses, categories, universities_only, closes_within) -> dict[str, tuple[str, list]]:
    """One SQL condition per filter dimension, so facet counts can leave their own dimension out."""
    statuses = list(statuses) or OPEN
    out: dict[str, tuple[str, list]] = {"status": (f"{STATUS_SQL} IN ({_marks(statuses)})", statuses)}
    if agencies:
        out["agency"] = (f"o.agency IN ({_marks(agencies)})", list(agencies))
    if categories:
        out["category"] = (f"{CATEGORIES_SQL} && ARRAY[{_marks(categories)}]::text[]",
                           list(categories))
    if universities_only:
        out["universities"] = (UNIVERSITIES_SQL, [])
    if closes_within is not None:
        out["closes_within"] = ("o.close_date::date BETWEEN current_date AND current_date + CAST(? AS integer)",
                                [closes_within])
    return out


def _base(q: str, filters: dict[str, tuple[str, list]], skip: str | None = None) -> tuple[str, list]:
    """FROM and WHERE for a search, leaving out the filter named `skip`."""
    if q:
        sql, params = f"FROM {TEXT_FROM} WHERE {TEXT_MATCH}", [q, q]
    else:
        sql, params = "FROM opportunities o WHERE TRUE", []
    for dim, (cond, values) in filters.items():
        if dim != skip:
            sql += f" AND {cond}"
            params += values
    return sql, params


def _facets(conn: Connection, q: str, filters: dict) -> models.OpportunityFacets:
    """Counts per filter value for the same matches as the list, each ignoring its own filter."""
    base, params = _base(q, filters, "agency")
    agencies = conn.execute(f"SELECT o.agency AS value, COUNT(*) n {base} GROUP BY o.agency ORDER BY n DESC, o.agency",
                            params).fetchall()
    base, params = _base(q, filters, "status")
    status = conn.execute(f"SELECT {STATUS_SQL} AS value, COUNT(*) n {base} GROUP BY 1 ORDER BY n DESC, 1",
                          params).fetchall()
    base, params = _base(q, filters, "category")
    categories = conn.execute(f"""SELECT c.value, COUNT(DISTINCT m.id) n
                                  FROM (SELECT o.id, {CATEGORIES_SQL} AS categories {base}) m
                                  CROSS JOIN unnest(m.categories) AS c(value)
                                  WHERE c.value != '' GROUP BY c.value ORDER BY n DESC, c.value""", params).fetchall()
    return models.OpportunityFacets(
        agencies=[models.FacetValue(value=r["value"], label=r["value"], count=r["n"]) for r in agencies],
        status=[models.FacetValue(value=r["value"], label=STATUS_LABELS.get(r["value"], r["value"]), count=r["n"])
                for r in status],
        categories=[models.FacetValue(value=r["value"], label=r["value"], count=r["n"]) for r in categories],
    )


def search(
    conn: Connection,
    q: str,
    page: int,
    agencies: list[str],
    statuses: list[str],
    categories: list[str],
    universities_only: bool,
    closes_within: int | None,
    sort: models.OpportunitySort,
) -> models.OpportunitySearchResponse:
    """Calls matching q (title, description, number, agency). With no status filter, posted and forecasted only."""
    text = " ".join(q.split())
    page = max(page, 1)
    filters = _filters(agencies, statuses, categories, universities_only, closes_within)
    base, params = _base(text, filters)
    total = conn.execute(f"SELECT COUNT(*) {base}", params).fetchone()[0]
    if sort == "newest":
        order = "o.posted_date::date DESC NULLS LAST, o.title, o.id"
    elif sort == "relevance" and text:
        order = f"{TEXT_RANK}, {DEADLINE_ORDER}"
    else:
        order = DEADLINE_ORDER
    rows = conn.execute(f"SELECT {COLUMNS} {base} ORDER BY {order} LIMIT ? OFFSET ?",
                        params + [PAGE_SIZE, (page - 1) * PAGE_SIZE]).fetchall()
    return models.OpportunitySearchResponse(
        query=q, total=total, page=page, pageSize=PAGE_SIZE, sort=sort, results=_opportunities(conn, rows),
        facets=_facets(conn, text, filters),
    )


# ---------- detail ----------

def detail(conn: Connection, opportunity_id: str) -> models.OpportunityDetail | None:
    """One call with its full text and Temple's past awards under the same assistance listings; None if unknown."""
    row = conn.execute(f"SELECT {COLUMNS} FROM opportunities o WHERE o.id = ?", (opportunity_id,)).fetchone()
    if not row:
        return None
    applicant_types = conn.execute(
        "SELECT code, label FROM opportunity_applicant_types WHERE opportunity_id = ? ORDER BY code",
        (opportunity_id,)).fetchall()
    awards = f"""FROM projects p WHERE p.kind = 'award' AND {PARENT_ONLY} AND p.id IN (
                     SELECT pp.project_id FROM project_programs pp JOIN opportunity_programs op ON op.aln = pp.aln
                     WHERE op.opportunity_id = ?)"""
    count = conn.execute(f"SELECT COUNT(*) {awards}", (opportunity_id,)).fetchone()[0]
    past = conn.execute(f"SELECT p.* {awards} ORDER BY p.latest_fy DESC, p.start_date DESC NULLS LAST, p.id LIMIT ?",
                        (opportunity_id, PAST_AWARDS)).fetchall()
    return models.OpportunityDetail(
        **_fields(row, _programs(conn, [opportunity_id])[opportunity_id]),
        description=_paragraphs(row["description"]),
        eligibilityText=row["eligibility_text"],
        applicantTypes=[models.ApplicantType(code=t["code"], label=t["label"]) for t in applicant_types],
        fundingInstruments=_split(row["funding_instruments"]),
        totalFunding=row["total_funding"],
        costSharing=bool(row["cost_sharing"]),
        archiveDate=row["archive_date"],
        contact=models.OpportunityContact(name=row["contact_name"], email=row["contact_email"],
                                          phone=row["contact_phone"]),
        pastAwardCount=count,
        pastAwards=_projects(conn, past),
    )


def for_project(conn: Connection, project_id: str) -> list[models.Opportunity] | None:
    """Open calls sharing an assistance listing with this award, soonest deadline first; None if the project is unknown.

    A center-grant component also uses its parent award's listings, since a source may attach them to the parent only.
    """
    project = conn.execute("SELECT id, source, award_number FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        return None
    ids = [project_id]
    if project["source"] == "nih-reporter":
        ids.append(f"nih-{project['award_number']}")
    rows = conn.execute(f"""
        SELECT {COLUMNS} FROM opportunities o
        WHERE o.status IN ({_marks(OPEN)}) AND (o.close_date IS NULL OR o.close_date::date >= current_date)
          AND o.id IN (SELECT op.opportunity_id FROM opportunity_programs op
                       JOIN project_programs pp ON pp.aln = op.aln WHERE pp.project_id IN ({_marks(ids)}))
        ORDER BY {DEADLINE_ORDER} LIMIT ?
    """, OPEN + ids + [PROJECT_CALLS]).fetchall()
    return _opportunities(conn, rows)
