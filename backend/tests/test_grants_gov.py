"""Grants.gov funding calls: normalize from the real response shapes and load. No network."""

import json

from app.db import connect, init_schema
from ingest import grants_gov, run
from ingest.grants_gov import agency_label, normalize, paragraphs, strip_html
from ingest.load import load_opportunities

FETCHED_AT = "2026-11-06T12:00:00+00:00"


def hit(**overrides) -> dict:
    """A search2 `oppHits` entry."""
    base = {"id": "359892", "number": "RFA-CA-27-019",
            "title": "Early-Stage Development of Informatics Technologies for Cancer Research and Management",
            "agencyCode": "HHS-NIH11", "agency": "National Institutes of Health", "openDate": "05/21/2026",
            "closeDate": "10/19/2027", "oppStatus": "posted", "docType": "synopsis", "cfdaList": ["93.393", "93.394"]}
    return {**base, **overrides}


def synopsis(**overrides) -> dict:
    base = {
        "agencyCode": "HHS-NIH11", "agencyName": "National Institutes of Health",
        "agencyDetails": {"code": "NIH", "agencyName": "National Institutes of Health", "topAgencyCode": "HHS"},
        "agencyContactName": "National Institutes of Health", "agencyContactEmail": "nciitcr@mail.nih.gov",
        "agencyContactPhone": "301-402-2541",
        "synopsisDesc": "<p>This Notice of Funding Opportunity (NOFO) solicits applications for\n informatics "
                        "technologies.</p><p>Tools &amp; resources<br>for cancer research.</p>",
        "responseDate": "Oct 19, 2027 12:00:00 AM EDT", "responseDateStr": "2027-10-19-00-00-00",
        "postingDate": "May 21, 2026 12:00:00 AM EDT", "postingDateStr": "2026-05-21-00-00-00",
        "archiveDate": "Dec 19, 2027 12:00:00 AM EST", "archiveDateStr": "2027-12-19-00-00-00",
        "costSharing": False, "numberOfAwards": "5", "estimatedFunding": "2400000", "awardCeiling": "300000",
        "awardFloor": "50000",
        "applicantEligibilityDesc": "Refer to Section III. Eligibility Information in the NOFO.\n"
                                    "  -Non-domestic (non-U.S.) Entities are not eligible to apply.",
        "applicantTypes": [{"id": "07", "description": "Native American tribal governments (Federally recognized)"},
                           {"id": "20", "description": "Private institutions of higher education"},
                           {"id": "06", "description": "Public and State controlled institutions of higher education"}],
        "fundingInstruments": [{"id": "CA", "description": "Cooperative Agreement"}],
        "fundingActivityCategories": [{"id": "HL", "description": "Health"}],
    }
    return {**base, **overrides}


def forecast(**overrides) -> dict:
    base = {
        "agencyCode": "HHS-OPHS", "agencyName": "Office of the Assistant Secretary for Health",
        "forecastDesc": "The Office of Minority Health announces the anticipated availability of funds.\r\n"
                        "Applications are expected in spring.",
        "postingDate": "Aug 01, 2024 12:00:00 AM EDT", "postingDateStr": "2024-08-01-00-00-00",
        "estApplicationResponseDate": "Jun 23, 2027 12:00:00 AM EDT",
        "estApplicationResponseDateStr": "2027-06-23-00-00-00",
        "estApplicationResponseDateDesc": "Applications must be submitted electronically no later than 6:00 pm ET.",
        "costSharing": False, "numberOfAwards": "9", "estimatedFunding": "5000000", "awardCeiling": "600000",
        "awardFloor": "450000", "agencyContactName": "Stacey Williams", "agencyContactEmail": "OMHGrants@hhs.gov",
        "agencyContactPhone": "240-453-8444", "applicantEligibilityDesc": "",
        "applicantTypes": [{"id": "25", "description": "Others (see text field entitled \"Additional Information on "
                                                       "Eligibility\" for clarification)"}],
        "fundingInstruments": [{"id": "G", "description": "Grant"}],
        "fundingActivityCategories": [{"id": "HL", "description": "Health"}],
    }
    return {**base, **overrides}


def detail(**overrides) -> dict:
    """A fetchOpportunity `data` object, with the search hit fetch() attaches as `_hit`."""
    base = {
        "id": 359892, "opportunityNumber": "RFA-CA-27-019",
        "opportunityTitle": "Early-Stage Development of Informatics Technologies for Cancer Research and "
                            "Management (U01 Clinical Trial Optional)",
        "owningAgencyCode": "HHS-NIH11",
        "agencyDetails": {"code": "NIH", "agencyName": "National Institutes of Health", "topAgencyCode": "HHS"},
        "synopsis": synopsis(), "forecast": forecast(),
        "cfdas": [{"cfdaNumber": "93.393", "programTitle": "Cancer Cause and Prevention Research"},
                  {"cfdaNumber": "93.394", "programTitle": "Cancer Detection and Diagnosis Research"}],
        "_hit": hit(),
    }
    return {**base, **overrides}


def forecasted(**overrides) -> dict:
    return detail(id=355824, opportunityNumber="MP-CPI-25-001", owningAgencyCode="HHS-OPHS",
                  opportunityTitle="Addressing Dementia Disparities", synopsis=None, forecast=forecast(),
                  cfdas=[{"cfdaNumber": "93.137", "programTitle": "Community Programs to Improve Minority Health"}],
                  _hit=hit(id="355824", agencyCode="HHS-OPHS", oppStatus="forecasted", closeDate="",
                           cfdaList=["93.137"]), **overrides)


def raw(*details) -> dict:
    return {"fetched_at": FETCHED_AT, "opportunities": list(details), "failed": []}


def test_normalize_posted_call():
    data = normalize(raw(detail()))
    (o,) = data["opportunities"]
    assert o["id"] == "gg-359892" and o["number"] == "RFA-CA-27-019" and o["status"] == "posted"
    assert o["source_url"] == "https://www.grants.gov/search-results-detail/359892"
    assert (o["agency"], o["agency_code"], o["agency_name"]) == ("NIH", "HHS-NIH11", "National Institutes of Health")
    assert (o["posted_date"], o["close_date"], o["archive_date"]) == ("2026-05-21", "2027-10-19", "2027-12-19")
    assert o["close_date_estimated"] == 0 and o["close_date_note"] is None
    assert (o["award_floor"], o["award_ceiling"], o["total_funding"], o["expected_awards"]) == (50000, 300000, 2400000, 5)
    assert (o["funding_instruments"], o["categories"], o["cost_sharing"]) == ("Cooperative Agreement", "Health", 0)
    assert (o["contact_email"], o["contact_phone"]) == ("nciitcr@mail.nih.gov", "301-402-2541")
    assert o["updated_at"] == FETCHED_AT
    (o,) = normalize(raw(detail(opportunityTitle="Worker Training Program&rsquo;s (Research &amp; Engineering)&#8203;")))[
        "opportunities"]
    assert o["title"] == "Worker Training Program\u2019s (Research & Engineering)"
    assert [p["aln"] for p in data["opportunity_programs"]] == ["93.393", "93.394"]
    assert [t["code"] for t in data["opportunity_applicant_types"]] == ["06", "07", "20"]


def test_html_is_stripped_into_paragraphs():
    (o,) = normalize(raw(detail()))["opportunities"]
    assert o["description"] == ("This Notice of Funding Opportunity (NOFO) solicits applications for informatics "
                                "technologies.\n\nTools & resources for cancer research.")
    assert strip_html("<div id=\"_com_1\">\n\nThe <b>Plant</b> Genome&nbsp;Program</div><!-- note -->") == \
        "The Plant Genome Program"
    # Some agencies' HTML is escaped twice.
    assert strip_html("Only:&lt;ul&gt;&lt;li&gt;Universities&amp;rsquo; campuses&lt;/li&gt;&lt;/ul&gt;") == \
        "Only:\n\nUniversities\u2019 campuses"
    # Plain text keeps the agency's own line breaks; the words are untouched.
    assert paragraphs("First line.\r\n\r\nSecond  line.\nThird") == ["First line.", "Second line.", "Third"]
    assert paragraphs("Since its\n\ninception in 2011, AEIF has funded\nprojects.\nNext") == \
        ["Since its inception in 2011, AEIF has funded projects.", "Next"]


def test_eligibility_text_is_kept_verbatim():
    (o,) = normalize(raw(detail()))["opportunities"]
    assert o["eligibility_text"] == ("Refer to Section III. Eligibility Information in the NOFO.\n"
                                     "-Non-domestic (non-U.S.) Entities are not eligible to apply.")


def test_forecast_uses_the_estimated_deadline():
    data = normalize(raw(forecasted()))
    (o,) = data["opportunities"]
    assert (o["status"], o["close_date"], o["close_date_estimated"]) == ("forecasted", "2027-06-23", 1)
    assert o["close_date_note"] == "Applications must be submitted electronically no later than 6:00 pm ET."
    assert o["description"] == ("The Office of Minority Health announces the anticipated availability of funds."
                                "\n\nApplications are expected in spring.")
    assert o["agency"] == "HHS" and o["contact_name"] == "Stacey Williams"
    assert data["opportunity_programs"] == [{"opportunity_id": "gg-355824", "aln": "93.137"}]


def test_posted_call_without_a_deadline_keeps_the_agency_wording():
    s = synopsis(responseDate="", responseDateStr="", responseDateDesc="Proposals accepted anytime",
                 awardCeiling="none", awardFloor="none")
    (o,) = normalize(raw(detail(synopsis=s, forecast=None, _hit=hit(closeDate=""))))["opportunities"]
    assert (o["close_date"], o["close_date_note"]) == (None, "Proposals accepted anytime")
    assert (o["award_floor"], o["award_ceiling"]) == (None, None)


def test_dates_fall_back_to_the_long_form():
    s = synopsis(responseDateStr=None, postingDateStr=None)
    (o,) = normalize(raw(detail(synopsis=s)))["opportunities"]
    assert (o["posted_date"], o["close_date"]) == ("2026-05-21", "2027-10-19")


def test_calls_that_rule_out_universities_are_left_out():
    business = synopsis(applicantTypes=[{"id": "23", "description": "Small businesses"}])
    unrestricted = synopsis(applicantTypes=[{"id": "99", "description": "Unrestricted"}])
    no_types = synopsis(applicantTypes=[])
    data = normalize(raw(
        detail(id=1, synopsis=business, _hit=hit(id="1")),
        detail(id=2, synopsis=unrestricted, _hit=hit(id="2")),
        detail(id=3, synopsis=no_types, _hit=hit(id="3")),
        forecasted(),  # 25: others, see the eligibility text
    ))
    assert sorted(o["id"] for o in data["opportunities"]) == ["gg-2", "gg-3", "gg-355824"]
    assert data["skipped_ineligible"] == 1


def test_agency_labels_match_the_site():
    assert [agency_label(c) for c in ("HHS-NIH11", "HHS-CDC-NCHHSTP", "HHS-AHRQ", "HHS-HRSA", "NSF", "DOD-AFOSR",
                                      "PAMS-SC", "DOE-ARPAE", "USDOJ-OJP-NIJ", "DOS-ECA", "USDA-NIFA")] == \
        ["NIH", "CDC", "AHRQ", "HHS", "NSF", "DOD", "DOE", "DOE", "DOJ", "State", "USDA"]
    from ingest.usaspending import AGENCY_ABBREVIATIONS
    assert set(grants_gov.AGENCIES.values()) <= set(AGENCY_ABBREVIATIONS.values()) | {"NSF"}


def test_load_fills_every_opportunity_table():
    conn = connect()
    init_schema(conn)
    load_opportunities(conn, normalize(raw(detail(), forecasted())))
    load_opportunities(conn, normalize(raw(detail(), forecasted())))  # a rerun replaces, not duplicates
    rows = conn.execute("SELECT id, status, close_date_estimated FROM opportunities ORDER BY id").fetchall()
    assert [tuple(r) for r in rows] == [("gg-355824", "forecasted", 1), ("gg-359892", "posted", 0)]
    assert conn.execute("SELECT COUNT(*) FROM opportunity_programs").fetchone()[0] == 3
    assert conn.execute("SELECT COUNT(*) FROM opportunity_applicant_types").fetchone()[0] == 4
    (extra,) = conn.execute("SELECT extra FROM opportunities_fts WHERE opportunity_id = 'gg-359892'").fetchone()
    assert extra == "RFA CA 27 019 NIH National Institutes of Health Health"
    found = conn.execute("""SELECT opportunity_id FROM opportunities_fts
                            WHERE document @@ plainto_tsquery('english', 'informatics cancer')""").fetchall()
    assert [r[0] for r in found] == ["gg-359892"]


def test_offline_import_without_a_cache_skips_calls(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(grants_gov, "CACHE", tmp_path / "grants_gov.json")
    conn = connect()
    init_schema(conn)
    run.import_calls(conn, offline=True)
    assert "skipped" in capsys.readouterr().out
    assert conn.execute("SELECT COUNT(*) FROM opportunities").fetchone()[0] == 0

    (tmp_path / "grants_gov.json").write_text(json.dumps(raw(detail())))
    run.import_calls(conn, offline=True)
    assert conn.execute("SELECT COUNT(*) FROM opportunities").fetchone()[0] == 1


def test_a_failed_fetch_keeps_the_previous_calls(monkeypatch, capsys):
    conn = connect()
    init_schema(conn)
    load_opportunities(conn, normalize(raw(detail())))

    def broken(*args, **kwargs):
        raise RuntimeError("Grants.gov is down")

    monkeypatch.setattr(grants_gov, "fetch", broken)
    run.import_calls(conn, offline=False)  # doesn't raise
    assert "not updated" in capsys.readouterr().out
    assert conn.execute("SELECT COUNT(*) FROM opportunities").fetchone()[0] == 1


def test_a_refresh_that_fetches_far_fewer_calls_keeps_the_stored_ones():
    assert grants_gov.too_few(fetched=0, stored=1393)
    assert grants_gov.too_few(fetched=600, stored=1393)
    assert not grants_gov.too_few(fetched=1300, stored=1393)
    assert not grants_gov.too_few(fetched=5, stored=0)  # first import into an empty database
