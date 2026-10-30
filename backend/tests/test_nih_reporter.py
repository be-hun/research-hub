from app.db import connect, init_schema
from ingest.load import load, merge
from ingest.nih_reporter import normalize, person_name, summary_of
from ingest.text import paragraphs, title_case


def record(**overrides) -> dict:
    base = {
        "appl_id": 1,
        "subproject_id": None,
        "fiscal_year": 2025,
        "core_project_num": "R01AG000001",
        "project_title": "Proteostasis in Down syndrome",
        "abstract_text": "PROJECT SUMMARY\nFirst sentence of the abstract. It wraps at a fixed\nwidth across lines.\nShort end.\nSecond paragraph starts here.",
        "phr_text": "PROJECT NARRATIVE\nPeople with Down syndrome develop Alzheimer's-like disease. More text.",
        "pref_terms": "Alzheimer's Disease;Down Syndrome",
        "agency_code": "NIH",
        "activity_code": "R01",
        "agency_ic_admin": {"abbreviation": "NIA", "name": "National Institute on Aging"},
        "agency_ic_fundings": [{"abbreviation": "NIA", "name": "National Institute on Aging"}],
        "organization": {"dept_type": "INTERNAL MEDICINE/MEDICINE"},
        "organization_type": {"name": "SCHOOLS OF MEDICINE"},
        "project_start_date": "2022-12-01T00:00:00",
        "project_end_date": "2027-11-30T00:00:00",
        "award_amount": 500000,
        "is_active": True,
        "principal_investigators": [
            {"profile_id": 10, "first_name": "DOMENICO", "middle_name": "", "last_name": "PRATICO", "is_contact_pi": True},
        ],
        "project_detail_url": "https://reporter.nih.gov/project-details/1",
        "date_added": "2025-01-03T17:04:19",
    }
    return {**base, **overrides}


def test_title_case():
    assert title_case("PUBLIC HEALTH & PREV MEDICINE") == "Public Health & Prev Medicine"
    assert title_case("MCDONALD") == "McDonald"
    assert person_name({"first_name": "LISA", "middle_name": "A", "last_name": "O'BRIEN"}) == "Lisa A O'Brien"


def test_paragraphs_strip_header_and_unwrap():
    paras = paragraphs(record()["abstract_text"])
    assert paras[0].startswith("First sentence")
    assert "fixed width across lines." in paras[0]
    assert paras[-1] == "Second paragraph starts here."


def test_summary_prefers_narrative():
    r = record()
    assert summary_of(r, paragraphs(r["abstract_text"])).startswith("People with Down syndrome")


def test_dedupe_keeps_latest_fiscal_year_and_all_years():
    data = normalize([
        record(appl_id=1, fiscal_year=2024, project_title="Old title"),
        record(appl_id=2, fiscal_year=2025, project_title="New title"),
    ])
    assert len(data["projects"]) == 1
    assert data["projects"][0]["title"] == "New title"
    assert data["projects"][0]["verification"] == "public-award-record"
    assert {y["fiscal_year"] for y in data["award_years"]} == {2024, 2025}


def test_repeated_records_are_dropped():
    data = normalize([record(), record()])
    assert len(data["award_years"]) == 1


def test_subprojects_stay_separate():
    data = normalize([record(appl_id=1), record(appl_id=2, subproject_id=7001)])
    assert {p["id"] for p in data["projects"]} == {"nih-R01AG000001", "nih-R01AG000001-7001"}


def test_missing_department_falls_back_to_pi_college():
    data = merge([normalize([
        record(),
        record(appl_id=3, core_project_num="P30XX000002", organization={"dept_type": None},
               organization_type={"name": "Domestic Higher Education"}),
    ])])
    assert {"project_id": "nih-P30XX000002", "college": "medicine"} in data["project_colleges"]
    assert data["unmapped_project_ids"] == []
    assert data["researchers"][0]["college"] == "medicine"


def test_load_is_repeatable():
    conn = connect(":memory:")
    init_schema(conn)
    data = merge([normalize([record()])])
    load(conn, data)
    load(conn, data)
    assert conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0] == 1
    assert conn.execute("SELECT COUNT(*) FROM projects_fts WHERE projects_fts MATCH 'syndrome'").fetchone()[0] == 1
    assert conn.execute("SELECT name FROM researchers").fetchone()[0] == "Domenico Pratico"
