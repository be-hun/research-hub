"""Deterministic compatibility matches for active research.

Scores are database-derived. The model is intentionally not involved: shared topics and
stored subject terms are explainable evidence, not a claim that two people should work
together.
"""

from collections import Counter, defaultdict

from app import models
from app.db import Connection, Row
from app.queries import PARENT_ONLY, _projects, _tokens
from app.topics import BY_ID

MATCH_LIMIT = 6
DEMO_ID = "demo-maya-patel"
DEMO_NAME = "Maya Patel"
DEMO_COLLEGE = "engineering"
DEMO_DEPARTMENT = "Biomedical Engineering"
DEMO_BIO = "Synthetic demo researcher created to show how active-research compatibility could work."
DEMO_INTERESTS = ("heart-lung-blood", "engineering", "computing-ai", "life-sciences", "aging")
DEMO_TERMS = (
    "biomedical", "cardiac", "device", "heart", "machine learning", "sensors", "gene therapy",
    "alzheimer", "down syndrome",
)


def _topic_counts(conn: Connection, project_ids: list[str]) -> Counter:
    if not project_ids:
        return Counter()
    marks = ",".join("?" * len(project_ids))
    return Counter(r["topic_id"] for r in conn.execute(
        f"SELECT topic_id FROM project_topics WHERE project_id IN ({marks})", project_ids
    ))


def _terms(conn: Connection, project_ids: list[str]) -> set[str]:
    if not project_ids:
        return set()
    marks = ",".join("?" * len(project_ids))
    rows = conn.execute(f"SELECT title, abstract, terms FROM projects WHERE id IN ({marks})", project_ids)
    words: set[str] = set()
    for row in rows:
        words.update(_tokens(" ".join((row["title"] or "", row["abstract"] or "", row["terms"] or ""))))
    return words


def _project_data(conn: Connection, rows: list[Row]) -> dict[str, dict]:
    ids = [row["id"] for row in rows]
    if not ids:
        return {}
    marks = ",".join("?" * len(ids))
    topics = defaultdict(set)
    for row in conn.execute(
        f"SELECT project_id, topic_id FROM project_topics WHERE project_id IN ({marks})", ids
    ):
        topics[row["project_id"]].add(row["topic_id"])
    colleges = defaultdict(set)
    for row in conn.execute(
        f"SELECT project_id, college FROM project_colleges WHERE project_id IN ({marks})", ids
    ):
        colleges[row["project_id"]].add(row["college"])
    return {
        row["id"]: {
            "row": row,
            "topics": topics[row["id"]],
            "colleges": colleges[row["id"]],
            "terms": set(_tokens(" ".join((row["title"] or "", row["abstract"] or "", row["terms"] or "")))),
        }
        for row in rows
    }


def _profile_terms(profile: models.ProfileInput) -> set[str]:
    return set(_tokens(" ".join(profile.terms)))


def _score(data: dict, profile: models.ProfileInput, *, outside_boost: bool = False) -> tuple[int, set[str], set[str], list[str]]:
    shared_topics = set(profile.topics) & data["topics"]
    shared_terms = _profile_terms(profile) & data["terms"]
    score = min(60, len(shared_topics) * 30) + min(25, len(shared_terms) * 5)
    if profile.college and profile.college in data["colleges"]:
        score += 10
    if outside_boost and profile.college and data.get("college") and data["college"] != profile.college:
        score += 5
    if not score:
        return 0, shared_topics, shared_terms, []
    reasons = []
    labels = [BY_ID[t].name for t in sorted(shared_topics) if t in BY_ID]
    if labels:
        reasons.append("Shares " + ", ".join(labels))
    if shared_terms:
        reasons.append("Shares stored terms: " + ", ".join(sorted(shared_terms)[:3]))
    if profile.college and profile.college in data["colleges"]:
        reasons.append("Linked to the same college")
    if outside_boost and profile.college and data.get("college") and data["college"] != profile.college:
        reasons.append("Expands beyond your college")
    return min(score, 100), shared_topics, shared_terms, reasons


def _matches(
    conn: Connection,
    *,
    researcher_id: str,
    name: str,
    profile: models.ProfileInput,
    synthetic: bool = False,
    kinds: tuple[str, ...] = ("award", "trial"),
    trial_statuses: tuple[str, ...] | None = None,
) -> models.ResearcherCompatibility:
    marks = ",".join("?" * len(kinds))
    params: list[str] = list(kinds)
    status_clause = ""
    if trial_statuses:
        status_marks = ",".join("?" * len(trial_statuses))
        status_clause = f" AND (p.kind != 'trial' OR p.status_label IN ({status_marks}))"
        params.extend(trial_statuses)
    rows = conn.execute(f"""
        SELECT p.* FROM projects p
        WHERE p.kind IN ({marks}) AND p.is_active = 1 {status_clause} AND {PARENT_ONLY}
        ORDER BY p.latest_fy DESC, p.start_year DESC, p.id
    """, params).fetchall()
    data = _project_data(conn, rows)
    existing = {
        r["project_id"] for r in conn.execute(
            "SELECT project_id FROM project_team WHERE researcher_id = ?", (researcher_id,)
        )
    } if not synthetic else set()
    candidates = []
    for row in rows:
        if row["id"] in existing:
            continue
        score, shared_topics, _, reasons = _score(data[row["id"]], profile)
        if not score:
            continue
        candidates.append((score, row, shared_topics, reasons))
    candidates.sort(key=lambda item: (-item[0], -item[1]["latest_fy"], item[1]["id"]))
    matches = []
    for score, row, shared_topics, reasons in candidates[:MATCH_LIMIT]:
        matches.append(models.CompatibilityMatch(
            project=_projects(conn, [row])[0],
            score=min(score, 100),
            reasons=reasons,
            sharedTopics=[
                models.TopicRef(id=t, name=BY_ID[t].name)
                for t in sorted(shared_topics) if t in BY_ID
            ],
        ))
    return models.ResearcherCompatibility(
        researcherId=researcher_id,
        researcherName=name,
        isSynthetic=synthetic,
        matches=matches,
    )


def for_researcher(conn: Connection, researcher_id: str) -> models.ResearcherCompatibility | None:
    row = conn.execute("SELECT id, name, college FROM researchers WHERE id = ?", (researcher_id,)).fetchone()
    if not row:
        return None
    project_ids = [r["project_id"] for r in conn.execute(
        "SELECT project_id FROM project_team WHERE researcher_id = ?", (researcher_id,)
    )]
    profile = models.ProfileInput(
        college=row["college"],
        # Most frequent topics first; terms alphabetically. Both used to follow set/row order, which changed
        # between processes (Python randomizes set order per process) and between databases.
        topics=[t for t, _ in sorted(_topic_counts(conn, project_ids).items(), key=lambda kv: (-kv[1], kv[0]))][:8],
        terms=sorted(_terms(conn, project_ids))[:12],
    )
    return _matches(
        conn,
        researcher_id=row["id"],
        name=row["name"],
        profile=profile,
    )


def demo_profile(conn: Connection) -> models.DemoResearcherProfile:
    interests = [models.TopicRef(id=t, name=BY_ID[t].name) for t in DEMO_INTERESTS if t in BY_ID]
    compatibility = _matches(
        conn,
        researcher_id=DEMO_ID,
        name=DEMO_NAME,
        profile=models.ProfileInput(college=DEMO_COLLEGE, topics=list(DEMO_INTERESTS), terms=list(DEMO_TERMS)),
        synthetic=True,
    )
    return models.DemoResearcherProfile(
        id=DEMO_ID,
        name=DEMO_NAME,
        initials="MP",
        college=DEMO_COLLEGE,
        department=DEMO_DEPARTMENT,
        bio=DEMO_BIO,
        interests=interests,
        terms=list(DEMO_TERMS),
        compatibility=compatibility,
    )


def _profile_match(
    conn: Connection, profile: models.ProfileInput, project_ids: list[str], limit: int = MATCH_LIMIT
) -> models.ResearcherMatch:
    if not project_ids:
        return models.ResearcherMatch(score=0, reasons=[], sharedTopics=[], records=[])
    marks = ",".join("?" * len(project_ids))
    rows = conn.execute(f"SELECT * FROM projects WHERE id IN ({marks})", project_ids).fetchall()
    data = _project_data(conn, rows)
    ranked = []
    for row in rows:
        score, topics, _, reasons = _score(data[row["id"]], profile)
        if score:
            ranked.append((score, row, topics, reasons))
    ranked.sort(key=lambda item: (-item[0], -item[1]["latest_fy"], item[1]["id"]))
    chosen = ranked[:limit]
    return models.ResearcherMatch(
        score=min(sum(item[0] for item in chosen), 100),
        reasons=list(dict.fromkeys(reason for _, _, _, reasons in chosen for reason in reasons)),
        sharedTopics=[
            models.TopicRef(id=topic, name=BY_ID[topic].name)
            for topic in sorted({topic for _, _, topics, _ in chosen for topic in topics} & set(BY_ID))
        ],
        records=_projects(conn, [row for _, row, _, _ in chosen]),
    )


def match_researcher(
    conn: Connection, researcher_id: str, profile: models.ProfileInput
) -> models.ResearcherMatch | None:
    if not conn.execute("SELECT 1 FROM researchers WHERE id = ?", (researcher_id,)).fetchone():
        return None
    ids = [row["project_id"] for row in conn.execute(
        "SELECT project_id FROM project_team WHERE researcher_id = ?", (researcher_id,)
    )]
    return _profile_match(conn, profile, ids)


def match_projects(conn: Connection, profile: models.ProfileInput, ids: list[str]) -> models.ProjectMatches:
    if not ids:
        return models.ProjectMatches(matches=[])
    marks = ",".join("?" * len(ids))
    rows = conn.execute(f"SELECT * FROM projects WHERE id IN ({marks})", ids).fetchall()
    data = _project_data(conn, rows)
    matches = []
    for row in rows:
        score, _, _, reasons = _score(data[row["id"]], profile)
        if score:
            matches.append(models.ProjectMatch(id=row["id"], score=score, reasons=reasons))
    matches.sort(key=lambda item: (-item.score, item.id))
    return models.ProjectMatches(matches=matches)


def _collaborators(conn: Connection, profile: models.ProfileInput) -> list[models.CollaboratorMatch]:
    rows = conn.execute(f"""
        SELECT p.* FROM projects p
        WHERE p.kind IN ('award', 'trial') AND p.is_active = 1 AND {PARENT_ONLY}
        ORDER BY p.latest_fy DESC, p.start_year DESC, p.id
    """).fetchall()
    if not rows:
        return []
    data = _project_data(conn, rows)
    ids = [row["id"] for row in rows]
    marks = ",".join("?" * len(ids))
    team = conn.execute(f"""
        SELECT t.project_id, t.researcher_id
        FROM project_team t
        WHERE t.project_id IN ({marks}) AND t.researcher_id IS NOT NULL
    """, ids).fetchall()
    researcher_ids = sorted({row["researcher_id"] for row in team})
    if not researcher_ids:
        return []
    rmarks = ",".join("?" * len(researcher_ids))
    researchers = {
        row["id"]: row for row in conn.execute(
            f"SELECT id, name, college, department FROM researchers WHERE id IN ({rmarks})", researcher_ids
        )
    }
    by_researcher: dict[str, list[Row]] = defaultdict(list)
    for member in team:
        if member["researcher_id"] in researchers:
            by_researcher[member["researcher_id"]].append(member)

    ranked = []
    for researcher_id, members in by_researcher.items():
        researcher = researchers[researcher_id]
        score = 0
        reasons: list[str] = []
        topics: set[str] = set()
        citations: list[str] = []
        for member in members:
            project = data[member["project_id"]]
            project_data = dict(project)
            project_data["college"] = researcher["college"]
            points, shared, _, evidence = _score(project_data, profile, outside_boost=True)
            if points:
                score = max(score, points)
                topics.update(shared)
                reasons.extend(evidence)
                citations.append(member["project_id"])
        if score:
            ranked.append((score, researcher, list(dict.fromkeys(reasons)), sorted(set(citations)), topics))
    ranked.sort(key=lambda item: (-item[0], item[1]["name"].lower(), item[1]["id"]))
    return [
        models.CollaboratorMatch(
            researcherId=researcher["id"],
            name=researcher["name"],
            initials="".join(part[0] for part in researcher["name"].split()[:2]).upper(),
            college=researcher["college"],
            title=researcher["department"] or "Researcher",
            score=score,
            reasons=reasons,
            citations=citations,
            sharedTopics=[BY_ID[t].name for t in topics if t in BY_ID],
        )
        for score, researcher, reasons, citations, topics in ranked[:MATCH_LIMIT]
    ]


def for_you(conn: Connection, profile: models.ProfileInput) -> models.ForYou:
    recruiting = ("Recruiting", "Not yet recruiting", "Enrolling by invitation")
    trials = _matches(
        conn, researcher_id="", name="", profile=profile, synthetic=True,
        kinds=("trial",), trial_statuses=recruiting,
    ).matches
    grants = _matches(
        conn, researcher_id="", name="", profile=profile, synthetic=True,
        kinds=("award",),
    ).matches
    return models.ForYou(trials=trials, grants=grants, collaborators=_collaborators(conn, profile))
