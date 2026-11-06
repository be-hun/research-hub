"""Aggregates for the Explore and Topic pages. Every figure is a count or sum over stored records."""

from collections import Counter, defaultdict

from app import models
from app.db import Connection, Row
from app.queries import PARENT_ONLY, _marks, _projects
from app.topics import BY_ID, TOPICS
from ingest.funders import CATEGORIES as FUNDING_TYPES

TREND_START = 2022  # NIH coverage starts here; earlier NSF-only years would make the trend misleading
RECRUITING = ("Recruiting", "Not yet recruiting", "Enrolling by invitation")
SOURCE_INFO = {
    "nih-reporter": ("NIH RePORTER", "https://reporter.nih.gov/", "grants", None),
    "nsf-awards": ("NSF Award Search", "https://www.nsf.gov/awardsearch/", "grants",
                   f"Awards active on or after January {TREND_START}"),
    "usaspending": ("USAspending.gov", "https://www.usaspending.gov/", "grants",
                    f"Other federal agencies' grants active since FY{TREND_START}"),
    "clinicaltrials-gov": ("ClinicalTrials.gov", "https://clinicaltrials.gov/", "clinical trials",
                           f"Sponsored by Temple or run at a Temple site, active or updated since {TREND_START}"),
    "openalex": ("OpenAlex", "https://openalex.org/", "publications",
                 "Articles with a Temple author that report a funder, 2024 onward"),
}


def _ids_by_kind(conn: Connection, ids: list[str] | None = None) -> dict[str, list[str]]:
    out: dict[str, list[str]] = defaultdict(list)
    sql = f"SELECT p.id, p.kind FROM projects p WHERE {PARENT_ONLY}"
    for r in conn.execute(sql):
        out[r["kind"]].append(r["id"])
    if ids is not None:
        keep = set(ids)
        out = defaultdict(list, {k: [i for i in v if i in keep] for k, v in out.items()})
    return out


def _funding(conn: Connection) -> dict[str, int]:
    """Money obligated per grant from TREND_START onward."""
    return {r["project_id"]: r["amount"] or 0 for r in conn.execute(
        "SELECT project_id, SUM(award_amount) AS amount FROM award_years WHERE fiscal_year >= ? GROUP BY project_id",
        (TREND_START,))}


def _topics_by_project(conn: Connection) -> dict[str, set[str]]:
    out: dict[str, set[str]] = defaultdict(set)
    for r in conn.execute("SELECT project_id, topic_id FROM project_topics"):
        out[r["project_id"]].add(r["topic_id"])
    return out


def _rows(conn: Connection, ids: list[str], order: str, limit: int) -> list[Row]:
    if not ids:
        return []
    return conn.execute(f"SELECT * FROM projects WHERE id IN ({_marks(ids)}) ORDER BY {order} LIMIT ?",
                        ids + [limit]).fetchall()


def _college_stats(conn: Connection, kinds: dict[str, list[str]], funding: dict[str, int]) -> list[models.CollegeStat]:
    ids = [i for v in kinds.values() for i in v]
    if not ids:
        return []
    kind_of = {i: k for k, v in kinds.items() for i in v}
    rows = conn.execute(f"""
        SELECT c.college, c.project_id, p.is_active FROM project_colleges c JOIN projects p ON p.id = c.project_id
        WHERE c.project_id IN ({_marks(ids)})
    """, ids).fetchall()
    stats: dict[str, dict] = defaultdict(lambda: {"awards": 0, "active": 0, "funding": 0, "trials": 0, "publications": 0})
    for r in rows:
        s, kind = stats[r["college"]], kind_of[r["project_id"]]
        if kind == "award":
            s["awards"] += 1
            s["active"] += r["is_active"]
            s["funding"] += funding.get(r["project_id"], 0)
        elif kind == "trial":
            s["trials"] += 1
        else:
            s["publications"] += 1
    ranked = sorted(stats.items(), key=lambda kv: (kv[1]["funding"], kv[1]["awards"] + kv[1]["publications"]),
                    reverse=True)
    return [models.CollegeStat(college=c, **s) for c, s in ranked]


def _unassigned(conn: Connection, kinds: dict[str, list[str]], funding: dict[str, int]) -> models.UnassignedStat:
    """Records in scope with no college: the row that makes the college rows add up to the header."""
    kind_of = {i: k for k, v in kinds.items() for i in v}
    if not kind_of:
        return models.UnassignedStat(awards=0, funding=0, trials=0, publications=0)
    assigned = {r["project_id"] for r in conn.execute(
        f"SELECT DISTINCT project_id FROM project_colleges WHERE project_id IN ({_marks(list(kind_of))})", list(kind_of))}
    loose = [pid for pid in kind_of if pid not in assigned]
    counts = Counter(kind_of[pid] for pid in loose)
    return models.UnassignedStat(awards=counts["award"], funding=sum(funding.get(pid, 0) for pid in loose
                                                                     if kind_of[pid] == "award"),
                                 trials=counts["trial"], publications=counts["publication"])


def _trend(conn: Connection, ids: list[str]) -> list[models.YearStat]:
    if not ids:
        return []
    rows = conn.execute(f"""
        SELECT ay.fiscal_year AS fy, p.agency, SUM(ay.award_amount) AS amount, COUNT(DISTINCT ay.project_id) AS awards
        FROM award_years ay JOIN projects p ON p.id = ay.project_id
        WHERE ay.fiscal_year >= ? AND ay.project_id IN ({_marks(ids)})
        GROUP BY ay.fiscal_year, p.agency
    """, [TREND_START] + ids).fetchall()
    return trend_from_rows(rows)


def trend_from_rows(rows: list[Row]) -> list[models.YearStat]:
    """Rows of (fy, agency, amount, awards) to one YearStat per fiscal year."""
    years: dict[int, dict] = defaultdict(lambda: {"nih": 0, "nsf": 0, "other": 0, "awards": 0})
    for r in rows:
        key = r["agency"].lower() if r["agency"] in ("NIH", "NSF") else "other"
        years[r["fy"]][key] += r["amount"] or 0
        years[r["fy"]]["awards"] += r["awards"]
    latest = max(years, default=None)
    return [models.YearStat(fiscalYear=fy, mayBeIncomplete=fy == latest, **years[fy]) for fy in sorted(years)]


def _topic_summaries(conn, kinds: dict[str, list[str]], funding, by_project) -> list[models.TopicSummary]:
    active = {r["id"] for r in conn.execute("SELECT id FROM projects WHERE is_active = 1")}
    stats: dict[str, dict] = defaultdict(lambda: {"awards": 0, "active": 0, "funding": 0, "trials": 0, "publications": 0})
    for kind, ids in kinds.items():
        for pid in ids:
            for t in by_project.get(pid, ()):
                s = stats[t]
                if kind == "award":
                    s["awards"] += 1
                    s["active"] += pid in active
                    s["funding"] += funding.get(pid, 0)
                elif kind == "trial":
                    s["trials"] += 1
                else:
                    s["publications"] += 1
    return sorted(
        (models.TopicSummary(id=t.id, name=t.name, blurb=t.blurb, image=t.image, **stats[t.id])
         for t in TOPICS if any(stats[t.id].values())),
        key=lambda s: (s.active, s.awards, s.trials + s.publications), reverse=True,
    )


def _funding_types(conn: Connection, kinds: dict[str, list[str]]) -> list[models.FundingTypeStat]:
    kind_of = {i: k for k, v in kinds.items() for i in v}
    counts: dict[str, Counter] = defaultdict(Counter)
    for r in conn.execute("SELECT DISTINCT project_id, category FROM project_funders"):
        if r["project_id"] in kind_of:
            counts[r["category"]][kind_of[r["project_id"]]] += 1
    stats = [models.FundingTypeStat(type=c, label=FUNDING_TYPES.get(c, "Other"), awards=n["award"], trials=n["trial"],
                                    publications=n["publication"]) for c, n in counts.items()]
    return sorted(stats, key=lambda s: s.awards + s.trials + s.publications, reverse=True)


def _federal_by_agency(conn: Connection, award_ids: list[str], funding: dict[str, int]) -> list[models.AgencyStat]:
    agency_of = {r["id"]: r["agency"] for r in conn.execute(
        f"SELECT id, agency FROM projects WHERE id IN ({_marks(award_ids)})", award_ids)} if award_ids else {}
    totals: dict[str, dict] = defaultdict(lambda: {"funding": 0, "awards": 0})
    for pid, agency in agency_of.items():
        if funding.get(pid):
            totals[agency]["funding"] += funding[pid]
            totals[agency]["awards"] += 1
    return sorted((models.AgencyStat(agency=a, **t) for a, t in totals.items()), key=lambda s: s.funding, reverse=True)


def _cross_college_ids(conn: Connection, limit: int) -> list[str]:
    """Grants whose investigators belong to more than one college."""
    return [r["project_id"] for r in conn.execute(f"""
        SELECT t.project_id FROM project_team t JOIN researchers r ON r.id = t.researcher_id
        JOIN projects p ON p.id = t.project_id
        WHERE r.college IS NOT NULL AND p.kind = 'award' AND {PARENT_ONLY}
        GROUP BY t.project_id HAVING COUNT(DISTINCT r.college) > 1
        ORDER BY MAX(p.is_active) DESC, MAX(p.latest_fy) DESC, t.project_id LIMIT ?
    """, (limit,))]


def source_summaries(conn: Connection, counts: dict[str, int]) -> list[models.SourceSummary]:
    """One SourceSummary per source with records, given record counts per source id."""
    out = []
    for source, (label, url, kind_label, coverage) in SOURCE_INFO.items():
        if not counts.get(source):
            continue
        if coverage is None:
            lo, hi = conn.execute("""SELECT MIN(fiscal_year), MAX(fiscal_year) FROM award_years ay
                                     JOIN projects p ON p.id = ay.project_id WHERE p.source = ?""", (source,)).fetchone()
            coverage = f"Fiscal years {lo}–{hi}"
        out.append(models.SourceSummary(label=label, url=url, records=counts[source], kind=kind_label, coverage=coverage))
    return out


def last_updated(conn: Connection) -> str | None:
    finished = conn.execute(
        "SELECT finished_at FROM ingest_runs WHERE error IS NULL AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1"
    ).fetchone()
    return finished["finished_at"][:10] if finished else None


def overview(conn: Connection) -> models.Overview:
    kinds = _ids_by_kind(conn)
    funding = _funding(conn)
    by_project = _topics_by_project(conn)
    count = lambda sql, *a: conn.execute(sql, a).fetchone()[0]

    counts = {r["source"]: r["n"] for r in conn.execute(
        f"SELECT p.source, COUNT(*) AS n FROM projects p WHERE {PARENT_ONLY} GROUP BY p.source")}
    cross = _cross_college_ids(conn, 6)
    cross_rows = _rows(conn, cross, "latest_fy DESC, id", 6)
    cross_rows.sort(key=lambda r: cross.index(r["id"]))

    return models.Overview(
        totals=models.Totals(
            awards=len(kinds["award"]),
            active=count(f"SELECT COUNT(*) FROM projects p WHERE p.kind = 'award' AND p.is_active = 1 AND {PARENT_ONLY}"),
            trials=len(kinds["trial"]),
            recruiting=count(f"SELECT COUNT(*) FROM projects WHERE kind = 'trial' AND status_label IN ({_marks(RECRUITING)})",
                             *RECRUITING),
            publications=len(kinds["publication"]),
            researchers=count("SELECT COUNT(*) FROM researchers"),
            colleges=count("SELECT COUNT(DISTINCT college) FROM project_colleges"),
        ),
        sources=source_summaries(conn, counts),
        updatedAt=last_updated(conn),
        byCollege=_college_stats(conn, kinds, funding),
        fundingTypes=_funding_types(conn, kinds),
        federalByAgency=_federal_by_agency(conn, kinds["award"], funding),
        trend=_trend(conn, kinds["award"]),
        topics=_topic_summaries(conn, kinds, funding, by_project),
        recent=_projects(conn, conn.execute(f"""
            SELECT p.* FROM projects p WHERE p.kind = 'award' AND p.is_active = 1 AND {PARENT_ONLY}
            ORDER BY p.start_date DESC NULLS LAST, p.latest_amount DESC NULLS LAST, p.id LIMIT 6""").fetchall()),
        recruiting=_projects(conn, conn.execute(f"""
            SELECT * FROM projects WHERE kind = 'trial' AND status_label IN ({_marks(RECRUITING)})
            ORDER BY status_label = 'Recruiting' DESC, start_date DESC NULLS LAST, id LIMIT 6""", RECRUITING).fetchall()),
        publications=_projects(conn, conn.execute("""
            SELECT * FROM projects WHERE kind = 'publication' AND length(abstract) > 0
            ORDER BY start_date DESC NULLS LAST, id LIMIT 6""").fetchall()),
        crossCollege=_projects(conn, cross_rows),
        unassigned=_unassigned(conn, kinds, funding),
    )


def topic_detail(conn: Connection, topic_id: str) -> models.TopicDetail | None:
    topic = BY_ID.get(topic_id)
    if not topic:
        return None
    all_kinds = _ids_by_kind(conn)
    funding = _funding(conn)
    by_project = _topics_by_project(conn)
    ids = [pid for pid in by_project if topic_id in by_project[pid]]
    kinds = _ids_by_kind(conn, ids)
    ids = [i for v in kinds.values() for i in v]  # parents only
    summary = next((s for s in _topic_summaries(conn, kinds, funding, by_project) if s.id == topic_id),
                   models.TopicSummary(id=topic.id, name=topic.name, blurb=topic.blurb, image=topic.image,
                                       awards=0, active=0, funding=0, trials=0, publications=0))

    funders = [f"{r['name']} ({r['abbreviation']})" for r in conn.execute(
        f"SELECT name, abbreviation FROM research_areas WHERE id IN ({_marks(topic.areas)}) ORDER BY name",
        topic.areas)]

    people: list[models.TopicPerson] = []
    if ids:
        for r in conn.execute(f"""
            SELECT r.id, r.name, r.college, r.department, COUNT(DISTINCT t.project_id) AS records
            FROM project_team t JOIN researchers r ON r.id = t.researcher_id
            WHERE t.project_id IN ({_marks(ids)})
            GROUP BY r.id ORDER BY records DESC, r.name LIMIT 12
        """, ids):
            people.append(models.TopicPerson(researcherId=r["id"], name=r["name"], college=r["college"],
                                             department=r["department"] or "", records=r["records"],
                                             awards=r["records"]))

    # Related topics: the ones that share the most people with this one.
    shared: Counter = Counter()
    if ids:
        people_here = {r["researcher_id"] for r in conn.execute(
            f"SELECT researcher_id FROM project_team WHERE project_id IN ({_marks(ids)}) AND researcher_id IS NOT NULL", ids)}
        for r in conn.execute("SELECT project_id, researcher_id FROM project_team WHERE researcher_id IS NOT NULL"):
            if r["researcher_id"] in people_here:
                for t in by_project.get(r["project_id"], ()):
                    if t != topic_id:
                        shared[t] += 1
    summaries = {s.id: s for s in _topic_summaries(conn, all_kinds, funding, by_project)}
    related = [summaries[t] for t, _ in shared.most_common() if t in summaries][:3]

    return models.TopicDetail(
        topic=summary,
        funders=funders,
        byCollege=_college_stats(conn, kinds, funding),
        trend=_trend(conn, kinds["award"]),
        people=people,
        projects=_projects(conn, _rows(conn, kinds["award"], "is_active DESC, latest_amount DESC NULLS LAST, id", 10)),
        trials=_projects(conn, _rows(conn, kinds["trial"], "is_active DESC, start_date DESC NULLS LAST, id", 6)),
        publications=_projects(conn, _rows(conn, kinds["publication"], "start_date DESC NULLS LAST, id", 6)),
        related=related,
        unassigned=_unassigned(conn, kinds, funding),
    )
