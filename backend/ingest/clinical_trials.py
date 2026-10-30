"""Fetch and normalize clinical trials sponsored by Temple or run at Temple sites, from ClinicalTrials.gov.

Unlike award records, a trial's status ("Recruiting") comes from the registry itself.
"""

import re
import time

from app.colleges import college_for_affiliation
from ingest.funders import classify
from ingest.http import client, request_json
from ingest.text import first_sentences, name_key, paragraphs

API_URL = "https://clinicaltrials.gov/api/v2/studies"
SOURCE = "clinicaltrials-gov"
SOURCE_LABEL = "ClinicalTrials.gov"
VERIFICATION = "public-registry-record"
QUERIES = [{"query.spons": "Temple University"}, {"query.locn": "Temple University"}]

STATUS_LABELS = {
    "RECRUITING": "Recruiting", "NOT_YET_RECRUITING": "Not yet recruiting",
    "ENROLLING_BY_INVITATION": "Enrolling by invitation", "ACTIVE_NOT_RECRUITING": "Active, not recruiting",
    "COMPLETED": "Completed", "TERMINATED": "Terminated", "WITHDRAWN": "Withdrawn", "SUSPENDED": "Suspended",
    "UNKNOWN": "Status unknown",
}
ACTIVE = {"RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION", "ACTIVE_NOT_RECRUITING"}
CREDENTIALS = re.compile(r",\s*(MD|M\.D\.|PhD|Ph\.D\.|DO|PharmD|Pharm\.D\.|RN|MPH|MS|MSc|DNP|PsyD|DMD|DDS|MBA|BSN|"
                         r"FACP|FACC|MSN|CRNP|DrPH|ScD|MA|BA|BS|MSW|LCSW)\b.*$", re.IGNORECASE)


# ---------- fetch ----------

def fetch() -> list[dict]:
    studies: dict[str, dict] = {}
    with client() as c:
        for query in QUERIES:
            token = None
            while True:
                params = {**query, "pageSize": 200, "format": "json"}
                if token:
                    params["pageToken"] = token
                data = request_json(c, "GET", API_URL, params=params)
                for s in data.get("studies", []):
                    studies[s["protocolSection"]["identificationModule"]["nctId"]] = s
                token = data.get("nextPageToken")
                if not token:
                    break
                time.sleep(0.3)
    return list(studies.values())


# ---------- normalize ----------

def _is_temple_site(loc: dict) -> bool:
    facility = (loc.get("facility") or "").lower()
    return "temple" in facility and (loc.get("city") or "").lower() == "philadelphia"


def _involves_temple(p: dict) -> bool:
    sponsors = p.get("sponsorCollaboratorsModule", {})
    names = [sponsors.get("leadSponsor", {}).get("name", "")] + [x.get("name", "") for x in sponsors.get("collaborators", [])]
    if any("temple univ" in n.lower() for n in names):
        return True
    return any(_is_temple_site(loc) for loc in p.get("contactsLocationsModule", {}).get("locations", []))


def clean_person(name: str) -> str:
    """'Christina Rose, Pharm.D.' -> 'Christina Rose'; also drops trailing all-caps credentials ('MBBS FRACP')."""
    words = CREDENTIALS.sub("", name).replace(",", " ").split()
    while len(words) > 2 and words[-1].replace(".", "").isupper() and len(words[-1]) > 1:
        words.pop()
    return " ".join(words)


def _temple_clinical_site(p: dict) -> bool:
    """A Temple hospital or medical school site: those trials are run by Lewis Katz School of Medicine faculty."""
    for loc in p.get("contactsLocationsModule", {}).get("locations", []):
        facility = (loc.get("facility") or "").lower()
        if _is_temple_site(loc) and any(w in facility for w in ("hospital", "health", "katz", "medicine", "fox chase")):
            return True
    return False


def normalize(studies: list[dict], from_year: int) -> dict:
    projects, team, funders, colleges, researchers = [], [], [], [], {}
    for s in studies:
        p = s["protocolSection"]
        if not _involves_temple(p):
            continue
        ident, status = p["identificationModule"], p.get("statusModule", {})
        overall = status.get("overallStatus", "UNKNOWN")
        start = (status.get("startDateStruct") or {}).get("date")
        end = ((status.get("completionDateStruct") or {}).get("date")
               or (status.get("primaryCompletionDateStruct") or {}).get("date"))
        updated = (status.get("lastUpdatePostDateStruct") or {}).get("date") or ""
        # Keep studies that are running, or that ended or were updated within the window.
        if overall not in ACTIVE and max(end or "", updated) < f"{from_year}-01-01":
            continue

        nct = ident["nctId"]
        pid = f"ct-{nct}"
        desc = p.get("descriptionModule", {})
        brief = " ".join(paragraphs(desc.get("briefSummary")))
        detail = paragraphs(desc.get("detailedDescription"))
        conditions = p.get("conditionsModule", {})
        interventions = [i.get("name", "") for i in p.get("armsInterventionsModule", {}).get("interventions", [])]
        design = p.get("designModule", {})
        phases = [x.replace("PHASE", "Phase ").replace("NA", "").strip() for x in design.get("phases", []) if x != "NA"]
        kind_label = (design.get("studyType") or "").replace("_", " ").title()

        sponsors = p.get("sponsorCollaboratorsModule", {})
        lead = sponsors.get("leadSponsor", {})
        sponsor_rows = [lead] + sponsors.get("collaborators", [])
        for pos, sp in enumerate(x for x in sponsor_rows if x.get("name")):
            funders.append({"project_id": pid, "position": pos, "name": sp["name"],
                            "category": classify(sp["name"], sponsor_class=sp.get("class"))})

        officials = p.get("contactsLocationsModule", {}).get("overallOfficials", [])
        for pos, o in enumerate(officials):
            name = clean_person(o.get("name", ""))
            if not name:
                continue
            temple = "temple" in (o.get("affiliation") or "").lower()
            rid = f"r-ct-{name_key(name).replace(' ', '-')}" if temple else None
            team.append({"project_id": pid, "position": pos, "researcher_id": rid, "name": name,
                         "role": (o.get("role") or "Investigator").replace("_", " ").title()})
            if rid and rid not in researchers:
                researchers[rid] = {"id": rid, "nih_profile_id": None, "name": name, "department": None,
                                    "college": None, "verified": 0, "source": SOURCE, "verification": VERIFICATION,
                                    "updated_at": updated}
            college = college_for_affiliation(o.get("affiliation") or "")
            if college and temple:
                colleges.append({"project_id": pid, "college": college})
        if not any(c["project_id"] == pid for c in colleges) and _temple_clinical_site(p):
            colleges.append({"project_id": pid, "college": "medicine"})  # APPROX: inferred from the trial site

        phase_text = ", ".join(phases) if phases else kind_label
        projects.append({
            "id": pid,
            "award_number": nct,
            "kind": "trial",
            "title": ident.get("briefTitle") or ident.get("officialTitle") or nct,
            "summary": first_sentences(brief) if brief else ident.get("briefTitle", ""),
            "abstract": "\n\n".join(([brief] if brief else []) + detail),
            "terms": "; ".join(conditions.get("conditions", []) + conditions.get("keywords", []) + interventions),
            "agency": lead.get("name", "Sponsor"),
            "activity_code": phase_text or None,
            "funder": lead.get("name", ""),
            "admin_ic": None,
            "admin_ic_name": None,
            "department": None,
            "start_date": start,
            "end_date": end,
            "start_year": int(start[:4]) if start else int(updated[:4] or from_year),
            "end_year": int(end[:4]) if end else int(start[:4]) if start else from_year,
            "latest_fy": int(updated[:4]) if updated else from_year,
            "latest_amount": None,
            "is_active": int(overall in ACTIVE),
            "status_label": STATUS_LABELS.get(overall, overall.replace("_", " ").title()),
            "source": SOURCE,
            "source_label": SOURCE_LABEL,
            "source_url": f"https://clinicaltrials.gov/study/{nct}",
            "verification": VERIFICATION,
            "updated_at": updated,
        })

    # One college row per project at most from officials; dedupe.
    colleges = list({(c["project_id"], c["college"]): c for c in colleges}.values())
    return {"projects": projects, "award_years": [], "project_funders": funders, "project_colleges": colleges,
            "researchers": list(researchers.values()), "project_team": team, "research_areas": [], "project_areas": []}
