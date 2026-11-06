"""Matching funding calls to Temple researchers, both ways: deterministic overlap of stored fields, no model call."""

from fastapi.testclient import TestClient

from app import compatibility, opportunity_matches
from app.main import create_app
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_nih_reporter import record

NCI = {"agency_ic_admin": {"abbreviation": "NCI", "name": "National Cancer Institute"},
       "agency_ic_fundings": [{"abbreviation": "NCI", "name": "National Cancer Institute"}]}
PUBLIC_HEALTH = {"organization_type": {"name": "SCHOOLS OF PUBLIC HEALTH"}}

CANCER_CALL = dict(
    id="gg-1", number="RFA-CA-27-019", title="Cancer Informatics Technologies for Tumor Genomics",
    description=("This notice of funding opportunity invites applications that develop cancer informatics tools. "
                 "Cancer informatics software should help researchers analyze tumor genomics data."),
)


def grant(n: int, first: str, last: str, title: str, *, person: int | None = None, abstract: str = "",
          terms: str = "", **overrides) -> dict:
    """An NIH grant led by investigator `person` (default: their own, numbered n). NIA (aging) unless overridden."""
    return record(
        appl_id=n, core_project_num=f"R01CA{n:06d}", project_title=title, abstract_text=abstract or title,
        phr_text="", pref_terms=terms, project_detail_url=f"https://reporter.nih.gov/project-details/{n}",
        principal_investigators=[{"profile_id": person or n, "first_name": first, "middle_name": "", "last_name": last,
                                  "is_contact_pi": True}],
        **overrides,
    )


# Unrelated grants, so a word or phrase in one record is rare across the corpus.
FILLER = [grant(100 + i, f"FILL{chr(65 + i)}", "ER", title) for i, title in enumerate(
    ["Sleep in older adults", "Memory in aging", "Caregivers of people with dementia", "Exercise in aging",
     "Hearing in older adults", "Falls among seniors", "Retirement and cognition", "Aging muscle"])]


def setup(*grants: dict) -> tuple:
    app = create_app()
    load(app.state.db, merge([normalize(list(grants))]))
    return app, TestClient(app)


def add_call(conn, *, id: str, number: str = "PA-27-001", title: str, description: str = "", status: str = "posted",
             close: str | None = "2099-01-31", estimated: bool = False, agency: str = "NIH",
             agency_code: str = "HHS-NIH11", categories: str = "Health", alns: tuple[str, ...] = (),
             applicant_types: tuple[str, ...] = ("20",), updated: str = "2026-11-01T00:00:00") -> None:
    conn.execute("""
        INSERT INTO opportunities (id, number, title, status, agency, agency_code, agency_name, description,
            eligibility_text, funding_instruments, categories, posted_date, close_date, close_date_estimated,
            source_url, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 'Grant', ?, '2026-10-01', ?, ?, ?, ?)
    """, (id, number, title, status, agency, agency_code, "National Institutes of Health", description, categories,
          close, int(estimated), f"https://www.grants.gov/search-results-detail/{id[3:]}", updated))
    for aln in alns:
        conn.execute("INSERT INTO opportunity_programs (opportunity_id, aln) VALUES (?, ?)", (id, aln))
    for code in applicant_types:
        conn.execute("INSERT INTO opportunity_applicant_types (opportunity_id, code, label) VALUES (?, ?, ?)",
                     (id, code, "Higher education"))


def add_program(conn, project_id: str, aln: str) -> None:
    conn.execute("INSERT INTO project_programs (project_id, aln, title) VALUES (?, ?, '')", (project_id, aln))


def people(client: TestClient, call_id: str) -> list[dict]:
    response = client.get(f"/api/opportunities/{call_id}/researchers")
    assert response.status_code == 200
    return response.json()["researchers"]


def test_an_on_topic_researcher_outranks_an_off_topic_one():
    app, client = setup(
        grant(1, "ANA", "LOPEZ", "Cancer informatics for tumor genomics", **NCI),
        grant(2, "BEN", "OKAFOR", "Tumor biopsy imaging", **NCI),
        grant(3, "CARA", "DIAZ", "Sleep in older adults"),
    )
    add_call(app.state.db, **CANCER_CALL)
    body = client.get("/api/opportunities/gg-1/researchers").json()
    ranked = [r["person"]["researcherId"] for r in body["researchers"]]
    assert ranked[0] == "r-nih-1"
    assert "r-nih-3" not in ranked  # nothing in common with a cancer informatics call
    assert ranked.index("r-nih-1") < ranked.index("r-nih-2")
    assert body["notice"] == opportunity_matches.NOTICE
    first = body["researchers"][0]
    assert first["person"]["name"] == "Ana Lopez" and first["person"]["counts"]["grants"] == 1
    assert first["projectIds"] == ["nih-R01CA000001"]
    assert first["awardedUnderProgram"] is False


def test_bands_and_reasons_come_from_stored_fields():
    app, client = setup(
        grant(1, "ANA", "LOPEZ", "Cancer informatics for tumor genomics", **NCI),
        grant(2, "BEN", "OKAFOR", "Tumor biopsy imaging", **NCI),
        *FILLER,  # so the call's phrases are rare at Temple, as they would be
    )
    add_call(app.state.db, **CANCER_CALL)
    strong, good = people(client, "gg-1")
    # The call's institute (NCI, from its number) is the record's funder-defined topic, and two rare phrases match.
    assert strong["band"] == "Strong overlap"
    assert strong["reasons"] == ["1 NIH grant mentions “cancer informatics” and “tumor genomics”",
                                 "1 NIH grant in Cancer, a topic of this call"]
    # The shared topic alone.
    assert good["band"] == "Good overlap"
    assert good["reasons"] == ["1 NIH grant in Cancer, a topic of this call"]


def test_funded_under_the_same_program_is_a_clear_boost():
    same = "Tumor genomics pipelines"
    app, client = setup(
        grant(1, "ANA", "LOPEZ", same, **NCI),
        grant(2, "BEN", "OKAFOR", same, **NCI),  # identical record, and first by id without the program
    )
    add_program(app.state.db, "nih-R01CA000002", "93.393")
    add_call(app.state.db, **CANCER_CALL, alns=("93.393",))
    ranked = people(client, "gg-1")
    assert [r["person"]["researcherId"] for r in ranked] == ["r-nih-2", "r-nih-1"]
    boosted, plain = ranked
    assert boosted["awardedUnderProgram"] is True and plain["awardedUnderProgram"] is False
    assert boosted["reasons"][0] == "Funded under the same program (93.393)"
    assert boosted["projectIds"][0] == "nih-R01CA000002"
    data = opportunity_matches._data(app.state.db)
    call = opportunity_matches._calls(app.state.db, data, [{"id": "gg-1", "updated_at": "2026-11-01T00:00:00"}])["gg-1"]
    with_program = opportunity_matches._fit(data, call, ["nih-R01CA000002"], {"93.393": ["nih-R01CA000002"]})
    without = opportunity_matches._fit(data, call, ["nih-R01CA000001"], {})
    assert with_program.points == min(100, without.points + opportunity_matches.PROGRAM_POINTS)


def test_the_program_alone_lists_a_researcher_with_no_shared_words():
    app, client = setup(grant(1, "ANA", "LOPEZ", "Sleep in older adults"))
    add_program(app.state.db, "nih-R01CA000001", "93.866")
    add_call(app.state.db, id="gg-2", title="Cancer informatics", alns=("93.866",))
    [match] = people(client, "gg-2")
    assert match["band"] == "Good overlap"
    assert match["reasons"] == ["Funded under the same program (93.866)"]


def test_researcher_page_lists_open_calls_only():
    app, client = setup(grant(1, "ANA", "LOPEZ", "Cancer informatics for tumor genomics", **NCI))
    conn = app.state.db
    add_call(conn, **CANCER_CALL)
    add_call(conn, id="gg-2", number="RFA-CA-27-020", title="Cancer informatics", close="2020-01-01")  # passed
    add_call(conn, id="gg-3", number="RFA-CA-27-021", title="Cancer informatics", status="closed")
    add_call(conn, id="gg-4", number="NOT-CA-27-001", title="Cancer informatics forecast", status="forecasted",
             close="2099-06-30", estimated=True, alns=("93.393",), applicant_types=("25",))
    add_call(conn, id="gg-5", number="PA-27-002", title="Cancer informatics, rolling", close=None)
    add_call(conn, id="gg-6", title="Sleep in older adults")  # open, but nothing in common
    response = client.get("/api/researchers/r-nih-1/opportunities")
    assert response.status_code == 200
    rows = response.json()
    assert {r["opportunity"]["id"] for r in rows} == {"gg-1", "gg-4", "gg-5"}
    by_id = {r["opportunity"]["id"]: r for r in rows}
    forecast = by_id["gg-4"]["opportunity"]
    assert forecast["status"] == "forecasted" and forecast["closeDateEstimated"] is True
    assert forecast["daysLeft"] > 0 and forecast["programs"] == ["93.393"]
    assert forecast["universitiesEligible"] is False and by_id["gg-1"]["opportunity"]["universitiesEligible"] is True
    assert by_id["gg-5"]["opportunity"]["daysLeft"] is None
    assert by_id["gg-1"]["opportunity"]["source"]["url"] == "https://www.grants.gov/search-results-detail/1"
    assert by_id["gg-1"]["opportunity"]["categories"] == ["Health"]
    assert all(r["projectIds"] == ["nih-R01CA000001"] and r["reasons"] for r in rows)


def test_both_directions_give_the_same_band():
    app, client = setup(
        grant(1, "ANA", "LOPEZ", "Cancer informatics for tumor genomics", **NCI),
        grant(2, "BEN", "OKAFOR", "Tumor genomics", **NCI, **PUBLIC_HEALTH),
    )
    add_call(app.state.db, **CANCER_CALL)
    listed = client.get("/api/opportunities/gg-1/researchers").json()
    assert listed["crossCollege"] is True  # medicine and public health
    for person in listed["researchers"]:
        rid = person["person"]["researcherId"]
        [own] = client.get(f"/api/researchers/{rid}/opportunities").json()
        assert own["band"] == person["band"] and own["reasons"] == person["reasons"]


def test_unknown_ids_are_404():
    app, client = setup(grant(1, "ANA", "LOPEZ", "Cancer informatics", **NCI))
    assert client.get("/api/opportunities/gg-404/researchers").status_code == 404
    assert client.get("/api/researchers/r-nope/opportunities").status_code == 404
    assert client.get("/api/researchers/r-nih-1/opportunities").json() == []  # known, but no calls are loaded


def test_ties_are_broken_deterministically_not_by_name():
    same = "Cancer informatics for tumor genomics"
    app, client = setup(
        grant(1, "ZED", "ZULU", same, **NCI),  # one record
        grant(2, "AARON", "ABLE", same, **NCI),  # two records
        grant(3, "AARON", "ABLE", same, person=2, **NCI),
        grant(4, "MIA", "MOSS", same, fiscal_year=2026, **NCI),  # one record, newer
        grant(5, "BO", "BAKER", same, **NCI),  # one record, as Zed Zulu; ids decide
    )
    add_call(app.state.db, **CANCER_CALL)
    first = people(client, "gg-1")
    assert len({r["band"] for r in first}) == 1
    assert [r["person"]["name"] for r in first] == ["Aaron Able", "Mia Moss", "Zed Zulu", "Bo Baker"]
    opportunity_matches._results.clear()
    assert people(client, "gg-1") == first


def test_boilerplate_is_not_a_shared_interest():
    app, client = setup(grant(1, "ANA", "LOPEZ", "Applicant eligibility deadline budget", terms="Funding opportunity"))
    add_call(app.state.db, id="gg-1", title="Funding opportunity for applicants",
             description="Applicants must meet the eligibility deadline and budget.")
    assert people(client, "gg-1") == []


def test_the_word_index_counts_like_the_corpus():
    app, _ = setup(
        grant(1, "ANA", "LOPEZ", "Cancer informatics for tumor genomics", **NCI),
        grant(2, "BEN", "OKAFOR", "Informatics of cancer", **NCI),
    )
    data = compatibility.corpus(app.state.db)
    index = opportunity_matches._data(app.state.db).index
    for phrase in ("cancer", "cancer informatic", "informatic of cancer", "tumor genomic", "genomic tumor", "absent"):
        assert index.frequency(phrase) == data.frequency(phrase)
        assert index.weight(phrase) == data.weight(phrase)
