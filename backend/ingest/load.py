"""Merge normalized rows from every source and load them in one transaction."""

import sqlite3
from collections import Counter, defaultdict

from ingest.text import name_key

TABLES = ("projects", "award_years", "project_colleges", "researchers", "project_team",
          "research_areas", "project_areas")
# When the same person appears in several sources, keep the record from the first source listed.
SOURCE_PRIORITY = ("nih-reporter", "nsf-awards")


def merge(datasets: list[dict]) -> dict:
    """Combine sources and merge researchers that appear in more than one (same first and last name)."""
    data = {t: [row for d in datasets for row in d[t]] for t in TABLES}

    rank = {s: i for i, s in enumerate(SOURCE_PRIORITY)}
    canonical: dict[str, dict] = {}
    alias: dict[str, str] = {}
    for r in sorted(data["researchers"], key=lambda r: rank.get(r["source"], len(rank))):
        key = name_key(r["name"])
        if key in canonical and canonical[key]["source"] != r["source"]:
            alias[r["id"]] = canonical[key]["id"]
            canonical[key]["department"] = canonical[key]["department"] or r["department"]
        else:
            canonical.setdefault(key, r)
    data["researchers"] = [r for r in data["researchers"] if r["id"] not in alias]
    for member in data["project_team"]:
        member["researcher_id"] = alias.get(member["researcher_id"], member["researcher_id"])

    data["research_areas"] = list({a["id"]: a for a in data["research_areas"]}.values())
    return finalize(data)


def finalize(data: dict) -> dict:
    """Fill colleges the sources didn't give, from each investigator's other awards.

    1. A researcher's college is the most common college among their awards that have one.
       Awards whose college comes from a named department (NIH) outrank ones guessed from
       the funding directorate (NSF).
    2. An award with no college takes the most common college of its investigators.
    """
    project_colleges: dict[str, set[str]] = defaultdict(set)
    for row in data["project_colleges"]:
        project_colleges[row["project_id"]].add(row["college"])
    has_department = {p["id"] for p in data["projects"] if p["department"]}
    team_by_project: dict[str, list[str]] = defaultdict(list)
    for member in data["project_team"]:
        if member["researcher_id"]:
            team_by_project[member["project_id"]].append(member["researcher_id"])

    strong: dict[str, Counter] = defaultdict(Counter)
    weak: dict[str, Counter] = defaultdict(Counter)
    for pid, rids in team_by_project.items():
        for rid in rids:
            (strong if pid in has_department else weak)[rid].update(project_colleges.get(pid, ()))
    votes = {rid: strong[rid] or weak[rid] for rid in set(strong) | set(weak)}
    votes = defaultdict(Counter, votes)

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
        if votes[r["id"]]:
            r["college"] = votes[r["id"]].most_common(1)[0][0]

    data["unmapped_project_ids"] = unmapped
    return data


def _insert(conn: sqlite3.Connection, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    cols = list(rows[0])
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})"
    conn.executemany(sql, [tuple(r[c] for c in cols) for r in rows])


def load(conn: sqlite3.Connection, data: dict) -> None:
    """Replace all imported rows in one transaction, so a rerun gives the same result."""
    with conn:
        conn.execute("DELETE FROM projects")  # cascades to child tables
        conn.execute("DELETE FROM researchers")
        conn.execute("DELETE FROM research_areas")
        conn.execute("DELETE FROM projects_fts")
        for table in TABLES:
            _insert(conn, table, data[table])

        people: dict[str, list[str]] = defaultdict(list)
        for member in data["project_team"]:
            people[member["project_id"]].append(member["name"])
        conn.executemany(
            "INSERT INTO projects_fts (project_id, title, abstract, terms, people) VALUES (?, ?, ?, ?, ?)",
            [(p["id"], p["title"], p["abstract"], p["terms"], ", ".join(people[p["id"]])) for p in data["projects"]],
        )
