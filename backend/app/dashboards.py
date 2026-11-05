"""College dashboards. Every figure is a SQL aggregate; nothing loads the whole project table into Python.

Totals follow the same rules as the Explore page (`explore.overview().byCollege`): parent awards only, and
funding is money obligated from TREND_START onward. A test holds the two in step.
"""


from app import models
from app.colleges import COLLEGE_NAMES
from app.db import Connection
from app.explore import TREND_START, last_updated, source_summaries, trend_from_rows
from app.queries import PARENT_ONLY, _projects
from app.topics import BY_ID as TOPICS_BY_ID

TOPIC_LIMIT = 8
RESEARCHER_LIMIT = 12
ROW_LIMIT = 6

FUNDING = """LEFT JOIN (SELECT project_id, SUM(award_amount) AS amount FROM award_years
                        WHERE fiscal_year >= ? GROUP BY project_id) f ON f.project_id = p.id"""


def _summaries(conn: Connection, college: str | None = None) -> list[models.CollegeSummary]:
    where, params = ("AND c.college = ?", [college]) if college else ("", [])
    stats = {r["college"]: r for r in conn.execute(f"""
        SELECT c.college,
               COUNT(*) FILTER (WHERE p.kind = 'award') AS awards,
               COUNT(*) FILTER (WHERE p.kind = 'award' AND p.is_active = 1) AS active,
               SUM(CASE WHEN p.kind = 'award' THEN COALESCE(f.amount, 0) ELSE 0 END) AS funding,
               COUNT(*) FILTER (WHERE p.kind = 'trial') AS trials,
               COUNT(*) FILTER (WHERE p.kind = 'publication') AS publications
        FROM project_colleges c JOIN projects p ON p.id = c.project_id {FUNDING}
        WHERE {PARENT_ONLY} {where}
        GROUP BY c.college
    """, [TREND_START] + params)}
    people = {r["college"]: r["n"] for r in conn.execute(
        "SELECT college, COUNT(*) AS n FROM researchers WHERE college IS NOT NULL GROUP BY college")}
    ids = [college] if college else list(COLLEGE_NAMES)
    out = []
    for cid in ids:
        s = stats.get(cid)
        out.append(models.CollegeSummary(
            id=cid, name=COLLEGE_NAMES[cid],
            awards=s["awards"] if s else 0, active=s["active"] if s else 0, funding=s["funding"] if s else 0,
            trials=s["trials"] if s else 0, publications=s["publications"] if s else 0,
            researchers=people.get(cid, 0),
        ))
    return out


def colleges(conn: Connection) -> list[models.CollegeSummary]:
    """Every college, including ones with no records, in the fixed display order (never ranked by money)."""
    return _summaries(conn)


def dashboard(conn: Connection, college: str) -> models.CollegeDashboard | None:
    if college not in COLLEGE_NAMES:
        return None
    summary = _summaries(conn, college)[0]

    trend = trend_from_rows(conn.execute(f"""
        SELECT ay.fiscal_year AS fy, p.agency, SUM(ay.award_amount) AS amount, COUNT(DISTINCT ay.project_id) AS awards
        FROM award_years ay JOIN projects p ON p.id = ay.project_id
        JOIN project_colleges c ON c.project_id = p.id AND c.college = ?
        WHERE ay.fiscal_year >= ? AND p.kind = 'award' AND {PARENT_ONLY}
        GROUP BY ay.fiscal_year, p.agency
    """, (college, TREND_START)).fetchall())

    topics = [
        models.CollegeTopic(id=r["topic_id"], name=TOPICS_BY_ID[r["topic_id"]].name,
                            image=TOPICS_BY_ID[r["topic_id"]].image, records=r["records"],
                            awards=r["awards"])
        for r in conn.execute(f"""
            SELECT pt.topic_id, COUNT(*) AS records, COUNT(*) FILTER (WHERE p.kind = 'award') AS awards
            FROM project_topics pt JOIN projects p ON p.id = pt.project_id
            JOIN project_colleges c ON c.project_id = p.id AND c.college = ?
            WHERE {PARENT_ONLY} GROUP BY pt.topic_id ORDER BY records DESC, pt.topic_id
        """, (college,))
        if r["topic_id"] in TOPICS_BY_ID
    ][:TOPIC_LIMIT]

    researchers = [
        models.CollegeResearcher(researcherId=r["id"], name=r["name"], department=r["department"] or "",
                                 identityConfidence=r["identity_confidence"], records=r["records"])
        for r in conn.execute("""
            SELECT r.id, r.name, r.department, r.identity_confidence, COUNT(DISTINCT t.project_id) AS records
            FROM researchers r JOIN project_team t ON t.researcher_id = r.id
            WHERE r.college = ? GROUP BY r.id ORDER BY records DESC, r.name LIMIT ?
        """, (college, RESEARCHER_LIMIT))
    ]

    # Grants with an investigator from this college and one from another, the Explore page's definition.
    mine = f"""SELECT DISTINCT t.project_id FROM project_team t JOIN researchers r ON r.id = t.researcher_id
               JOIN projects p ON p.id = t.project_id
               WHERE r.college = ? AND p.kind = 'award' AND {PARENT_ONLY}"""
    partners = [
        models.CollegePartner(college=r["college"], records=r["n"])
        for r in conn.execute(f"""
            SELECT r.college, COUNT(DISTINCT t.project_id) AS n
            FROM project_team t JOIN researchers r ON r.id = t.researcher_id
            WHERE t.project_id IN ({mine}) AND r.college IS NOT NULL AND r.college != ?
            GROUP BY r.college ORDER BY n DESC, r.college
        """, (college, college))
    ]
    cross = conn.execute(f"""
        SELECT p.* FROM projects p WHERE p.id IN ({mine}) AND p.id IN (
            SELECT t.project_id FROM project_team t JOIN researchers r ON r.id = t.researcher_id
            WHERE r.college IS NOT NULL AND r.college != ?)
        ORDER BY p.is_active DESC, p.latest_fy DESC, p.id LIMIT ?
    """, (college, college, ROW_LIMIT)).fetchall()

    recent = conn.execute(f"""
        SELECT p.* FROM projects p JOIN project_colleges c ON c.project_id = p.id AND c.college = ?
        WHERE {PARENT_ONLY} ORDER BY COALESCE(p.start_date, '') DESC, p.id LIMIT ?
    """, (college, ROW_LIMIT)).fetchall()

    counts = {r["source"]: r["n"] for r in conn.execute(f"""
        SELECT p.source, COUNT(*) AS n FROM projects p JOIN project_colleges c ON c.project_id = p.id AND c.college = ?
        WHERE {PARENT_ONLY} GROUP BY p.source
    """, (college,))}
    unassigned = conn.execute(f"""
        SELECT COUNT(*) FROM projects p WHERE {PARENT_ONLY}
        AND NOT EXISTS (SELECT 1 FROM project_colleges c WHERE c.project_id = p.id)
    """).fetchone()[0]

    return models.CollegeDashboard(
        college=summary,
        fundingYears=[trend[0].fiscalYear, trend[-1].fiscalYear] if trend else [],
        updatedAt=last_updated(conn),
        trend=trend,
        topics=topics,
        researchers=researchers,
        partners=partners,
        crossCollege=_projects(conn, cross),
        recent=_projects(conn, recent),
        sources=source_summaries(conn, counts),
        unassignedRecords=unassigned,
    )
