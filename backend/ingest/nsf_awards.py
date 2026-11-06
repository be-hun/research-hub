"""Fetch and normalize Temple awards from the NSF Award Search API. Loading happens in ingest.load."""

import re
import time
from collections import defaultdict
from datetime import datetime

import httpx

from app.colleges import NSF_DIRECTORATE_TO_COLLEGE
from ingest.text import alns, first_sentences, name_key, paragraphs, title_case

API_URL = "https://api.nsf.gov/services/v1/awards.json"
AWARDEE = '"Temple University"'
PAGE_SIZE = 25  # the API's maximum
SOURCE = "nsf-awards"
SOURCE_LABEL = "NSF Award Search"
VERIFICATION = "public-award-record"
FIELDS = (
    "id,title,startDate,expDate,fundsObligatedAmt,fundsObligated,piFirstName,piLastName,piMiddeInitial,"
    "piId,coPDPI,dirAbbr,divAbbr,orgLongName,orgLongName2,fundProgramName,program,transType,"
    "latestAmendmentDate,abstractText,activeAwd,cfdaNumber"
)
BOILERPLATE = re.compile(r"This award reflects NSF's statutory mission.*$", re.DOTALL)
OBLIGATION = re.compile(r"FY\s*(\d{4})\s*=\s*\$([\d,]+)")


# ---------- fetch ----------

def fetch(from_year: int) -> list[dict]:
    """Awards that were still running on or after 1 January of from_year."""
    records: list[dict] = []
    offset = 1  # 1-based
    with httpx.Client(timeout=60) as client:
        while True:
            params = {
                "awardeeName": AWARDEE,
                "expDateStart": f"01/01/{from_year}",
                "rpp": PAGE_SIZE,
                "offset": offset,
                "printFields": FIELDS,
            }
            data = _get_with_retry(client, params)["response"]
            page = data.get("award", [])
            records += page
            offset += PAGE_SIZE
            if not page or offset > data["metadata"]["totalCount"]:
                return records
            time.sleep(0.5)


def _get_with_retry(client: httpx.Client, params: dict, attempts: int = 3) -> dict:
    for attempt in range(attempts):
        try:
            res = client.get(API_URL, params=params)
            res.raise_for_status()
            return res.json()
        except httpx.HTTPError:
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** (attempt + 1))
    raise AssertionError("unreachable")


# ---------- normalize ----------

def _iso(date: str | None) -> str | None:
    return datetime.strptime(date, "%m/%d/%Y").date().isoformat() if date else None


def _clean_name(name: str) -> str:
    return title_case(name, small_words=False) if name.isupper() else " ".join(name.split())


def _co_pi_name(entry: str) -> str:
    """'Richard Souvenir souvenir@temple.edu' -> 'Richard Souvenir' (emails are not stored)."""
    return _clean_name(" ".join(t for t in entry.split() if "@" not in t))


def _obligations(award: dict) -> list[tuple[int, int]]:
    out = []
    for entry in award.get("fundsObligated") or []:
        match = OBLIGATION.search(entry)
        if match:
            out.append((int(match.group(1)), int(match.group(2).replace(",", ""))))
    return sorted(out)


def _terms(award: dict) -> list[str]:
    terms = [award.get("fundProgramName") or ""]
    terms += (award.get("program") or "").split(", ")
    return [t.strip() for t in terms if t.strip()]


def normalize(awards: list[dict]) -> dict:
    """Turn raw NSF awards into rows for each table. Pure: no I/O."""
    unique = {a["id"]: a for a in awards}

    # PIs carry an NSF id; co-PIs don't. Reuse the PI id when a co-PI also leads another award, but only
    # when exactly one NSF id carries that name: two PIs with the same name are two people.
    ids_by_name: dict[str, set[str]] = defaultdict(set)
    for a in unique.values():
        name = _clean_name(f"{a.get('piFirstName', '')} {a.get('piLastName', '')}")
        if a.get("piId"):
            ids_by_name[name_key(name)].add(f"r-nsf-{a['piId']}")

    def researcher_id(name: str, own_id: str | None = None) -> str:
        if own_id:
            return f"r-nsf-{own_id}"
        ids = ids_by_name.get(name_key(name), set())
        return next(iter(ids)) if len(ids) == 1 else "r-nsf-" + name_key(name).replace(" ", "-")

    projects, award_years, team, colleges, project_areas, programs = [], [], [], [], [], []
    areas: dict[str, dict] = {}
    researchers: dict[str, dict] = {}

    for a in unique.values():
        pid = f"nsf-{a['id']}"
        abstract = paragraphs(BOILERPLATE.sub("", a.get("abstractText") or "").strip())
        start, end = _iso(a.get("startDate")), _iso(a.get("expDate"))
        obligations = _obligations(a) or [(int(start[:4]), int(a.get("fundsObligatedAmt") or 0))]
        latest_fy, latest_amount = obligations[-1]
        div, div_name = a.get("divAbbr"), a.get("orgLongName2")
        updated_at = _iso(a.get("latestAmendmentDate")) or end

        projects.append({
            "id": pid,
            "award_number": a["id"],
            "title": a.get("title") or "",
            "summary": first_sentences(" ".join(abstract)) if abstract else a.get("title") or "",
            "abstract": "\n\n".join(abstract),
            "terms": "; ".join(_terms(a)),
            "agency": "NSF",
            "activity_code": a.get("transType"),
            "funder": f"NSF {div}" if div else "NSF",
            "admin_ic": div,
            "admin_ic_name": div_name,
            "department": None,  # NSF does not report the Temple department
            "start_date": start,
            "end_date": end,
            "start_year": int(start[:4]),
            "end_year": int(end[:4]),
            "latest_fy": latest_fy,
            "latest_amount": latest_amount,
            "is_active": int(a.get("activeAwd") == "true"),
            "source": SOURCE,
            "source_label": SOURCE_LABEL,
            "source_url": f"https://www.nsf.gov/awardsearch/show-award/?AWD_ID={a['id']}",
            "verification": VERIFICATION,
            "updated_at": updated_at,
        })

        for fy, amount in obligations:
            award_years.append({
                "project_id": pid,
                "fiscal_year": fy,
                "appl_id": int(a["id"]),
                "award_amount": amount,
                "admin_ic": div,
            })

        # NSF gives the numbers only ("47.041, 47.049"), no program titles.
        programs += [{"project_id": pid, "aln": number, "title": ""} for number in alns(a.get("cfdaNumber"))]

        if div and div_name:
            area_id = f"nsf-{div.lower()}"
            areas.setdefault(area_id, {
                "id": area_id,
                "name": div_name,
                "abbreviation": div,
                "definition": f"Awards funded by NSF's {div_name} ({div}), {a.get('orgLongName') or 'NSF'}.",
            })
            project_areas.append({"project_id": pid, "area_id": area_id})

        college = NSF_DIRECTORATE_TO_COLLEGE.get(a.get("dirAbbr") or "")
        if college:
            colleges.append({"project_id": pid, "college": college})

        people = [(_clean_name(f"{a.get('piFirstName', '')} {a.get('piLastName', '')}"), "PI", a.get("piId"))]
        people += [(_co_pi_name(c), "Co-PI", None) for c in a.get("coPDPI") or []]
        seen = set()
        for position, (name, role, own_id) in enumerate(p for p in people if p[0]):
            rid = researcher_id(name, own_id)
            if rid in seen:
                continue
            seen.add(rid)
            team.append({"project_id": pid, "position": position, "researcher_id": rid, "name": name, "role": role})
            prev = researchers.get(rid)
            if prev is None or (updated_at or "") > prev["updated_at"]:
                researchers[rid] = {
                    "id": rid,
                    "nih_profile_id": None,
                    "name": name,
                    "department": None,
                    "college": None,
                    "verified": 0,
                    "source": SOURCE,
                    "verification": VERIFICATION,
                    "updated_at": updated_at or "",
                }

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
