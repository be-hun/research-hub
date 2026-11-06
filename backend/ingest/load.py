"""Merge normalized rows from every source and load them in one transaction."""

import re
import unicodedata
from collections import Counter, defaultdict

from app.db import Connection
from app.topics import AREA_TO_TOPIC, topics_from_text
from ingest.text import name_key

TABLES = ("projects", "award_years", "project_colleges", "project_funders", "researchers", "researcher_aliases",
          "project_team", "research_areas", "project_areas", "project_topics", "project_programs")
OPPORTUNITY_TABLES = ("opportunities", "opportunity_programs", "opportunity_applicant_types")
# When the same person appears in several sources, keep the record from the first source listed.
SOURCE_PRIORITY = ("nih-reporter", "nsf-awards", "clinicaltrials-gov", "openalex", "usaspending")
# Sources whose college comes from a guess (funding directorate, trial site) rather than a named unit.
WEAK_COLLEGE_SOURCES = {"nsf-awards", "clinicaltrials-gov"}


def _fill_award_defaults(data: dict) -> None:
    """NIH and NSF rows predate kinds and funder rows; give them both."""
    has_funder = {f["project_id"] for f in data["project_funders"]}
    for p in data["projects"]:
        p.setdefault("kind", "award")
        p.setdefault("status_label", "Active" if p["is_active"] else "Ended")
        if p["id"] not in has_funder:
            data["project_funders"].append({"project_id": p["id"], "position": 0,
                                            "name": p.get("admin_ic_name") or p["agency"], "category": "federal"})


def _drop_duplicate_awards(data: dict) -> None:
    """USAspending also lists some awards that NIH RePORTER already provides in more detail (CDC, AHRQ)."""
    known = {p["award_number"] for p in data["projects"] if p["source"] in ("nih-reporter", "nsf-awards")}
    dupes = {p["id"] for p in data["projects"]
             if p["source"] == "usaspending" and any(k and k in p["award_number"] for k in known)}
    if dupes:
        for table in ("projects",):
            data[table] = [r for r in data[table] if r["id"] not in dupes]
        for table in ("award_years", "project_funders", "project_colleges", "project_team", "project_areas",
                      "project_programs"):
            data[table] = [r for r in data[table] if r["project_id"] not in dupes]


# Researcher ids a source builds from its own person ID; any other id was built from the name.
SOURCE_ID_PATTERNS = {
    "nih-reporter": re.compile(r"^r-nih-(\d+)$"),
    "nsf-awards": re.compile(r"^r-nsf-(\d+)$"),
    "openalex": re.compile(r"^r-oa-(A\d+)$"),
}
CONFIDENCE_RANK = {"low": 0, "medium": 1, "high": 2}


def source_person_id(researcher: dict) -> str | None:
    """The source's own ID for this person, or None when the source only gave a name."""
    pattern = SOURCE_ID_PATTERNS.get(researcher["source"])
    match = pattern.match(researcher["id"]) if pattern else None
    return match.group(1) if match else None


def _identity(data: dict, alias: dict[str, str]) -> None:
    """Record every source identity behind each researcher, with its evidence, and rate the profile.

    The cross-source name merge above is the existing behavior and is kept as is; this step makes it
    visible. A profile is only `high` when one source identity with that source's own person ID backs it.
    """
    last_seen: dict[str, str] = {}
    updated = {p["id"]: p.get("updated_at") or "" for p in data["projects"]}
    for m in data["project_team"]:
        rid = m.get("_source_researcher_id")
        if rid:
            last_seen[rid] = max(last_seen.get(rid, ""), updated.get(m["project_id"], ""))
    rows: dict[str, list[dict]] = defaultdict(list)
    for r in data["_all_researchers"]:
        pid = source_person_id(r)
        merged = r["id"] in alias
        rows[alias.get(r["id"], r["id"])].append({
            "researcher_id": alias.get(r["id"], r["id"]),
            "source_researcher_id": r["id"],
            "source": r["source"],
            "source_person_id": pid,
            "source_name": r["name"],
            "confidence": "low" if merged else "high" if pid else "medium",
            "evidence": "same-name-across-sources" if merged else "source-person-id" if pid else "name-within-source",
            "last_seen": last_seen.get(r["id"]) or r.get("updated_at") or None,
        })
    data["researcher_aliases"] = [a for group in rows.values() for a in group]
    for r in data["researchers"]:
        group = rows.get(r["id"], [])
        r["identity_confidence"] = min((a["confidence"] for a in group), key=CONFIDENCE_RANK.get, default="low")
        r.setdefault("orcid", None)


def merge(datasets: list[dict]) -> dict:
    """Combine sources and merge researchers that appear in more than one (same first and last name).

    Name-only merging is the pre-existing behavior; every merge is recorded in researcher_aliases with
    `same-name-across-sources` evidence and the profile is labeled low confidence.
    """
    data = {t: [row for d in datasets for row in d.get(t, [])] for t in TABLES}
    # One row per award and ALN, even when a source lists the same number twice.
    data["project_programs"] = list({(r["project_id"], r["aln"]): r for r in data["project_programs"]}.values())
    _fill_award_defaults(data)
    _drop_duplicate_awards(data)

    rank = {s: i for i, s in enumerate(SOURCE_PRIORITY)}
    canonical: dict[str, dict] = {}
    alias: dict[str, str] = {}
    for r in sorted(data["researchers"], key=lambda r: rank.get(r["source"], len(rank))):
        key = name_key(r["name"])
        if key in canonical and canonical[key]["source"] != r["source"]:
            alias[r["id"]] = canonical[key]["id"]
            canonical[key]["department"] = canonical[key]["department"] or r["department"]
            if r.get("_affiliation_college") and not canonical[key].get("_affiliation_college"):
                canonical[key]["_affiliation_college"] = r["_affiliation_college"]
        else:
            canonical.setdefault(key, r)
    data["_all_researchers"] = list(data["researchers"])
    data["researchers"] = [r for r in data["researchers"] if r["id"] not in alias]
    for member in data["project_team"]:
        member["_source_researcher_id"] = member["researcher_id"]
        member["researcher_id"] = alias.get(member["researcher_id"], member["researcher_id"])
    # A person can appear twice on one record after merging; keep the first.
    seen: set[tuple] = set()
    team = []
    for m in data["project_team"]:
        key = (m["project_id"], m["researcher_id"] or m["name"])
        if key not in seen:
            seen.add(key)
            team.append(m)
    data["project_team"] = team
    _identity(data, alias)
    del data["_all_researchers"]
    for m in data["project_team"]:
        m.pop("_source_researcher_id", None)

    data["research_areas"] = list({a["id"]: a for a in data["research_areas"]}.values())
    data["project_colleges"] = list({(c["project_id"], c["college"]): c for c in data["project_colleges"]}.values())
    return finalize(data)


def finalize(data: dict) -> dict:
    """Fill colleges and topics the sources didn't give.

    Colleges:
    1. A researcher's college is the most common college among their records that have one, plus the
       college named in their own affiliation. Colleges named by a department or affiliation outrank ones
       guessed from an NSF directorate or a trial site.
    2. A record with no college takes the most common college of its investigators.
    Topics: from the funding institute where there is one, otherwise from words in the title and terms.
    """
    source_of = {p["id"]: p["source"] for p in data["projects"]}
    department_of = {p["id"]: p["department"] for p in data["projects"]}
    project_colleges: dict[str, set[str]] = defaultdict(set)
    for row in data["project_colleges"]:
        project_colleges[row["project_id"]].add(row["college"])
    strong_projects = {pid for pid in project_colleges
                       if source_of.get(pid) not in WEAK_COLLEGE_SOURCES
                       and not (source_of.get(pid) == "nih-reporter" and not department_of.get(pid))}
    team_by_project: dict[str, list[str]] = defaultdict(list)
    for member in data["project_team"]:
        if member["researcher_id"]:
            team_by_project[member["project_id"]].append(member["researcher_id"])

    strong: dict[str, Counter] = defaultdict(Counter)
    weak: dict[str, Counter] = defaultdict(Counter)
    for pid, rids in team_by_project.items():
        for rid in rids:
            # sorted: a set's order changes per process, and Counter breaks vote ties by insertion order
            (strong if pid in strong_projects else weak)[rid].update(sorted(project_colleges.get(pid, ())))
    for r in data["researchers"]:
        if r.get("_affiliation_college"):
            strong[r["id"]][r["_affiliation_college"]] += 2
    votes = defaultdict(Counter, {rid: strong[rid] or weak[rid] for rid in set(strong) | set(weak)})

    unmapped = []
    for p in data["projects"]:
        if p["id"] in project_colleges:
            continue
        tally = sum((votes[r] for r in team_by_project.get(p["id"], [])), Counter())
        if tally:
            data["project_colleges"].append({"project_id": p["id"], "college": tally.most_common(1)[0][0]})
        else:
            unmapped.append(p["id"])

    for r in data["researchers"]:
        r.pop("_affiliation_college", None)
        if votes[r["id"]]:
            r["college"] = votes[r["id"]].most_common(1)[0][0]

    topics = []
    by_area: dict[str, set[str]] = defaultdict(set)
    for row in data["project_areas"]:
        if row["area_id"] in AREA_TO_TOPIC:
            by_area[row["project_id"]].add(AREA_TO_TOPIC[row["area_id"]])
    for p in data["projects"]:
        if by_area.get(p["id"]):
            topics += [{"project_id": p["id"], "topic_id": t, "method": "funder"} for t in sorted(by_area[p["id"]])]
        else:
            topics += [{"project_id": p["id"], "topic_id": t, "method": "keywords"}
                       for t in topics_from_text(p["title"], p["terms"])]
    data["project_topics"] = topics

    data["unmapped_project_ids"] = unmapped
    return data


def search_text(text: str) -> str:
    """Text as SQLite's unicode61 tokenizer saw it: accents removed and every non-alphanumeric a word break.

    Postgres's parser would otherwise read "infection/disease" as a file path, "14-19" as one token and
    "Praticò" as not matching "pratico".
    """
    plain = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return re.sub(r"[\W_]+", " ", plain).strip()


def _value(v):
    """COPY sends text, so an INTEGER column needs 1 rather than True and 2024 rather than 2024.0."""
    if isinstance(v, bool) or (isinstance(v, float) and v.is_integer()):
        return int(v)
    return v


def _insert(conn: Connection, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    cols = list(rows[0])
    conn.copy_rows(table, cols, ([_value(r[c]) for c in cols] for r in rows))


def load(conn: Connection, data: dict) -> None:
    """Replace all imported rows in one transaction, so a rerun gives the same result.

    DELETE rather than TRUNCATE: readers keep seeing the previous data until the new rows commit.
    """
    with conn:
        conn.execute("DELETE FROM projects")  # cascades to child tables
        conn.execute("DELETE FROM researchers")
        conn.execute("DELETE FROM research_areas")
        for table in TABLES:
            _insert(conn, table, data.get(table, []))

        people: dict[str, list[str]] = defaultdict(list)
        for member in data["project_team"]:
            people[member["project_id"]].append(member["name"])
        conn.copy_rows(  # the search document column is generated from these
            "projects_fts", ["project_id", "title", "abstract", "terms", "people"],
            ([p["id"], *(search_text(t) for t in (p["title"], p["abstract"], p["terms"], ", ".join(people[p["id"]])))]
             for p in data["projects"]),
        )


def load_opportunities(conn: Connection, data: dict) -> None:
    """Replace only the funding-call tables, in one transaction; awards are untouched."""
    with conn:
        conn.execute("DELETE FROM opportunities")  # cascades to the programs, applicant types and search rows
        for table in OPPORTUNITY_TABLES:
            _insert(conn, table, data[table])
        conn.copy_rows(  # the search document column is generated from these
            "opportunities_fts", ["opportunity_id", "title", "description", "extra"],
            ([o["id"], search_text(o["title"]), search_text(o["description"]),
              search_text(" ".join((o["number"], o["agency"], o["agency_name"], o["categories"])))]
             for o in data["opportunities"]),
        )
