"""Researcher profiles. Every count is a SQL aggregate over stored records; every sentence is a template.

A profile lists every record the person is on, including NIH center-grant components they lead: those are
their own records with their own source pages. Site-wide totals count parent awards only, so a profile's
grant count can be higher than the number of grants it adds to a college or topic total.
"""

import sqlite3

from app import models
from app.colleges import COLLEGE_NAMES
from app.explore import SOURCE_INFO
from app.queries import KIND_LABELS, _distinctive_terms, _initials, _projects
from app.topics import BY_ID as TOPICS_BY_ID

COLLABORATOR_LIMIT = 12
FOCUS_LIMIT = 6


def _source_label(source: str) -> str:
    return SOURCE_INFO.get(source, (source,))[0]


def _plural(n: int, kind: str) -> str:
    label = KIND_LABELS[kind].lower()
    return f"{n} {label if n != 1 else label.rstrip('s')}"


def identity_note(confidence: str, sources: list[str]) -> str:
    names = " and ".join(sources) or "one source"
    if confidence == "high":
        return f"Every record here is linked to the same {names} person ID."
    if confidence == "medium":
        return f"{names} lists this person by name only, so records were matched by name within that source."
    return (f"This profile combines records from {names} that list the same name. Name matches are not "
            "confirmed: some records may belong to a different person with the same name.")


def _records(conn: sqlite3.Connection, researcher_id: str) -> list[sqlite3.Row]:
    return conn.execute("""
        SELECT p.*, t.role FROM project_team t JOIN projects p ON p.id = t.project_id
        WHERE t.researcher_id = ?
        ORDER BY p.start_year DESC, p.latest_fy DESC, p.kind, p.id
    """, (researcher_id,)).fetchall()


def projects(conn: sqlite3.Connection, researcher_id: str) -> list[models.ResearcherProject] | None:
    rows = _records(conn, researcher_id)
    if not rows:
        return None
    return [models.ResearcherProject(role=r["role"], project=p) for r, p in zip(rows, _projects(conn, rows))]


def collaborators(conn: sqlite3.Connection, researcher_id: str,
                  limit: int = COLLABORATOR_LIMIT) -> list[models.ResearcherCollaborator]:
    """People listed on the same records, most shared records first. Each link cites the shared records."""
    me = conn.execute("SELECT college FROM researchers WHERE id = ?", (researcher_id,)).fetchone()
    my_college = me["college"] if me else None
    rows = conn.execute("""
        SELECT r.id, r.name, r.college, r.department, r.identity_confidence,
               COUNT(DISTINCT t2.project_id) AS shared, GROUP_CONCAT(DISTINCT t2.project_id) AS ids
        FROM project_team t1
        JOIN project_team t2 ON t2.project_id = t1.project_id AND t2.researcher_id != t1.researcher_id
        JOIN researchers r ON r.id = t2.researcher_id
        WHERE t1.researcher_id = ?
        GROUP BY r.id ORDER BY shared DESC, r.name LIMIT ?
    """, (researcher_id, limit)).fetchall()
    return [
        models.ResearcherCollaborator(
            researcherId=r["id"],
            name=r["name"],
            college=r["college"],
            department=r["department"] or "",
            identityConfidence=r["identity_confidence"],
            sharedRecords=r["shared"],
            crossCollege=bool(my_college and r["college"] and r["college"] != my_college),
            projectIds=sorted(r["ids"].split(",")),
        )
        for r in rows
    ]


def profile(conn: sqlite3.Connection, researcher_id: str) -> models.ResearcherProfile | None:
    """None when the researcher is unknown or no stored record lists them (both are a 404)."""
    row = conn.execute("SELECT * FROM researchers WHERE id = ?", (researcher_id,)).fetchone()
    if not row:
        return None
    records = projects(conn, researcher_id)
    if not records:
        return None

    kinds = {r["kind"]: r["n"] for r in conn.execute("""
        SELECT p.kind, COUNT(DISTINCT p.id) AS n FROM project_team t JOIN projects p ON p.id = t.project_id
        WHERE t.researcher_id = ? GROUP BY p.kind
    """, (researcher_id,))}
    counts = models.ResearcherCounts(grants=kinds.get("award", 0), trials=kinds.get("trial", 0),
                                     publications=kinds.get("publication", 0))

    by_year = [
        models.ResearcherYear(year=y["start_year"], grants=y["grants"], trials=y["trials"], publications=y["pubs"])
        for y in conn.execute("""
            SELECT p.start_year,
                   COUNT(DISTINCT CASE WHEN p.kind = 'award' THEN p.id END) AS grants,
                   COUNT(DISTINCT CASE WHEN p.kind = 'trial' THEN p.id END) AS trials,
                   COUNT(DISTINCT CASE WHEN p.kind = 'publication' THEN p.id END) AS pubs
            FROM project_team t JOIN projects p ON p.id = t.project_id
            WHERE t.researcher_id = ? GROUP BY p.start_year ORDER BY p.start_year
        """, (researcher_id,))
    ]

    focus = [
        models.ResearcherFocus(id=r["topic_id"], name=TOPICS_BY_ID[r["topic_id"]].name,
                               image=TOPICS_BY_ID[r["topic_id"]].image, records=r["n"])
        for r in conn.execute("""
            SELECT pt.topic_id, COUNT(DISTINCT pt.project_id) AS n
            FROM project_topics pt JOIN project_team t ON t.project_id = pt.project_id
            WHERE t.researcher_id = ? GROUP BY pt.topic_id ORDER BY n DESC, pt.topic_id
        """, (researcher_id,))
        if r["topic_id"] in TOPICS_BY_ID
    ][:FOCUS_LIMIT]

    sources = []
    for r in conn.execute("""
        SELECT p.source, COUNT(DISTINCT p.id) AS n, MAX(p.updated_at) AS last_seen
        FROM project_team t JOIN projects p ON p.id = t.project_id
        WHERE t.researcher_id = ? GROUP BY p.source ORDER BY n DESC, p.source
    """, (researcher_id,)):
        label, url = SOURCE_INFO.get(r["source"], (r["source"], ""))[:2]
        sources.append(models.ResearcherSource(label=label, url=url, records=r["n"], lastSeen=r["last_seen"] or None))

    aliases = [
        models.ResearcherAlias(source=_source_label(a["source"]), name=a["source_name"],
                               sourcePersonId=a["source_person_id"], evidence=a["evidence"], lastSeen=a["last_seen"])
        for a in conn.execute("""SELECT * FROM researcher_aliases WHERE researcher_id = ?
                                 ORDER BY evidence = 'same-name-across-sources', source""", (researcher_id,))
    ]
    alias_sources = list(dict.fromkeys(a.source for a in aliases)) or [s.label for s in sources]

    roles = [r["role"] for r in conn.execute(
        "SELECT role, COUNT(*) AS n FROM project_team WHERE researcher_id = ? GROUP BY role ORDER BY n DESC, role",
        (researcher_id,))]
    years = conn.execute("""SELECT MIN(p.start_year), MAX(p.start_year) FROM project_team t
                            JOIN projects p ON p.id = t.project_id WHERE t.researcher_id = ?""",
                         (researcher_id,)).fetchone()
    parts = [_plural(n, k) for k, n in (("award", counts.grants), ("trial", counts.trials),
                                        ("publication", counts.publications)) if n]
    listed = ", ".join(parts[:-1]) + " and " + parts[-1] if len(parts) > 1 else parts[0]
    span = f" starting {years[0]}" if years[0] == years[1] else f" starting between {years[0]} and {years[1]}"
    summary = f"Listed on {listed} in public Temple records{span}."

    return models.ResearcherProfile(
        id=row["id"],
        name=row["name"],
        initials=_initials(row["name"]),
        college=row["college"],
        department=row["department"] or "",
        verified=bool(row["verified"]),
        identityConfidence=row["identity_confidence"],
        identityNote=identity_note(row["identity_confidence"], alias_sources),
        orcid=row["orcid"],
        roles=roles,
        summary=summary,
        focus=focus,
        terms=_distinctive_terms(conn, [r.project.id for r in records]),
        counts=counts,
        byYear=by_year,
        projects=records,
        collaborators=collaborators(conn, researcher_id),
        aliases=aliases,
        sources=sources,
        about=("Built from public records. This profile has not been confirmed by the researcher." if not row["verified"]
               else "Confirmed by the researcher."),
    )


PEOPLE_PAGE_SIZE = 24


def directory(conn: sqlite3.Connection, q: str = "", colleges: list[str] | None = None, kind: str | None = None,
              sort: str = "records", page: int = 1) -> models.PeopleResponse:
    """People with at least one record. Name/department search is a parameterized LIKE; counts are SQL."""
    where, params = ["EXISTS (SELECT 1 FROM project_team t WHERE t.researcher_id = r.id)"], []
    q = q.strip()
    if q:
        where.append("(r.name LIKE ? OR COALESCE(r.department, '') LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    if kind in KIND_LABELS:
        where.append("EXISTS (SELECT 1 FROM project_team t JOIN projects p ON p.id = t.project_id "
                     "WHERE t.researcher_id = r.id AND p.kind = ?)")
        params.append(kind)
    base_where, base_params = " AND ".join(where), list(params)
    if colleges:
        where.append(f"r.college IN ({','.join('?' * len(colleges))})")
        params += colleges
    sql_where = " AND ".join(where)

    total = conn.execute(f"SELECT COUNT(*) FROM researchers r WHERE {sql_where}", params).fetchone()[0]
    order = "r.name COLLATE NOCASE" if sort == "name" else "records DESC, r.name COLLATE NOCASE"
    page = max(page, 1)
    rows = conn.execute(f"""
        SELECT r.id, r.name, r.college, r.department, r.identity_confidence,
               COUNT(DISTINCT t.project_id) AS records,
               COUNT(DISTINCT CASE WHEN p.kind = 'award' THEN p.id END) AS grants,
               COUNT(DISTINCT CASE WHEN p.kind = 'trial' THEN p.id END) AS trials,
               COUNT(DISTINCT CASE WHEN p.kind = 'publication' THEN p.id END) AS publications
        FROM researchers r JOIN project_team t ON t.researcher_id = r.id JOIN projects p ON p.id = t.project_id
        WHERE {sql_where} GROUP BY r.id ORDER BY {order} LIMIT ? OFFSET ?
    """, params + [PEOPLE_PAGE_SIZE, (page - 1) * PEOPLE_PAGE_SIZE]).fetchall()

    ids = [r["id"] for r in rows]
    topics: dict[str, list[models.TopicRef]] = {i: [] for i in ids}
    if ids:
        for t in conn.execute(f"""
            SELECT t.researcher_id, pt.topic_id, COUNT(DISTINCT pt.project_id) AS n
            FROM project_team t JOIN project_topics pt ON pt.project_id = t.project_id
            WHERE t.researcher_id IN ({','.join('?' * len(ids))})
            GROUP BY t.researcher_id, pt.topic_id ORDER BY n DESC, pt.topic_id
        """, ids):
            if t["topic_id"] in TOPICS_BY_ID and len(topics[t["researcher_id"]]) < 2:
                topics[t["researcher_id"]].append(models.TopicRef(id=t["topic_id"], name=TOPICS_BY_ID[t["topic_id"]].name))

    facets = conn.execute(f"""SELECT r.college, COUNT(*) AS n FROM researchers r
                              WHERE {base_where} AND r.college IS NOT NULL GROUP BY r.college ORDER BY n DESC""",
                          base_params).fetchall()
    return models.PeopleResponse(
        query=q, total=total, page=page, pageSize=PEOPLE_PAGE_SIZE, sort="name" if sort == "name" else "records",
        results=[
            models.PersonSummary(
                researcherId=r["id"], name=r["name"], initials=_initials(r["name"]), college=r["college"],
                department=r["department"] or "", identityConfidence=r["identity_confidence"],
                counts=models.ResearcherCounts(grants=r["grants"], trials=r["trials"], publications=r["publications"]),
                topics=topics[r["id"]],
            )
            for r in rows
        ],
        colleges=[models.FacetValue(value=f["college"], label=COLLEGE_NAMES[f["college"]], count=f["n"]) for f in facets],
    )
