"""Fetch and normalize recent Temple publications that report at least one funder, from OpenAlex.

Publications show research funded outside NIH and NSF (foundations, industry, other governments)
and work in colleges that federal award data does not cover.
"""

import os
import time

from app import config  # noqa: F401  (loads backend/.env, which may hold OPENALEX_API_KEY)
from app.colleges import college_for_affiliation
from ingest.funders import classify
from ingest.http import client, request_json
from ingest.text import first_sentences, name_key

WORKS_URL = "https://api.openalex.org/works"
FUNDERS_URL = "https://api.openalex.org/funders"
TEMPLE = "I84392919"
SOURCE = "openalex"
SOURCE_LABEL = "OpenAlex"
VERIFICATION = "public-publication-record"
CONTACT = "tus34231@temple.edu"  # OpenAlex asks for a contact address ("polite pool")
SELECT = ("id,doi,title,publication_year,publication_date,primary_location,authorships,primary_topic,keywords,"
          "funders,awards,abstract_inverted_index,cited_by_count,updated_date")


# ---------- fetch ----------

def _auth() -> dict:
    # Without a key, requests share a small free daily budget per IP; a free key (OPENALEX_API_KEY) raises it.
    key = os.environ.get("OPENALEX_API_KEY")
    return {"api_key": key} if key else {"mailto": CONTACT}


def fetch(from_year: int) -> dict:
    works: list[dict] = []
    with client() as c:
        page = 1
        while True:
            # Page-number paging (up to 10,000 results) works without an API key; cursor paging does not.
            data = request_json(c, "GET", WORKS_URL, params={
                "filter": f"authorships.institutions.lineage:{TEMPLE},from_publication_date:{from_year}-01-01,"
                          "type:article,awards.funder_id:!null",
                "select": SELECT, "per-page": 200, "page": page, **_auth()})
            works += data["results"]
            if not data["results"] or len(works) >= data["meta"]["count"]:
                break
            page += 1
            time.sleep(0.2)

        # Funder records carry the country, which tells US federal agencies from other governments.
        ids = sorted({f["id"].rsplit("/", 1)[-1] for w in works for f in w.get("funders") or []})
        funders: dict[str, dict] = {}
        for i in range(0, len(ids), 50):
            data = request_json(c, "GET", FUNDERS_URL, params={
                "filter": "openalex:" + "|".join(ids[i:i + 50]), "per-page": 50,
                "select": "id,display_name,country_code", **_auth()})
            for f in data["results"]:
                funders[f["id"].rsplit("/", 1)[-1]] = f
            time.sleep(0.2)
    return {"works": works, "funders": funders}


# ---------- normalize ----------

def abstract_text(inverted: dict | None) -> str:
    if not inverted:
        return ""
    positions = [(pos, word) for word, spots in inverted.items() for pos in spots]
    return " ".join(word for _, word in sorted(positions))


def _is_temple(authorship: dict) -> bool:
    return any(f"openalex.org/{TEMPLE}" in "|".join(i.get("lineage") or [i.get("id", "")])
               for i in authorship.get("institutions") or [])


def normalize(raw: dict) -> dict:
    works, funder_info = raw["works"], raw["funders"]
    projects, team, funders, colleges, researchers = [], [], [], [], {}
    for w in {x["id"]: x for x in works}.values():
        oa_id = w["id"].rsplit("/", 1)[-1]
        pid = f"pub-{oa_id}"
        abstract = abstract_text(w.get("abstract_inverted_index"))
        venue = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
        topic = w.get("primary_topic") or {}
        keywords = [k.get("display_name", "") for k in w.get("keywords") or []]
        topic_terms = [topic.get("display_name", ""), (topic.get("subfield") or {}).get("display_name", ""),
                       (topic.get("field") or {}).get("display_name", "")]

        temple_authors = [a for a in w.get("authorships") or [] if _is_temple(a)]
        if not temple_authors:
            continue  # matched through a child institution only; nobody listed at Temple itself

        work_funders = w.get("funders") or []
        for pos, f in enumerate(work_funders):
            info = funder_info.get(f["id"].rsplit("/", 1)[-1], {})
            funders.append({"project_id": pid, "position": pos, "name": f.get("display_name", ""),
                            "category": classify(f.get("display_name", ""), country=info.get("country_code"))})

        for pos, a in enumerate(temple_authors):
            author = a.get("author") or {}
            name = author.get("display_name") or a.get("raw_author_name") or ""
            if not name:
                continue
            author_id = (author.get("id") or "").rsplit("/", 1)[-1]
            rid = f"r-oa-{author_id}" if author_id else "r-oa-" + name_key(name).replace(" ", "-")
            affiliation = " | ".join(a.get("raw_affiliation_strings") or [])
            college = college_for_affiliation(affiliation)
            team.append({"project_id": pid, "position": pos, "researcher_id": rid, "name": name, "role": "Author"})
            if college:
                colleges.append({"project_id": pid, "college": college})
            r = researchers.setdefault(rid, {"id": rid, "nih_profile_id": None, "name": name, "department": None,
                                             "college": None, "verified": 0, "source": SOURCE,
                                             "verification": VERIFICATION, "updated_at": w.get("updated_date", "")[:10]})
            if college and not r.get("_affiliation_college"):
                r["_affiliation_college"] = college

        year = w.get("publication_year") or int((w.get("publication_date") or "0")[:4])
        doi = w.get("doi")
        projects.append({
            "id": pid,
            "award_number": (doi or oa_id).replace("https://doi.org/", ""),
            "kind": "publication",
            "title": w.get("title") or "Untitled",
            "summary": first_sentences(abstract) if abstract else (w.get("title") or ""),
            "abstract": abstract,
            "terms": "; ".join(t for t in topic_terms + keywords if t),
            "agency": venue[:120] or "Journal article",
            "activity_code": venue or None,
            "funder": ", ".join(f.get("display_name", "") for f in work_funders[:3]),
            "admin_ic": None,
            "admin_ic_name": None,
            "department": None,
            "start_date": w.get("publication_date"),
            "end_date": w.get("publication_date"),
            "start_year": year,
            "end_year": year,
            "latest_fy": year,
            "latest_amount": None,
            "is_active": 0,
            "status_label": f"Published {year}",
            "source": SOURCE,
            "source_label": SOURCE_LABEL,
            "source_url": doi or w["id"],
            "verification": VERIFICATION,
            "updated_at": (w.get("updated_date") or "")[:10],
        })

    colleges = list({(c["project_id"], c["college"]): c for c in colleges}.values())
    return {"projects": projects, "award_years": [], "project_funders": funders, "project_colleges": colleges,
            "researchers": list(researchers.values()), "project_team": team, "research_areas": [], "project_areas": []}
