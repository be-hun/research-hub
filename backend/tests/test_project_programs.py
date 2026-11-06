"""Assistance listing (ALN) numbers on Temple awards, from each award source, into project_programs."""

from app.db import connect, init_schema
from ingest import nih_reporter, nsf_awards, usaspending
from ingest.load import load, merge
from ingest.text import aln, alns
from tests.test_new_sources import usa_award
from tests.test_nih_reporter import record as nih_record
from tests.test_nsf_awards import award as nsf_award


def test_aln_format():
    assert [aln(v) for v in ("93.866", " 47.041 ", "93.86", "93866", "", None, "N/A", "93.XXX")] == \
        ["93.866", "47.041", "93.860", "93.866", None, None, None, None]
    assert alns("47.041, 47.049, 47.041") == ["47.041", "47.049"]


def test_nih_reporter_programs_cover_every_fiscal_year():
    data = nih_reporter.normalize([
        nih_record(appl_id=1, fiscal_year=2024, cfda_code="93.866"),
        nih_record(appl_id=2, fiscal_year=2025, cfda_code="93.866"),
        nih_record(appl_id=3, fiscal_year=2026, cfda_code="93.279"),
        nih_record(appl_id=4, core_project_num="R01AG000002", cfda_code=None),
    ])
    assert data["project_programs"] == [
        {"project_id": "nih-R01AG000001", "aln": "93.866", "title": ""},
        {"project_id": "nih-R01AG000001", "aln": "93.279", "title": ""},
    ]


def test_nsf_programs_split_a_list():
    data = nsf_awards.normalize([nsf_award(cfdaNumber="47.041, 47.049"), nsf_award(id="2600001", cfdaNumber="")])
    assert data["project_programs"] == [
        {"project_id": "nsf-2622544", "aln": "47.041", "title": ""},
        {"project_id": "nsf-2622544", "aln": "47.049", "title": ""},
    ]


def test_usaspending_programs_keep_the_title():
    award = usa_award(**{"Assistance Listings": [
        {"cfda_number": "12.431", "cfda_program_title": "BASIC SCIENTIFIC RESEARCH"},
        {"cfda_number": "12.420", "cfda_program_title": "MILITARY MEDICAL RESEARCH AND DEVELOPMENT"},
    ]})
    data = usaspending.normalize([award], 2022)
    assert data["project_programs"] == [
        {"project_id": "usa-W911NF2120007", "aln": "12.431", "title": "Basic Scientific Research"},
        {"project_id": "usa-W911NF2120007", "aln": "12.420", "title": "Military Medical Research and Development"},
    ]


def test_load_fills_project_programs_and_drops_duplicate_awards():
    nih = nih_reporter.normalize([nih_record(cfda_code="93.866")])
    nsf = nsf_awards.normalize([nsf_award(cfdaNumber="47.041")])
    # USAspending also lists the NIH award; its row goes with it.
    dupe = usa_award(**{"Award ID": "5R01AG000001-03", "generated_internal_id": "ASST_NON_5R01AG000001_075",
                        "Assistance Listings": [{"cfda_number": "93.866", "cfda_program_title": "AGING RESEARCH"}]})
    usa = usaspending.normalize([usa_award(), dupe], 2022)
    data = merge([nih, nsf, usa])
    conn = connect()
    init_schema(conn)
    load(conn, data)
    rows = conn.execute("""SELECT p.source, pp.aln, pp.title FROM project_programs pp
                           JOIN projects p ON p.id = pp.project_id ORDER BY 1""").fetchall()
    assert [tuple(r) for r in rows] == [("nih-reporter", "93.866", ""), ("nsf-awards", "47.041", ""),
                                        ("usaspending", "12.431", "Basic Scientific Research")]
