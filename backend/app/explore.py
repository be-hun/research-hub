"""Aggregates for the Explore and Topic pages. Every figure is a count or sum over stored award records."""

import sqlite3
from collections import Counter, defaultdict

from app import models
from app.queries import PARENT_ONLY, _marks, _projects
from app.topics import AREA_TO_TOPIC, BY_ID, TOPICS

TREND_START = 2022  # NIH coverage starts here; earlier NSF-only years would make the trend misleading
SOURCE_INFO = {
    "nih-reporter": ("NIH RePORTER", "https://reporter.nih.gov/"),
    "nsf-awards": ("NSF Award Search", "https://www.nsf.gov/awardsearch/"),
}


def _parent_ids(conn: sqlite3.Connection) -> list[str]:
    return [r["id"] for r in conn.execute(f"SELECT p.id FROM projects p WHERE {PARENT_ONLY}")]


def _funding(conn: sqlite3.Connection) -> dict[str, int]:
    """Money obligated per award from TREND_START onward."""
    return {r["project_id"]: r["amount"] or 0 for r in conn.execute(
        "SELECT project_id, SUM(award_amount) AS amount FROM award_years WHERE fiscal_year >= ? GROUP BY project_id",
        (TREND_START,))}


def _topics_by_project(conn: sqlite3.Connection) -> dict[str, set[str]]:
    out: dict[str, set[str]] = defaultdict(set)
    for r in conn.execute("SELECT project_id, area_id FROM project_areas"):
        if r["area_id"] in AREA_TO_TOPIC:
            out[r["project_id"]].add(AREA_TO_TOPIC[r["area_id"]])
    return out


def _college_stats(conn: sqlite3.Connection, ids: list[str], funding: dict[str, int]) -> list[models.CollegeStat]:
    if not ids:
        return []
    rows = conn.execute(f"""
        SELECT c.college, c.project_id, p.is_active FROM project_colleges c JOIN projects p ON p.id = c.project_id
        WHERE c.project_id IN ({_marks(ids)})
    """, ids).fetchall()
    stats: dict[str, dict] = defaultdict(lambda: {"awards": 0, "active": 0, "funding": 0})
    for r in rows:
        s = stats[r["college"]]
        s["awards"] += 1
        s["active"] += r["is_active"]
        s["funding"] += funding.get(r["project_id"], 0)
    ranked = sorted(stats.items(), key=lambda kv: kv[1]["funding"], reverse=True)
    return [models.CollegeStat(college=c, **s) for c, s in ranked]


def _trend(conn: sqlite3.Connection, ids: list[str]) -> list[models.YearStat]:
    if not ids:
        return []
    rows = conn.execute(f"""
        SELECT ay.fiscal_year AS fy, p.agency, SUM(ay.award_amount) AS amount, COUNT(DISTINCT ay.project_id) AS awards
        FROM award_years ay JOIN projects p ON p.id = ay.project_id
        WHERE ay.fiscal_year >= ? AND ay.project_id IN ({_marks(ids)})
        GROUP BY ay.fiscal_year, p.agency
    """, [TREND_START] + ids).fetchall()
    years: dict[int, dict] = defaultdict(lambda: {"nih": 0, "nsf": 0, "other": 0, "awards": 0})
    for r in rows:
        key = r["agency"].lower() if r["agency"] in ("NIH", "NSF") else "other"
        years[r["fy"]][key] += r["amount"] or 0
        years[r["fy"]]["awards"] += r["awards"]
    latest = max(years, default=None)
    return [models.YearStat(fiscalYear=fy, mayBeIncomplete=fy == latest, **years[fy]) for fy in sorted(years)]


def _topic_summaries(conn, ids: list[str], funding, by_project) -> list[models.TopicSummary]:
    active = {r["id"] for r in conn.execute("SELECT id FROM projects WHERE is_active = 1")}
    stats: dict[str, dict] = defaultdict(lambda: {"awards": 0, "active": 0, "funding": 0})
    for pid in ids:
        for t in by_project.get(pid, ()):
            stats[t]["awards"] += 1
            stats[t]["active"] += pid in active
            stats[t]["funding"] += funding.get(pid, 0)
    return sorted(
        (models.TopicSummary(id=t.id, name=t.name, blurb=t.blurb, image=t.image, **stats[t.id])
         for t in TOPICS if stats[t.id]["awards"]),
        key=lambda s: (s.active, s.awards), reverse=True,
    )


def _cross_college_ids(conn: sqlite3.Connection, limit: int) -> list[str]:
    """Awards whose investigators belong to more than one college."""
    return [r["project_id"] for r in conn.execute(f"""
        SELECT t.project_id FROM project_team t JOIN researchers r ON r.id = t.researcher_id
        JOIN projects p ON p.id = t.project_id
        WHERE r.college IS NOT NULL AND {PARENT_ONLY}
        GROUP BY t.project_id HAVING COUNT(DISTINCT r.college) > 1
        ORDER BY MAX(p.is_active) DESC, MAX(p.latest_fy) DESC LIMIT ?
    """, (limit,))]


def overview(conn: sqlite3.Connection) -> models.Overview:
    ids = _parent_ids(conn)
    funding = _funding(conn)
    by_project = _topics_by_project(conn)
    count = lambda sql, *a: conn.execute(sql, a).fetchone()[0]

    sources = []
    for source, (label, url) in SOURCE_INFO.items():
        n = count(f"SELECT COUNT(*) FROM projects p WHERE p.source = ? AND {PARENT_ONLY}", source)
        if source == "nih-reporter":
            lo, hi = conn.execute("""SELECT MIN(fiscal_year), MAX(fiscal_year) FROM award_years ay
                                     JOIN projects p ON p.id = ay.project_id WHERE p.source = ?""", (source,)).fetchone()
            coverage = f"Fiscal years {lo}–{hi}"
        else:
            coverage = f"Awards active on or after January {TREND_START}"
        sources.append(models.SourceSummary(label=label, url=url, awards=n, coverage=coverage))

    finished = conn.execute(
        "SELECT finished_at FROM ingest_runs WHERE error IS NULL AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    ).fetchone()
    recent = conn.execute(f"""
        SELECT p.* FROM projects p WHERE p.is_active = 1 AND {PARENT_ONLY}
        ORDER BY p.start_date DESC, p.latest_amount DESC LIMIT 6
    """).fetchall()
    cross = _cross_college_ids(conn, 6)
    cross_rows = conn.execute(f"SELECT * FROM projects WHERE id IN ({_marks(cross)})", cross).fetchall() if cross else []
    cross_rows.sort(key=lambda r: cross.index(r["id"]))

    return models.Overview(
        totals=models.Totals(
            awards=len(ids),
            active=count(f"SELECT COUNT(*) FROM projects p WHERE p.is_active = 1 AND {PARENT_ONLY}"),
            researchers=count("SELECT COUNT(*) FROM researchers"),
            colleges=count("SELECT COUNT(DISTINCT college) FROM project_colleges"),
        ),
        sources=sources,
        updatedAt=finished["finished_at"][:10] if finished else None,
        byCollege=_college_stats(conn, ids, funding),
        trend=_trend(conn, ids),
        topics=_topic_summaries(conn, ids, funding, by_project),
        recent=_projects(conn, recent),
        crossCollege=_projects(conn, cross_rows),
    )


def topic_detail(conn: sqlite3.Connection, topic_id: str) -> models.TopicDetail | None:
    topic = BY_ID.get(topic_id)
    if not topic:
        return None
    all_ids = _parent_ids(conn)
    funding = _funding(conn)
    by_project = _topics_by_project(conn)
    ids = [pid for pid in all_ids if topic_id in by_project.get(pid, ())]
    summary = next((s for s in _topic_summaries(conn, ids, funding, by_project) if s.id == topic_id),
                   models.TopicSummary(id=topic.id, name=topic.name, blurb=topic.blurb, image=topic.image,
                                       awards=0, active=0, funding=0))

    funders = [f"{r['name']} ({r['abbreviation']})" for r in conn.execute(
        f"SELECT name, abbreviation FROM research_areas WHERE id IN ({_marks(topic.areas)}) ORDER BY name",
        topic.areas)]

    people: list[models.TopicPerson] = []
    if ids:
        for r in conn.execute(f"""
            SELECT r.name, r.college, r.department, COUNT(DISTINCT t.project_id) AS awards
            FROM project_team t JOIN researchers r ON r.id = t.researcher_id
            WHERE t.project_id IN ({_marks(ids)})
            GROUP BY r.id ORDER BY awards DESC, r.name LIMIT 12
        """, ids):
            people.append(models.TopicPerson(name=r["name"], college=r["college"],
                                             department=r["department"] or "", awards=r["awards"]))

    project_rows = conn.execute(f"""
        SELECT * FROM projects WHERE id IN ({_marks(ids)})
        ORDER BY is_active DESC, latest_amount DESC LIMIT 12
    """, ids).fetchall() if ids else []

    # Related topics: the ones that share the most investigators with this one.
    shared: Counter = Counter()
    if ids:
        people_here = {r["researcher_id"] for r in conn.execute(
            f"SELECT researcher_id FROM project_team WHERE project_id IN ({_marks(ids)})", ids)}
        for r in conn.execute("SELECT project_id, researcher_id FROM project_team"):
            if r["researcher_id"] in people_here:
                for t in by_project.get(r["project_id"], ()):
                    if t != topic_id:
                        shared[t] += 1
    summaries = {s.id: s for s in _topic_summaries(conn, all_ids, funding, by_project)}
    related = [summaries[t] for t, _ in shared.most_common() if t in summaries][:3]

    return models.TopicDetail(
        topic=summary,
        funders=funders,
        byCollege=_college_stats(conn, ids, funding),
        trend=_trend(conn, ids),
        people=people,
        projects=_projects(conn, project_rows),
        related=related,
    )
