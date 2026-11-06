"""Fetch and normalize Temple awards from NIH RePORTER. Loading happens in ingest.load."""

import time
from collections import defaultdict
from datetime import datetime, timezone

import httpx

from app.colleges import college_for
from ingest.text import aln, first_sentences, paragraphs, title_case

API_URL = "https://api.reporter.nih.gov/v2/projects/search"
ORG_NAME = "TEMPLE UNIV OF THE COMMONWEALTH"
PAGE_SIZE = 500
SOURCE = "nih-reporter"
SOURCE_LABEL = "NIH RePORTER"
VERIFICATION = "public-award-record"

AGENCY_LABELS = {"ALLCDC": "CDC"}
EMPTY_DEPARTMENTS = {"NONE", "MISCELLANEOUS"}


# ---------- fetch ----------

def fetch(fiscal_years: list[int]) -> list[dict]:
    records: list[dict] = []
    offset = 0
    with httpx.Client(timeout=60) as client:
        while True:
            body = {
                "criteria": {"org_names": [ORG_NAME], "fiscal_years": fiscal_years},
                "offset": offset,
                "limit": PAGE_SIZE,
            }
            data = _post_with_retry(client, body)
            records += data["results"]
            offset += PAGE_SIZE
            if offset >= data["meta"]["total"]:
                return records
            time.sleep(1)  # RePORTER asks for at most one request per second


def _post_with_retry(client: httpx.Client, body: dict, attempts: int = 3) -> dict:
    for attempt in range(attempts):
        try:
            res = client.post(API_URL, json=body)
            res.raise_for_status()
            return res.json()
        except httpx.HTTPError:
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** (attempt + 1))
    raise AssertionError("unreachable")


# ---------- normalize ----------

def person_name(pi: dict) -> str:
    parts = [pi.get("first_name"), pi.get("middle_name"), pi.get("last_name")]
    return title_case(" ".join(p for p in parts if p and p.strip()), small_words=False)


def department_of(record: dict) -> str | None:
    dept = (record.get("organization") or {}).get("dept_type")
    return None if not dept or dept in EMPTY_DEPARTMENTS else dept


def org_type_of(record: dict) -> str | None:
    return (record.get("organization_type") or {}).get("name")


def summary_of(record: dict, abstract: list[str]) -> str:
    source = " ".join(paragraphs(record.get("phr_text"))) or " ".join(abstract)
    return first_sentences(source) if source else record.get("project_title") or ""


def project_id_of(record: dict) -> str:
    pid = f"nih-{record['core_project_num']}"
    return f"{pid}-{record['subproject_id']}" if record.get("subproject_id") else pid


def researcher_id_of(pi: dict) -> str:
    return f"r-nih-{pi['profile_id']}"


def _year(date: str | None, fallback: int) -> int:
    return int(date[:4]) if date else fallback


def normalize(records: list[dict]) -> dict:
    """Turn raw RePORTER records into rows for each table. Pure: no I/O.

    Colleges are filled in only where NIH names a department; ingest.load.finalize
    fills the rest from the investigators' other awards.
    """
    # RePORTER occasionally returns the same application twice across pages.
    unique = {(project_id_of(r), r["appl_id"]): r for r in records}
    by_project: dict[str, list[dict]] = defaultdict(list)
    for (pid, _), record in unique.items():
        by_project[pid].append(record)

    projects, award_years, team, colleges, project_areas, programs = [], [], [], [], [], []
    areas: dict[str, dict] = {}
    researchers: dict[str, dict] = {}

    for pid, recs in by_project.items():
        recs.sort(key=lambda r: (r["fiscal_year"], r["appl_id"]))
        latest = recs[-1]
        abstract = paragraphs(latest.get("abstract_text"))
        agency = AGENCY_LABELS.get(latest.get("agency_code"), latest.get("agency_code") or "NIH")
        activity = latest.get("activity_code")
        admin = latest.get("agency_ic_admin") or {}
        dept = department_of(latest)
        updated_at = (latest.get("date_added") or "")[:10] or datetime.now(timezone.utc).date().isoformat()

        projects.append({
            "id": pid,
            "award_number": latest["core_project_num"],
            "title": latest.get("project_title") or "",
            "summary": summary_of(latest, abstract),
            "abstract": "\n\n".join(abstract),
            "terms": "; ".join(t for t in (latest.get("pref_terms") or "").split(";") if t),
            "agency": agency,
            "activity_code": activity,
            "funder": f"{agency} {activity}" if activity else agency,
            "admin_ic": admin.get("abbreviation"),
            "admin_ic_name": admin.get("name"),
            "department": title_case(dept) if dept else None,
            "start_date": (latest.get("project_start_date") or "")[:10] or None,
            "end_date": (latest.get("project_end_date") or "")[:10] or None,
            "start_year": _year(latest.get("project_start_date"), recs[0]["fiscal_year"]),
            "end_year": _year(latest.get("project_end_date"), latest["fiscal_year"]),
            "latest_fy": latest["fiscal_year"],
            "latest_amount": latest.get("award_amount"),
            "is_active": int(bool(latest.get("is_active"))),
            "source": SOURCE,
            "source_label": SOURCE_LABEL,
            "source_url": latest.get("project_detail_url") or f"https://reporter.nih.gov/project-details/{latest['appl_id']}",
            "verification": VERIFICATION,
            "updated_at": updated_at,
        })

        for r in recs:
            award_years.append({
                "project_id": pid,
                "fiscal_year": r["fiscal_year"],
                "appl_id": r["appl_id"],
                "award_amount": r.get("award_amount"),
                "admin_ic": (r.get("agency_ic_admin") or {}).get("abbreviation"),
            })

        # Assistance listings: every one the award was funded under across its fiscal years (RePORTER gives no title).
        for number in dict.fromkeys(filter(None, (aln(r.get("cfda_code")) for r in recs))):
            programs.append({"project_id": pid, "aln": number, "title": ""})

        # Areas: every institute that administered or funded the award.
        ics = {(admin.get("abbreviation"), admin.get("name"))}
        for r in recs:
            ics |= {(f.get("abbreviation"), f.get("name")) for f in r.get("agency_ic_fundings") or []}
        for abbr, name in sorted(i for i in ics if i[0] and i[1]):
            area_id = abbr.lower()
            areas.setdefault(area_id, {
                "id": area_id,
                "name": name,
                "abbreviation": abbr,
                "definition": f"Awards administered or funded by the {name} ({abbr}).",
            })
            project_areas.append({"project_id": pid, "area_id": area_id})

        college = college_for(org_type_of(latest), dept)
        if college:
            colleges.append({"project_id": pid, "college": college})

        pis = sorted(latest.get("principal_investigators") or [], key=lambda p: not p.get("is_contact_pi"))
        for position, pi in enumerate(pis):
            rid = researcher_id_of(pi)
            team.append({
                "project_id": pid,
                "position": position,
                "researcher_id": rid,
                "name": person_name(pi),
                "role": "Contact PI" if pi.get("is_contact_pi") else "Co-PI",
            })
            # Latest award wins for the researcher's department.
            prev = researchers.get(rid)
            if prev is None or latest["fiscal_year"] >= prev["_fy"]:
                researchers[rid] = {
                    "id": rid,
                    "nih_profile_id": pi["profile_id"],
                    "name": person_name(pi),
                    "department": title_case(dept) if dept else (prev or {}).get("department"),
                    "college": None,
                    "verified": 0,
                    "source": SOURCE,
                    "verification": VERIFICATION,
                    "updated_at": updated_at,
                    "_fy": latest["fiscal_year"],
                }

    for row in researchers.values():
        row.pop("_fy")

    return {
        "projects": projects,
        "award_years": award_years,
        "project_colleges": colleges,
        "researchers": list(researchers.values()),
        "project_team": team,
        "research_areas": list(areas.values()),
        "project_areas": project_areas,
        "project_programs": programs,
    }
