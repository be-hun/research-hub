"""Deterministic compatibility matches for active research.

Scores are database-derived. The model is intentionally not involved: shared topics and stored subject terms are
explainable evidence, not a claim that two people should work together.

Every endpoint (researcher compatibility, For you, the demo profile, the match endpoints and the people list) scores
a record with the same `_score`, against one in-memory corpus of normalized record text built per data version.
People are ranked once, by `rank_people`: a person's points are their best eligible record's score, and For you,
the full people list and a researcher's own page all read their score and rank from that one ranking.
"""

import math
import re
import threading
import unicodedata
from collections import Counter, OrderedDict, defaultdict

from app import models
from app.db import Connection, Row
from app.queries import PARENT_ONLY, STOPWORDS, _distinctive_terms, _projects
from app.topics import BY_ID

MATCH_LIMIT = 6
MIN_MATCH_SCORE = 12
PEOPLE_PAGE_SIZE = 20
PEOPLE_CACHE_SIZE = 32  # rankings kept, one per (profile, data version)
# Bands put a score in words; the number is a capped sum of evidence, not a percentage. Cutoffs from the spread of
# people scores on the 4,004-record import (November 2026):
#   Maya's default profile, 1,211 people, 12-52: 40+ is the top 10.1%, 24+ the top 45%.
#   {"topics": ["addiction"], "terms": ["opioid"]}, 277 people, 14-29: none at 40, 13% at 24+.
#   {"topics": ["cancer"], "terms": ["immunotherapy"]}, 300 people, 14-24: none at 40, 7% at 24+.
# Strong takes several shared topics or a topic and rare phrases; 24 is one funder-defined shared topic, so sharing
# one field the funder names is Good. A narrow one-topic profile tops out at Good, which is what its evidence says.
STRONG_OVERLAP = 40
GOOD_OVERLAP = 24
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

# Words too common in research text to count as a shared interest on their own. Inside a phrase they still count:
# "gene therapy" matches as a phrase, "therapy" alone does not.
GENERIC = STOPWORDS | {
    "analysis", "approach", "based", "care", "cell", "cells", "center", "clinical", "data", "development",
    "disease", "diseases", "effect", "effects", "health", "human", "learning", "method", "methods", "model",
    "models", "new", "outcome", "outcomes", "patient", "patients", "program", "role", "syndrome", "system",
    "systems", "therapy", "treatment", "trial", "use", "university", "process", "molecular", "improved",
    "improve", "novel", "mechanism", "function", "factor", "level", "high", "low", "risk", "response",
    "target", "potential", "technology", "measure", "test", "testing", "goal", "aim", "award", "grant",
}
# A word or phrase found in more than this share of records says little about a shared field.
MAX_WORD_SHARE = 0.08
MAX_PHRASE_SHARE = 0.2
MIN_RECORDS_FOR_SHARE = 50  # below this, every word looks common; the share test only applies to real data
TOPIC_POINTS, TOPIC_CAP = 24, 60
TERM_MIN, TERM_MAX, TERM_CAP = 2.0, 8.0, 32
PHRASE_BONUS = 1.5
SAME_COLLEGE, OTHER_COLLEGE = 8, 5


# ---------- text ----------

def _singular(word: str) -> str:
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 3 and word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def normalize(text: str) -> str:
    """Lowercase words without accents or punctuation, plurals folded, so "Sensors," matches "sensor"."""
    plain = "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))
    return " ".join(_singular(w) for w in re.findall(r"[a-z0-9]+", plain.replace("'", "").replace("\u2019", "")))


# ---------- the corpus ----------

class _Corpus:
    """Normalized text, topics (with how each was tagged) and colleges for every record, and phrase rarity."""

    def __init__(self, conn: Connection):
        self.text: dict[str, str] = {}
        for row in conn.execute("SELECT id, title, abstract, terms FROM projects"):
            self.text[row["id"]] = f" {normalize(' '.join((row['title'] or '', row['abstract'] or '', row['terms'] or '')))} "
        self.topics: dict[str, dict[str, set[str]]] = defaultdict(dict)
        for row in conn.execute("SELECT project_id, topic_id, method FROM project_topics"):
            self.topics[row["project_id"]].setdefault(row["topic_id"], set()).add(row["method"])
        self.colleges: dict[str, set[str]] = defaultdict(set)
        for row in conn.execute("SELECT project_id, college FROM project_colleges"):
            self.colleges[row["project_id"]].add(row["college"])
        self.size = max(1, len(self.text))
        self._frequency: dict[str, int] = {}
        self._lock = threading.Lock()

    def frequency(self, phrase: str) -> int:
        """How many records contain the phrase, across the whole database."""
        with self._lock:
            if phrase not in self._frequency:
                needle = f" {phrase} "
                self._frequency[phrase] = sum(needle in text for text in self.text.values())
            return self._frequency[phrase]

    def weight(self, phrase: str) -> float:
        """2 for a phrase in nearly every record up to 8 for one in a single record (log-scaled rarity)."""
        share = math.log(self.size / max(1, self.frequency(phrase))) / math.log(max(2, self.size))
        return TERM_MIN + (TERM_MAX - TERM_MIN) * max(0.0, min(1.0, share))


_corpus_lock = threading.Lock()
_corpus_cache: dict[tuple, _Corpus] = {}


def data_version(conn: Connection) -> tuple:
    """Identifies the loaded data: the schema (one per test), the record count and the last finished import.

    Every import adds an ingest_runs row, so a re-import that only changes topics or colleges is noticed too. The
    run counts once it has finished: its row exists while the import is still loading.
    """
    return tuple(conn.execute("""
        SELECT current_schema(), (SELECT COUNT(*) FROM projects),
               (SELECT MAX(id) FROM ingest_runs WHERE error IS NULL AND finished_at IS NOT NULL)
    """).fetchone())


def corpus(conn: Connection) -> _Corpus:
    """The corpus for the current data, rebuilt when the data version changes."""
    key = data_version(conn)
    with _corpus_lock:
        if key in _corpus_cache:
            return _corpus_cache[key]
    built = _Corpus(conn)
    with _corpus_lock:
        _corpus_cache.clear()  # one data version at a time
        _corpus_cache[key] = built
    return built


# ---------- the profile ----------

class _Profile:
    """A profile's topics and the interest phrases worth matching on."""

    def __init__(self, profile: models.ProfileInput, data: _Corpus, topic_strength: dict[str, float] | None = None):
        self.college = profile.college
        self.topics = set(profile.topics)
        self.topic_strength = topic_strength or {}
        self.phrases: dict[str, str] = {}  # normalized -> as the person wrote it
        for term in profile.terms:
            phrase = normalize(term)
            if not phrase or (" " not in phrase and (phrase in GENERIC or len(phrase) < 3)):
                continue
            limit = MAX_PHRASE_SHARE if " " in phrase else MAX_WORD_SHARE
            if data.size >= MIN_RECORDS_FOR_SHARE and data.frequency(phrase) / data.size > limit:
                continue
            self.phrases.setdefault(phrase, term.strip())


# ---------- scoring ----------

class _Score:
    def __init__(self, points: int, topics: set[str], phrases: list[str], funder: bool, college: str | None):
        self.points = points
        self.topics = topics
        self.phrases = phrases  # as the person wrote them
        self.funder = funder  # a shared topic is backed by funder-defined data, not only keywords
        self.college = college  # "same" | "other" | None


def _score(pid: str, data: _Corpus, profile: _Profile, *, person_college: str | None = None) -> _Score | None:
    """Score one record against a profile, or None when it isn't a match.

    Topics: up to 24 each, scaled by the profile's evidence for the topic (1.0 for topics a person chose) and by how
    the record was tagged (funder data 1.0, keywords 0.6); 60 at most. Interests: 2 to 8 each by rarity
    across the whole database, 1.5 times that for a multi-word phrase; 32 at most. A record needs a shared topic, a shared multi-word phrase or two shared
    phrases: a college link alone never matches. College: +8 for the same college, and for people, +5 for a
    different one (to widen the circle). Totals below MIN_MATCH_SCORE are not matches.
    When person_college is given (a researcher being scored), the person's college is compared, not the record's.
    """
    methods = data.topics.get(pid, {})
    shared_topics = profile.topics & set(methods)
    text = data.text.get(pid, "")
    shared = [p for p in profile.phrases if f" {p} " in text]
    if not shared_topics and not any(" " in p for p in shared) and len(shared) < 2:
        return None
    topic_points = sum(
        TOPIC_POINTS * profile.topic_strength.get(t, 1.0) * (1.0 if "funder" in methods[t] else 0.6)
        for t in shared_topics
    )
    # A multi-word phrase ("down syndrome") is more specific evidence than one word, so it counts 1.5 times.
    term_points = sum(data.weight(p) * (PHRASE_BONUS if " " in p else 1.0) for p in shared)
    points = min(TOPIC_CAP, topic_points) + min(TERM_CAP, term_points)
    college = None
    if profile.college:
        if person_college is not None:
            college = "same" if person_college == profile.college else "other"
        elif profile.college in data.colleges.get(pid, ()):
            college = "same"
    points += SAME_COLLEGE if college == "same" else OTHER_COLLEGE if college == "other" else 0
    points = min(100, round(points))
    if points < MIN_MATCH_SCORE:
        return None
    return _Score(
        points,
        shared_topics,
        sorted(profile.phrases[p] for p in shared),
        any("funder" in methods[t] for t in shared_topics),
        college,
    )


def _reasons(topics: set[str], phrases: list[str], funder: bool, college: str | None) -> list[str]:
    """Plain, deduplicated reasons. The wording is parsed by frontend/src/lib/matchReasons.ts; change both together."""
    reasons = []
    labels = [BY_ID[t].name for t in sorted(topics) if t in BY_ID]
    if labels:
        reasons.append("Shares " + ", ".join(labels))
        reasons.append("Supported by funder-defined topic data" if funder else "Supported by stored keyword topic data")
    if phrases:
        reasons.append("Shares stored terms: " + ", ".join(sorted(dict.fromkeys(phrases))[:4]))
    if college == "same":
        reasons.append("Linked to the same college")
    elif college == "other":
        reasons.append("Expands beyond your college")
    return reasons


def _topic_refs(topics: set[str]) -> list[models.TopicRef]:
    return [models.TopicRef(id=t, name=BY_ID[t].name) for t in sorted(topics) if t in BY_ID]


def _ranked_records(data: _Corpus, profile: _Profile, ids: list[str]) -> list[tuple[_Score, str]]:
    scored = [(s, pid) for pid in ids if (s := _score(pid, data, profile))]
    return scored


def _record_matches(conn: Connection, scored: list[tuple[_Score, str]], limit: int) -> list[models.CompatibilityMatch]:
    """Full records for the best matches only, so a request never loads every abstract."""
    if not scored:
        return []
    ids = [pid for _, pid in scored]
    rows = {r["id"]: r for r in conn.execute(f"SELECT * FROM projects WHERE id IN ({','.join('?' * len(ids))})", ids)}
    scored.sort(key=lambda item: (-item[0].points, -rows[item[1]]["latest_fy"], item[1]))
    best = scored[:limit]
    projects = _projects(conn, [rows[pid] for _, pid in best])
    return [
        models.CompatibilityMatch(
            project=project,
            score=s.points,
            band=band_for(s.points),
            reasons=_reasons(s.topics, s.phrases, s.funder, s.college),
            sharedTopics=_topic_refs(s.topics),
        )
        for (s, _), project in zip(best, projects)
    ]


def _active_ids(conn: Connection, kinds: tuple[str, ...], trial_statuses: tuple[str, ...] | None = None) -> list[str]:
    params: list[str] = list(kinds)
    status_clause = ""
    if trial_statuses:
        status_clause = f" AND (p.kind != 'trial' OR p.status_label IN ({','.join('?' * len(trial_statuses))}))"
        params.extend(trial_statuses)
    return [r["id"] for r in conn.execute(f"""
        SELECT p.id FROM projects p
        WHERE p.kind IN ({','.join('?' * len(kinds))}) AND p.is_active = 1 {status_clause} AND {PARENT_ONLY}
        ORDER BY p.id
    """, params)]


# The records that put a person in the people ranking: an active grant or trial, any publication (they are imported
# from 2024 on), or a grant that ended in the last two calendar years. The one definition every surface uses.
ELIGIBLE = f"""({PARENT_ONLY} AND (
    (p.kind IN ('award', 'trial') AND p.is_active = 1)
    OR p.kind = 'publication'
    OR (p.kind = 'award' AND p.end_year >= EXTRACT(YEAR FROM CURRENT_DATE) - 2)))"""


def band_for(points: int) -> models.MatchBand:
    """A score in words. Cutoffs: see STRONG_OVERLAP and GOOD_OVERLAP."""
    if points >= STRONG_OVERLAP:
        return "Strong overlap"
    if points >= GOOD_OVERLAP:
        return "Good overlap"
    return "Some overlap"


def _matches(
    conn: Connection,
    *,
    researcher_id: str,
    name: str,
    profile: models.ProfileInput,
    synthetic: bool = False,
    kinds: tuple[str, ...] = ("award", "trial"),
    trial_statuses: tuple[str, ...] | None = None,
    topic_strength: dict[str, float] | None = None,
) -> models.ResearcherCompatibility:
    data = corpus(conn)
    existing = set() if synthetic else {
        r["project_id"] for r in conn.execute("SELECT project_id FROM project_team WHERE researcher_id = ?", (researcher_id,))
    }
    ids = [pid for pid in _active_ids(conn, kinds, trial_statuses) if pid not in existing]
    scored = _ranked_records(data, _Profile(profile, data, topic_strength), ids)
    return models.ResearcherCompatibility(
        researcherId=researcher_id,
        researcherName=name,
        isSynthetic=synthetic,
        matches=_record_matches(conn, scored, MATCH_LIMIT),
    )


# ---------- topic evidence for a real researcher ----------

def _topic_evidence(conn: Connection, project_ids: list[str]) -> dict[str, Counter]:
    """For each topic on these records, how many records carry it by each tagging method."""
    if not project_ids:
        return {}
    evidence: dict[str, Counter] = {}
    for row in conn.execute(
        f"SELECT topic_id, method FROM project_topics WHERE project_id IN ({','.join('?' * len(project_ids))})", project_ids
    ):
        evidence.setdefault(row["topic_id"], Counter())[row["method"]] += 1
    return evidence


def _evidence_strength(methods: Counter) -> float:
    """Two funder-tagged records make a topic certain; a keyword-tagged record counts for 0.6 of one."""
    return min(1.0, sum(count * (1.0 if method == "funder" else 0.6) for method, count in methods.items()) / 2)


def for_researcher(conn: Connection, researcher_id: str) -> models.ResearcherCompatibility | None:
    row = conn.execute("SELECT id, name, college FROM researchers WHERE id = ?", (researcher_id,)).fetchone()
    if not row:
        return None
    project_ids = [r["project_id"] for r in conn.execute(
        "SELECT project_id FROM project_team WHERE researcher_id = ?", (researcher_id,)
    )]
    evidence = _topic_evidence(conn, project_ids)
    profile = models.ProfileInput(
        college=row["college"],
        # Most frequent topics first; ties alphabetical, so the order never depends on row or set order.
        topics=[t for t, _ in sorted(evidence.items(), key=lambda kv: (-sum(kv[1].values()), kv[0]))][:8],
        # The researcher's distinctive stored subject terms (frequent in their records, rare across Temple).
        terms=[t for t in _distinctive_terms(conn, project_ids, limit=24) if len(t) <= 40][:12],
    )
    return _matches(
        conn,
        researcher_id=row["id"],
        name=row["name"],
        profile=profile,
        # A topic on one keyword-tagged record is weaker evidence of the researcher's field than one on several
        # funder-tagged records.
        topic_strength={t: _evidence_strength(evidence[t]) for t in profile.topics},
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


# ---------- people ----------

class _Person:
    """A researcher's best record score plus the evidence across all their matching records."""

    def __init__(self):
        self.points = 0
        self.topics: set[str] = set()
        self.phrases: list[str] = []
        self.funder = False
        self.college: str | None = None
        self.records: list[tuple[int, str]] = []

    def add(self, pid: str, s: _Score) -> None:
        self.points = max(self.points, s.points)
        self.topics |= s.topics
        self.phrases += s.phrases
        self.funder = self.funder or s.funder
        self.college = s.college  # the person's own college, the same on every record
        self.records.append((s.points, pid))

    def reasons(self) -> list[str]:
        return _reasons(self.topics, self.phrases, self.funder, self.college)


def _person(data: _Corpus, profile: _Profile, college: str | None, project_ids: list[str]) -> _Person:
    person = _Person()
    for pid in project_ids:
        if s := _score(pid, data, profile, person_college=college):
            person.add(pid, s)
    person.records.sort(key=lambda r: (-r[0], r[1]))
    return person


class _Ranking:
    """Everyone with an eligible record that matches a profile, best first, and where each person stands."""

    def __init__(self, people: list[tuple[_Person, Row]]):
        self.people = people
        self.position = {researcher["id"]: i for i, (_, researcher) in enumerate(people)}

    def __len__(self) -> int:
        return len(self.people)


_people_lock = threading.Lock()
_people_cache: OrderedDict[tuple, _Ranking] = OrderedDict()


def _rank(conn: Connection, profile: models.ProfileInput) -> _Ranking:
    key = (profile.model_dump_json(), data_version(conn))
    with _people_lock:
        if key in _people_cache:
            _people_cache.move_to_end(key)
            return _people_cache[key]

    years = {r["id"]: r["latest_fy"] for r in conn.execute(f"SELECT p.id, p.latest_fy FROM projects p WHERE {ELIGIBLE}")}
    team: dict[str, list[str]] = defaultdict(list)
    for row in conn.execute(f"""
        SELECT t.researcher_id, t.project_id FROM project_team t JOIN projects p ON p.id = t.project_id
        WHERE t.researcher_id IS NOT NULL AND {ELIGIBLE}
        ORDER BY t.researcher_id, t.project_id
    """):
        team[row["researcher_id"]].append(row["project_id"])
    researchers = {row["id"]: row for row in conn.execute("SELECT id, name, college, department FROM researchers")}
    data = corpus(conn)
    p = _Profile(profile, data)
    scored = []
    for rid, project_ids in team.items():
        if rid in researchers and (person := _person(data, p, researchers[rid]["college"], project_ids)).points >= MIN_MATCH_SCORE:
            scored.append((person, researchers[rid]))
    # Best record first; ties go to the person with more matching records, then the more recent work. The id
    # only makes the order total: a name never decides who is shown.
    scored.sort(key=lambda item: (
        -item[0].points,
        -len(item[0].records),
        -max((years.get(pid) or 0 for _, pid in item[0].records), default=0),
        item[1]["id"],
    ))
    ranking = _Ranking(scored)
    with _people_lock:
        _people_cache[key] = ranking
        _people_cache.move_to_end(key)
        while len(_people_cache) > PEOPLE_CACHE_SIZE:
            _people_cache.popitem(last=False)
    return ranking


def rank_people(conn: Connection, profile: models.ProfileInput) -> list[tuple[_Person, Row]]:
    """Every researcher with an eligible record scoring at least MIN_MATCH_SCORE, best first.

    A person's points are their best eligible record's `_score`. Sorted by points, then how many of their records
    match, then their latest year, then researcher id. Cached per (profile, data version).
    """
    return _rank(conn, profile).people


def _collaborator(person: _Person, researcher: Row, rank: int) -> models.CollaboratorMatch:
    return models.CollaboratorMatch(
        researcherId=researcher["id"],
        name=researcher["name"],
        initials="".join(part[0] for part in researcher["name"].split()[:2]).upper(),
        college=researcher["college"],
        title=researcher["department"] or "Researcher",
        score=person.points,
        band=band_for(person.points),
        rank=rank,
        reasons=person.reasons(),
        citations=[pid for _, pid in person.records],  # best-matching record first
        sharedTopics=[BY_ID[t].name for t in sorted(person.topics) if t in BY_ID],
    )


def _people_page(ranking: _Ranking, start: int, size: int) -> list[models.CollaboratorMatch]:
    return [_collaborator(person, researcher, start + i + 1)
            for i, (person, researcher) in enumerate(ranking.people[start:start + size])]


def match_researcher(
    conn: Connection, researcher_id: str, profile: models.ProfileInput, limit: int = MATCH_LIMIT
) -> models.ResearcherMatch | None:
    """How a profile matches one researcher: their score and rank in the people ranking, never a separate number."""
    if not conn.execute("SELECT 1 FROM researchers WHERE id = ?", (researcher_id,)).fetchone():
        return None
    ranking = _rank(conn, profile)
    position = ranking.position.get(researcher_id)
    if position is None:
        # Anyone with a matching eligible record is ranked, so this person has no eligible record or none matches.
        eligible = conn.execute(f"""
            SELECT EXISTS (SELECT 1 FROM project_team t JOIN projects p ON p.id = t.project_id
                           WHERE t.researcher_id = ? AND {ELIGIBLE})
        """, (researcher_id,)).fetchone()[0]
        return models.ResearcherMatch(score=0, band=None, rank=None, total=len(ranking), eligible=bool(eligible),
                                      reasons=[], sharedTopics=[], records=[])
    person, _ = ranking.people[position]
    best = [pid for _, pid in person.records[:limit]]
    rows = {r["id"]: r for r in conn.execute(f"SELECT * FROM projects WHERE id IN ({','.join('?' * len(best))})", best)}
    return models.ResearcherMatch(
        score=person.points,
        band=band_for(person.points),
        rank=position + 1,
        total=len(ranking),
        eligible=True,
        reasons=person.reasons(),
        sharedTopics=_topic_refs(person.topics),
        records=_projects(conn, [rows[pid] for pid in best if pid in rows]),
    )


def match_projects(conn: Connection, profile: models.ProfileInput, ids: list[str]) -> models.ProjectMatches:
    if not ids:
        return models.ProjectMatches(matches=[])
    data = corpus(conn)
    p = _Profile(profile, data)
    matches = [
        models.ProjectMatch(id=pid, score=s.points, band=band_for(s.points),
                            reasons=_reasons(s.topics, s.phrases, s.funder, s.college))
        for pid in dict.fromkeys(ids) if pid in data.text and (s := _score(pid, data, p))
    ]
    matches.sort(key=lambda item: (-item.score, item.id))
    return models.ProjectMatches(matches=matches)


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
    ranking = _rank(conn, profile)
    return models.ForYou(trials=trials, grants=grants, collaborators=_people_page(ranking, 0, MATCH_LIMIT),
                         collaboratorTotal=len(ranking))


def people_matches(conn: Connection, profile: models.ProfileInput, page: int) -> models.PeopleMatches:
    """One page of the people ranking, in the same order and with the same ranks as For you."""
    ranking = _rank(conn, profile)
    return models.PeopleMatches(total=len(ranking), page=page, pageSize=PEOPLE_PAGE_SIZE,
                                results=_people_page(ranking, (page - 1) * PEOPLE_PAGE_SIZE, PEOPLE_PAGE_SIZE))
