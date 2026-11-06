"""Fetch and normalize federal research grants to Temple from USAspending.gov.

NIH and NSF grants come from their own, richer sources, so they are skipped here. Non-research
programs (student aid, pandemic relief and similar) are filtered out by assistance listing.
"""

import html
import re
import time
from collections import defaultdict
from datetime import date

from app.colleges import college_for_usaspending
from ingest.http import client, request_json
from ingest.text import aln, first_sentences, title_case

SEARCH_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
TRANSACTIONS_URL = "https://api.usaspending.gov/api/v2/transactions/"
TEMPLE_UEI = "QD4MGHFDJKU1"
GRANT_TYPES = ["02", "03", "04", "05"]  # block, formula, project and cooperative agreement grants
SOURCE = "usaspending"
SOURCE_LABEL = "USAspending.gov"
VERIFICATION = "public-award-record"
FIELDS = ["Award ID", "Description", "Awarding Agency", "Awarding Sub Agency", "Award Amount", "Start Date",
          "End Date", "Assistance Listings", "generated_internal_id"]

COVERED_ELSEWHERE = {"National Institutes of Health", "National Science Foundation"}
NOT_RESEARCH_AGENCIES = {"Small Business Administration", "Department of the Treasury"}
NOT_RESEARCH_PROGRAMS = re.compile(
    r"STUDENT|PELL|WORK-STUDY|WORK STUDY|EMERGENCY RELIEF|CORONAVIRUS|COVID|TRIO|UPWARD BOUND|TALENT SEARCH|"
    r"GEAR UP|LOAN|STABILIZATION|PROVIDER RELIEF|INSTITUTIONAL RESILIENCE",
    re.IGNORECASE,
)
AGENCY_ABBREVIATIONS = {
    "Department of Defense": "DOD", "Department of Energy": "DOE", "Department of Education": "ED",
    "Department of Justice": "DOJ", "Environmental Protection Agency": "EPA", "Department of the Interior": "DOI",
    "Department of Agriculture": "USDA", "Department of State": "State", "Department of Commerce": "DOC",
    "National Endowment for the Humanities": "NEH", "National Endowment for the Arts": "NEA",
    "Institute of Museum and Library Services": "IMLS", "National Aeronautics and Space Administration": "NASA",
    "Department of Health and Human Services": "HHS", "Department of Housing and Urban Development": "HUD",
    "Department of Transportation": "DOT", "Department of Labor": "DOL", "Department of Homeland Security": "DHS",
    "Department of Veterans Affairs": "VA", "Corporation for National and Community Service": "AmeriCorps",
}
# Descriptions are all upper case, so title and sentence case lowercase these; they are put back as whole words.
ACRONYMS = ("HIV", "AIDS", "COVID-19", "STEM", "NASA", "NSF", "NIH", "DOD", "DOE", "USDA", "AI", "PTSD", "HBCU", "PFAS",
            "US", "U.S.", "K-12", "CDC", "EPA", "SBIR", "STTR", "R&D", "GIS", "LGBTQ",
            "COVID", "DNA", "RNA", "UV", "II", "III")
# Chicago-style title case keeps these lowercase unless they start the title or follow a colon.
MINOR_WORDS = {"an", "as", "at", "by", "or", "nor", "per", "via", "vs"}
_ACRONYM = re.compile(
    r"(?<![\w.&-])(" + "|".join(re.escape(a) for a in sorted(ACRONYMS, key=len, reverse=True)) + r")(?![\w&-])",
    re.IGNORECASE,
)
_CANONICAL = {a.lower(): a for a in ACRONYMS}
TITLE_MAX = 120
# A label some agencies put before the text, and the notice on awards issued before 20 January 2025.
_LABEL = re.compile(r"^(?:purpose|description|project title|title)\s*:\s*", re.IGNORECASE)
_NOTICE = re.compile(r"^\*\*[^*]*\*\*\s*")
_ABBREVIATION = re.compile(r"(?:\b[a-z]|e\.g|i\.e|u\.s|vs|dr|st|no|inc|al)\.$", re.IGNORECASE)
# Descriptions that say nothing about the work; the program name is used as the title instead.
_NO_TITLE = re.compile(r"^(unknown title|untitled)$|faadc migration note", re.IGNORECASE)


# ---------- fetch ----------

def fetch(from_year: int) -> list[dict]:
    """Grants to Temple active on or after 1 October of from_year - 1 (the start of FY from_year)."""
    awards: list[dict] = []
    with client() as c:
        page = 1
        while True:
            body = {
                "filters": {
                    "recipient_search_text": [TEMPLE_UEI],
                    "award_type_codes": GRANT_TYPES,
                    "time_period": [{"start_date": f"{from_year - 1}-10-01", "end_date": date.today().isoformat()}],
                },
                "fields": FIELDS, "limit": 100, "page": page, "sort": "Award Amount", "order": "desc",
            }
            data = request_json(c, "POST", SEARCH_URL, json=body)
            awards += data["results"]
            if not data["page_metadata"].get("hasNext"):
                break
            page += 1
            time.sleep(0.3)

        # Yearly obligations for the awards we keep, from their transactions.
        for award in awards:
            award["_transactions"] = []
            if not _keep(award):
                continue
            tx_page = 1
            while True:
                data = request_json(c, "POST", TRANSACTIONS_URL, json={
                    "award_id": award["generated_internal_id"], "limit": 100, "page": tx_page,
                    "sort": "action_date", "order": "asc"})
                award["_transactions"] += [
                    {"action_date": t.get("action_date"), "amount": t.get("federal_action_obligation")}
                    for t in data.get("results", [])
                ]
                if not data.get("page_metadata", {}).get("hasNext"):
                    break
                tx_page += 1
            time.sleep(0.2)
    return awards


# ---------- normalize ----------

def _programs(award: dict) -> list[str]:
    return [p.get("cfda_program_title") or "" for p in award.get("Assistance Listings") or []]


def _keep(award: dict) -> bool:
    if award.get("Awarding Sub Agency") in COVERED_ELSEWHERE or award.get("Awarding Agency") in COVERED_ELSEWHERE:
        return False
    if award.get("Awarding Agency") in NOT_RESEARCH_AGENCIES:
        return False
    programs = " ".join(_programs(award))
    return not NOT_RESEARCH_PROGRAMS.search(programs)


def _fiscal_year(iso: str) -> int:
    d = date.fromisoformat(iso[:10])
    return d.year + 1 if d.month >= 10 else d.year


def _restore_acronyms(text: str) -> str:
    text = _ACRONYM.sub(lambda m: _CANONICAL[m.group(1).lower()], text)
    return re.sub(r"\bSTEM(?= cells?\b)", lambda m: m.group(0).lower(), text, flags=re.IGNORECASE)  # stem cells


def _first_sentence(text: str) -> str:
    """Text up to the first sentence end that isn't an abbreviation ("E.G.", "S. AUREUS")."""
    for m in re.finditer(r"[.!?](?=\s)", text):
        if not _ABBREVIATION.search(text[:m.end()]):
            return text[:m.start()]
    return text


def _shorten(title: str, limit: int = TITLE_MAX) -> str:
    """At most about `limit` characters, cut at a word boundary with an ellipsis, never mid-word."""
    title = title.strip(" .;:,")
    if len(title) <= limit:
        return title
    cut = title[:limit + 1].rsplit(" ", 1)[0].rstrip(" .;:,-(")
    return f"{cut}…"


def _title(text: str) -> str:
    words = []
    for i, (word, original) in enumerate(zip(title_case(text).split(), text.split())):
        if re.search(r"\d", original) and re.search(r"[A-Z]", original) or re.fullmatch(r"\([A-Z&/-]{2,10}\)\W?", original):
            word = original  # a gene or grant code ("TRAF6", "FY24") or an acronym in brackets ("(PTOP)")
        elif i and words[-1].endswith(":"):
            word = word[:1].upper() + word[1:]
        elif i and word.lower() in MINOR_WORDS:
            word = word.lower()
        words.append(word)
    # str.title() capitalizes after an apostrophe ("World'S").
    return _restore_acronyms(re.sub(r"(?<=\w)['’]S\b", lambda m: m.group(0).lower(), " ".join(words)))


def _sentence_case(text: str) -> str:
    text = re.sub(r"(?<=[a-z]):(?=[a-z])", ": ", text.lower())  # "activities:this project"
    text = re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), text)
    return _restore_acronyms(re.sub(r"\btemple university\b", "Temple University", text))


def _title_and_text(description: str, programs: list[str] | None = None) -> tuple[str, str]:
    """Descriptions are upper case, sometimes 'TITLE - ABSTRACT' but mostly a paragraph. Return title and body.

    The title is the part before " - " (or before a bracketed abstract), else the first sentence, cut to about
    TITLE_MAX characters at a word boundary. A paragraph is kept whole as the body.
    """
    entities = re.sub(r"&[A-Za-z]+;", lambda m: m.group(0).lower(), description or "")  # "&NBSP;"
    text = _LABEL.sub("", re.sub(r"\s+", " ", html.unescape(entities)).strip())
    if _NO_TITLE.search(text):
        text = ""
    lead = _LABEL.sub("", _NOTICE.sub("", text))
    head, separator, rest = lead.partition(" - ")
    if separator and not re.search(r"[.!?]\s", head):
        title, body = head, rest
    else:
        title, body = _first_sentence(lead).split(" [", 1)[0], text
    title = title or (programs[0] if programs else "")
    return (_shorten(_title(title)) if title else "Untitled award"), _sentence_case(body.strip())


def normalize(awards: list[dict], from_year: int, today: date | None = None) -> dict:
    today = today or date.today()
    projects, award_years, funders, colleges, listings = [], [], [], [], []
    for a in {x["generated_internal_id"]: x for x in awards}.values():
        if not _keep(a) or not a.get("End Date") or a["End Date"] < f"{from_year}-01-01":
            continue
        agency = a.get("Awarding Agency") or "Federal"
        abbr = AGENCY_ABBREVIATIONS.get(agency, agency)
        sub = a.get("Awarding Sub Agency") or agency
        pid = f"usa-{a['Award ID']}"
        raw_programs = [p for p in _programs(a) if p]
        title, body = _title_and_text(a.get("Description") or "", raw_programs)
        programs = [p.title() for p in raw_programs]

        by_year: dict[int, float] = defaultdict(float)
        for t in a.get("_transactions") or []:
            if t.get("action_date") and t.get("amount"):
                by_year[_fiscal_year(t["action_date"])] += t["amount"]
        by_year = {fy: amt for fy, amt in by_year.items() if amt > 0}
        latest_fy = max(by_year) if by_year else _fiscal_year(a["End Date"])
        active = a["End Date"] >= today.isoformat()

        projects.append({
            "id": pid,
            "award_number": a["Award ID"],
            "kind": "award",
            "title": title,
            "summary": first_sentences(body) if body else title,
            "abstract": body,
            "terms": "; ".join(programs),
            "agency": abbr,
            "activity_code": programs[0] if programs else None,
            "funder": f"{abbr} · {sub}" if sub != agency else abbr,
            "admin_ic": abbr,
            "admin_ic_name": sub,
            "department": None,
            "start_date": a.get("Start Date"),
            "end_date": a.get("End Date"),
            "start_year": int(a["Start Date"][:4]) if a.get("Start Date") else latest_fy,
            "end_year": int(a["End Date"][:4]),
            "latest_fy": latest_fy,
            "latest_amount": round(by_year.get(latest_fy, 0)) or None,
            "is_active": int(active),
            "status_label": "Active" if active else "Ended",
            "source": SOURCE,
            "source_label": SOURCE_LABEL,
            "source_url": f"https://www.usaspending.gov/award/{a['generated_internal_id']}",
            "verification": VERIFICATION,
            # The latest transaction, so a re-import doesn't mark an unchanged award (and its AI summary) as new.
            "updated_at": max((t["action_date"][:10] for t in a.get("_transactions") or [] if t.get("action_date")),
                              default=None) or a.get("Start Date") or today.isoformat(),
        })
        award_years += [{"project_id": pid, "fiscal_year": fy, "appl_id": 0, "award_amount": round(amt), "admin_ic": abbr}
                        for fy, amt in sorted(by_year.items())]
        funders.append({"project_id": pid, "position": 0, "name": sub, "category": "federal"})
        for listing in a.get("Assistance Listings") or []:
            if number := aln(listing.get("cfda_number")):
                listings.append({"project_id": pid, "aln": number,
                                 "title": _title(listing.get("cfda_program_title") or "")})
        if college := college_for_usaspending(sub, raw_programs):
            colleges.append({"project_id": pid, "college": college})

    return {"projects": projects, "award_years": award_years, "project_funders": funders, "project_colleges": colleges,
            "researchers": [], "project_team": [], "research_areas": [], "project_areas": [],
            "project_programs": listings}
