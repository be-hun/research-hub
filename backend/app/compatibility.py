"""Deterministic compatibility matches for active research.

Scores are database-derived. The model is intentionally not involved: shared topics and
stored subject terms are explainable evidence, not a claim that two people should work
together.
"""

import sqlite3
from collections import Counter

from app import models
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


def _topic_counts(conn: sqlite3.Connection, project_ids: list[str]) -> Counter:
    if not project_ids:
        return Counter()
    marks = ",".join("?" * len(project_ids))
    return Counter(r["topic_id"] for r in conn.execute(
        f"SELECT topic_id FROM project_topics WHERE project_id IN ({marks})", project_ids
    ))


def _terms(conn: sqlite3.Connection, project_ids: list[str]) -> set[str]:
    if not project_ids:
        return set()
    marks = ",".join("?" * len(project_ids))
    rows = conn.execute(f"SELECT title, abstract, terms FROM projects WHERE id IN ({marks})", project_ids)
    words: set[str] = set()
    for row in rows:
        words.update(_tokens(" ".join((row["title"] or "", row["abstract"] or "", row["terms"] or ""))))
    return words


def _matches(
    conn: sqlite3.Connection,
    *,
    researcher_id: str,
    name: str,
    college: str | None,
    topic_ids: set[str],
    terms: set[str],
    synthetic: bool = False,
) -> models.ResearcherCompatibility:
    rows = conn.execute(f"""
        SELECT p.* FROM projects p
        WHERE p.kind IN ('award', 'trial') AND p.is_active = 1 AND {PARENT_ONLY}
        ORDER BY p.latest_fy DESC, p.start_year DESC, p.id
    """).fetchall()
    existing = {
        r["project_id"] for r in conn.execute(
            "SELECT project_id FROM project_team WHERE researcher_id = ?", (researcher_id,)
        )
    } if not synthetic else set()
    candidates = []
    for row in rows:
        if row["id"] in existing:
            continue
        project_topics = {r["topic_id"] for r in conn.execute(
            "SELECT topic_id FROM project_topics WHERE project_id = ?", (row["id"],)
        )}
        project_terms = set(_tokens(" ".join((row["title"] or "", row["abstract"] or "", row["terms"] or ""))))
        shared_topics = topic_ids & project_topics
        shared_terms = terms & project_terms
        project_colleges = {r["college"] for r in conn.execute(
            "SELECT college FROM project_colleges WHERE project_id = ?", (row["id"],)
        )}
        score = min(60, len(shared_topics) * 30) + min(25, len(shared_terms) * 5)
        if college and college in project_colleges:
            score += 10
        if not score:
            continue
        reasons = []
        if shared_topics:
            labels = [BY_ID[t].name for t in sorted(shared_topics) if t in BY_ID]
            if labels:
                reasons.append("Shares " + ", ".join(labels))
        if shared_terms:
            reasons.append("Shares stored terms: " + ", ".join(sorted(shared_terms)[:3]))
        if college and college in project_colleges:
            reasons.append("Linked to the same college")
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


def for_researcher(conn: sqlite3.Connection, researcher_id: str) -> models.ResearcherCompatibility | None:
    row = conn.execute("SELECT id, name, college FROM researchers WHERE id = ?", (researcher_id,)).fetchone()
    if not row:
        return None
    project_ids = [r["project_id"] for r in conn.execute(
        "SELECT project_id FROM project_team WHERE researcher_id = ?", (researcher_id,)
    )]
    topic_ids = set(_topic_counts(conn, project_ids))
    return _matches(
        conn,
        researcher_id=row["id"],
        name=row["name"],
        college=row["college"],
        topic_ids=topic_ids,
        terms=_terms(conn, project_ids),
    )


def demo_profile(conn: sqlite3.Connection) -> models.DemoResearcherProfile:
    interests = [models.TopicRef(id=t, name=BY_ID[t].name) for t in DEMO_INTERESTS if t in BY_ID]
    compatibility = _matches(
        conn,
        researcher_id=DEMO_ID,
        name=DEMO_NAME,
        college=DEMO_COLLEGE,
        topic_ids=set(DEMO_INTERESTS),
        terms=set(_tokens(" ".join(DEMO_TERMS))),
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
        compatibility=compatibility,
    )
