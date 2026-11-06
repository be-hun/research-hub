"""Fetch and normalize federal funding calls (RFPs / notices of funding opportunity) from Grants.gov.

    uv run python -m ingest.grants_gov            # re-fetch calls and replace only the opportunity tables
    uv run python -m ingest.grants_gov --offline  # reload calls from data/raw/grants_gov.json

Deadlines change, so this can run daily without re-importing awards. ingest.run also fetches calls along with
every other source. A call is an invitation to apply, not an award: everything here is stored as Grants.gov
gives it, with the agency's own wording for the description and eligibility.

The Grants.gov API is free and keyless: search2 lists posted and forecasted calls, fetchOpportunity gives one
call's synopsis (or forecast), applicant types and assistance listings.
"""

import argparse
import html
import json
import re
import sys
import time
from datetime import datetime, timezone

from app import config
from ingest.http import client, request_json
from ingest.text import aln

SEARCH_URL = "https://api.grants.gov/v1/api/search2"
DETAIL_URL = "https://api.grants.gov/v1/api/fetchOpportunity"
SOURCE_URL = "https://www.grants.gov/search-results-detail/{}"
CACHE = config.BACKEND_DIR / "data" / "raw" / "grants_gov.json"
STATUSES = "forecasted|posted"
PAGE_SIZE = 100
DETAIL_PAUSE = 0.1  # seconds between detail calls, to be polite

# Grants.gov top-level agency codes (the part of agencyCode before the first "-") for the agencies in Temple's
# award records, with the short label the site already uses (usaspending.AGENCY_ABBREVIATIONS, plus NSF).
# The search API's `agencies` filter only matches exact sub-agency codes, so calls are fetched for every agency
# and kept by this table. Left out: Treasury (USDOT), SBA and MCC, whose calls aren't research funding.
AGENCIES = {
    "HHS": "HHS", "NSF": "NSF", "DOD": "DOD", "DOE": "DOE", "PAMS": "DOE", "ED": "ED", "USDA": "USDA",
    "NASA": "NASA", "NEH": "NEH", "NEA": "NEA", "IMLS": "IMLS", "EPA": "EPA", "DOI": "DOI", "USDOJ": "DOJ",
    "DOS": "State", "DOC": "DOC", "HUD": "HUD", "DOT": "DOT", "DOL": "DOL", "DHS": "DHS", "VA": "VA",
    "AC": "AmeriCorps",
}
# HHS operating divisions that award records already label on their own (NIH RePORTER gives NIH, CDC and AHRQ);
# the rest of HHS is "HHS", as on USAspending records.
HHS_LABELS = {"HHS-NIH": "NIH", "HHS-CDC": "CDC", "HHS-AHRQ": "AHRQ"}

# Applicant-type codes that leave room for a university: 06 public and 20 private higher education, 25 "others,
# see eligibility text" and 99 unrestricted. A call listing none of these (and at least one type) rules them out.
UNIVERSITY_TYPES = {"06", "20"}
OPEN_TYPES = UNIVERSITY_TYPES | {"25", "99"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def top_agency(agency_code: str | None) -> str:
    return (agency_code or "").split("-", 1)[0]


# ---------- fetch ----------

def search(c) -> list[dict]:
    """Every posted and forecasted call, from all agencies."""
    hits: dict[str, dict] = {}
    start = 0
    while True:
        data = request_json(c, "POST", SEARCH_URL, json={
            "oppStatuses": STATUSES, "rows": PAGE_SIZE, "startRecordNum": start})["data"]
        page = data.get("oppHits") or []
        for hit in page:
            hits.setdefault(str(hit["id"]), hit)  # a call can move between pages while paging
        start += PAGE_SIZE
        if not page or start >= data["hitCount"]:
            return list(hits.values())
        time.sleep(DETAIL_PAUSE)


def fetch(pause: float = DETAIL_PAUSE, log=print) -> dict:
    """Search, keep the agencies in AGENCIES, and fetch each call's details. Eligibility is filtered in normalize.

    Returns {"fetched_at", "opportunities": [fetchOpportunity data plus the search hit as "_hit"], "failed": [ids]}.
    """
    fetched_at = _now()
    with client() as c:
        hits = [h for h in search(c) if top_agency(h.get("agencyCode")) in AGENCIES]
        log(f"grants.gov: {len(hits)} posted or forecasted calls from the agencies in scope; fetching details")
        details, failed = [], []
        for i, hit in enumerate(hits, 1):
            try:
                res = request_json(c, "POST", DETAIL_URL, json={"opportunityId": int(hit["id"])})
                if res.get("errorcode") not in (0, None) or not res.get("data"):
                    raise ValueError(res.get("msg") or "no data")
                details.append({**res["data"], "_hit": hit})
            except Exception as exc:  # one bad call shouldn't lose the rest
                failed.append(hit["id"])
                log(f"grants.gov: skipped {hit['id']} ({exc!r})")
            if i % 200 == 0:
                log(f"grants.gov: {i}/{len(hits)}")
            time.sleep(pause)
    if hits and len(failed) > len(hits) / 2:
        raise RuntimeError(f"Grants.gov detail requests failed for {len(failed)} of {len(hits)} calls")
    return {"fetched_at": fetched_at, "opportunities": details, "failed": failed}


# ---------- normalize ----------

_HAS_HTML = re.compile(r"</?(p|br|div|li|ul|ol|span|strong|b|i|u|em|a|h[1-6]|table|font)\b[^>]*>", re.IGNORECASE)
_ESCAPED_HTML = re.compile(r"&lt;\s*/?(p|br|div|li|ul|ol|span|a|h[1-6])\b", re.IGNORECASE)
_BLOCK = re.compile(r"</?(p|div|ul|ol|h[1-6]|table|tr|blockquote|section)\b[^>]*>", re.IGNORECASE)
_LINE = re.compile(r"<br\s*/?>|</?li\b[^>]*>|</t[dh]>", re.IGNORECASE)
_TAG = re.compile(r"<!--.*?-->|<[^>]+>", re.DOTALL)


def strip_html(text: str | None) -> str:
    """The agency's text with HTML removed and its line breaks kept, words unchanged."""
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    if _ESCAPED_HTML.search(text):  # some agencies' HTML arrives escaped once more ("&lt;li&gt;")
        text = html.unescape(text)
    if _HAS_HTML.search(text):
        text = re.sub(r"\s+", " ", text)  # in HTML a raw line break is a space
        text = _LINE.sub("\n", _BLOCK.sub("\n\n", text))
        text = _TAG.sub("", text)
    for _ in range(3):  # entities escaped more than once ("&amp;nbsp;") come back in a second pass
        text, before = html.unescape(text), text
        if text == before:
            break
    text = text.replace("\xa0", " ").replace("\u202f", " ").replace("\u200b", "")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def paragraphs(text: str | None) -> list[str]:
    """Each line is a paragraph: Grants.gov text is typed into a form, so its line breaks are the agency's own.

    Text pasted from a document can be wrapped mid-sentence ("Since its" / "inception in 2011"); a line that
    doesn't end a sentence is joined to a next line that starts in lower case.
    """
    out: list[str] = []
    for line in (line for line in strip_html(text).split("\n") if line):
        if out and out[-1][-1] not in ".:;!?" and line[0].islower():
            out[-1] = f"{out[-1]} {line}"
        else:
            out.append(line)
    return out


def _iso(section: dict, key: str) -> str | None:
    """A date from `<key>Str` ('2027-10-19-00-00-00') or, failing that, `<key>` ('Oct 19, 2027 12:00:00 AM EDT')."""
    value = section.get(f"{key}Str") or ""
    if re.match(r"\d{4}-\d{2}-\d{2}", value):
        return value[:10]
    value = (section.get(key) or "").strip()
    try:
        return datetime.strptime(" ".join(value.split()[:3]), "%b %d, %Y").date().isoformat() if value else None
    except ValueError:
        return None


def _search_date(value: str | None) -> str | None:
    """The search hit's MM/DD/YYYY date."""
    try:
        return datetime.strptime(value, "%m/%d/%Y").date().isoformat() if value else None
    except ValueError:
        return None


def _amount(value) -> int | None:
    """Dollars or a count. Grants.gov writes 'none', '' or 0 when the agency gave no figure."""
    if isinstance(value, (int, float)):
        return int(value) or None
    digits = re.sub(r"[$,\s]", "", str(value or ""))
    return int(float(digits)) or None if re.fullmatch(r"\d+(\.\d+)?", digits) else None


def _text(value) -> str | None:
    """One line, entities decoded: titles and contact fields."""
    return " ".join(strip_html(str(value or "")).split()) or None


def _labels(items) -> list[str]:
    return [i["description"].strip() for i in items or [] if (i.get("description") or "").strip()]


def agency_label(agency_code: str | None) -> str:
    """The site's short label for a Grants.gov agency code: HHS-NIH11 -> NIH, DOD-AFOSR -> DOD, PAMS-SC -> DOE."""
    code = agency_code or ""
    for prefix, label in HHS_LABELS.items():
        if code == prefix or code.startswith(prefix):
            return label
    return AGENCIES.get(top_agency(code), top_agency(code) or "Federal")


def universities_may_apply(type_codes: set[str]) -> bool:
    """False only when the call lists applicant types and none of them leaves room for a university."""
    return not type_codes or bool(type_codes & OPEN_TYPES)


def _section(detail: dict, status: str) -> tuple[dict, bool]:
    """The synopsis for a posted call, else the forecast; and whether it is the forecast (dates are estimates)."""
    synopsis, forecast = detail.get("synopsis") or {}, detail.get("forecast") or {}
    if synopsis and (status != "forecasted" or not forecast):
        return synopsis, False
    return forecast, True


def normalize(raw: dict) -> dict:
    """Rows for the opportunity tables from fetch()'s output. Pure: no I/O.

    Calls whose applicant types rule out universities are left out; `skipped` counts them.
    """
    fetched_at = raw["fetched_at"]
    rows, programs, types = [], [], []
    skipped = 0
    for d in {str(d["id"]): d for d in raw["opportunities"]}.values():
        hit = d.get("_hit") or {}
        status = (hit.get("oppStatus") or d.get("ost") or "").lower()
        if status not in ("posted", "forecasted"):
            continue
        section, estimated = _section(d, status)
        applicant_types = {t["id"]: t.get("description") or "" for t in section.get("applicantTypes") or []}
        if not universities_may_apply(set(applicant_types)):
            skipped += 1
            continue

        oid = f"gg-{d['id']}"
        agency_code = d.get("owningAgencyCode") or section.get("agencyCode") or hit.get("agencyCode") or ""
        agency_name = (section.get("agencyName") or (d.get("agencyDetails") or {}).get("agencyName")
                       or hit.get("agency") or "")
        if estimated:
            close, note = _iso(section, "estApplicationResponseDate"), section.get("estApplicationResponseDateDesc")
        else:
            close = _iso(section, "responseDate") or _search_date(hit.get("closeDate"))
            note = section.get("responseDateDesc")
        rows.append({
            "id": oid,
            "number": d.get("opportunityNumber") or hit.get("number") or "",
            "title": _text(d.get("opportunityTitle") or hit.get("title")) or "",
            "status": status,
            "agency": agency_label(agency_code),
            "agency_code": agency_code,
            "agency_name": agency_name,
            "description": "\n\n".join(paragraphs(section.get("forecastDesc" if estimated else "synopsisDesc"))),
            "eligibility_text": strip_html(section.get("applicantEligibilityDesc")),
            "funding_instruments": "; ".join(_labels(section.get("fundingInstruments"))),
            "categories": "; ".join(_labels(section.get("fundingActivityCategories"))),
            "posted_date": _iso(section, "postingDate") or _search_date(hit.get("openDate")),
            "close_date": close,
            "close_date_estimated": int(estimated),
            "close_date_note": strip_html(note) or None,
            "archive_date": _iso(section, "archiveDate"),
            "award_floor": _amount(section.get("awardFloor")),
            "award_ceiling": _amount(section.get("awardCeiling")),
            "total_funding": _amount(section.get("estimatedFunding")),
            "expected_awards": _amount(section.get("numberOfAwards")),
            "cost_sharing": int(section.get("costSharing") in (True, "Y", "Yes", "true")),
            "contact_name": _text(section.get("agencyContactName")),
            "contact_email": _text(section.get("agencyContactEmail")),
            "contact_phone": _text(section.get("agencyContactPhone")),
            "source_url": SOURCE_URL.format(d["id"]),
            "updated_at": fetched_at,
        })
        numbers = [c.get("cfdaNumber") for c in d.get("cfdas") or []] or hit.get("cfdaList") or []
        programs += [{"opportunity_id": oid, "aln": a} for a in dict.fromkeys(filter(None, map(aln, numbers)))]
        types += [{"opportunity_id": oid, "code": code, "label": label} for code, label in sorted(applicant_types.items())]
    return {"opportunities": rows, "opportunity_programs": programs, "opportunity_applicant_types": types,
            "skipped_ineligible": skipped}


# ---------- refresh (calls only) ----------

def read_cache() -> dict | None:
    return json.loads(CACHE.read_text()) if CACHE.exists() else None


def write_cache(raw: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(raw))


def summary(conn) -> str:
    """Counts for the import report."""
    count = lambda sql: conn.execute(sql).fetchone()[0]
    by_status = conn.execute("SELECT status, COUNT(*) FROM opportunities GROUP BY 1 ORDER BY 1").fetchall()
    by_agency = conn.execute("SELECT agency, COUNT(*) FROM opportunities GROUP BY 1 ORDER BY 2 DESC, 1").fetchall()
    shared = count("""SELECT COUNT(DISTINCT op.opportunity_id) FROM opportunity_programs op
                      WHERE op.aln IN (SELECT aln FROM project_programs)""")
    return "\n".join([
        f"funding calls:  {count('SELECT COUNT(*) FROM opportunities')} "
        f"({', '.join(f'{s} {n}' for s, n in by_status)})",
        "  by agency:    " + ", ".join(f"{a} {n}" for a, n in by_agency),
        f"  universities: {count('''SELECT COUNT(DISTINCT opportunity_id) FROM opportunity_applicant_types
                                    WHERE code IN ('06', '20')''')} list higher education as an applicant type",
        f"  with an ALN:  {count('SELECT COUNT(DISTINCT opportunity_id) FROM opportunity_programs')} "
        f"({shared} share one with a Temple award)",
    ])


def refresh(conn, raw: dict) -> dict:
    """Replace the opportunity tables from fetch()'s output, recording the run in ingest_runs."""
    from ingest.load import load_opportunities

    started = _now()
    data = normalize(raw)
    load_opportunities(conn, data)
    with conn:
        conn.execute(
            "INSERT INTO ingest_runs (source, started_at, finished_at, fiscal_years, records_fetched, projects_loaded)"
            " VALUES ('grants-gov', ?, ?, ?, ?, ?)",
            (started, _now(), STATUSES, len(raw["opportunities"]), len(data["opportunities"])))
    return data


def main() -> None:
    from app.db import connect, init_schema

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--offline", action="store_true", help=f"reload calls from {CACHE.name} instead of the API")
    args = parser.parse_args()
    if args.offline:
        raw = read_cache()
        if raw is None:
            sys.exit(f"{CACHE} doesn't exist yet; run without --offline first")
    else:
        raw = fetch()
        write_cache(raw)
    conn = connect()
    init_schema(conn)
    data = refresh(conn, raw)
    where = "cache" if args.offline else "Grants.gov"
    print(f"read {len(raw['opportunities'])} calls from {where} (fetched {raw['fetched_at']}); "
          f"{data['skipped_ineligible']} left out because their applicant types rule out universities")
    print(summary(conn))


if __name__ == "__main__":
    main()
