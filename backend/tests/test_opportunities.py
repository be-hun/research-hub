"""Funding-call search, filters, facets and detail (app/opportunities.py). Calls are seeded with plain SQL; no network."""

from datetime import timedelta

from fastapi.testclient import TestClient

from app import opportunities
from app.main import create_app
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_nih_reporter import record


def setup(*records: dict):
    app = create_app()
    if records:
        load(app.state.db, merge([normalize(list(records))]))
    return app.state.db, TestClient(app)


def add_call(conn, n: int, title: str, *, number: str | None = None, status: str = "posted", agency: str = "NIH",
             close: int | None = 30, posted: int | None = -10, categories: str = "Health", codes=("06", "25"),
             alns=("93.393",), description: str = "A call for applications.") -> str:
    """A call closing `close` days from today (None: no date), posted `posted` days from today."""
    today = conn.execute("SELECT current_date").fetchone()[0]
    day = lambda offset: None if offset is None else (today + timedelta(days=offset)).isoformat()  # noqa: E731
    oid, number = f"gg-{n}", number or f"PA-27-{n:03d}"
    conn.execute("""
        INSERT INTO opportunities (id, number, title, status, agency, agency_code, agency_name, description,
            eligibility_text, funding_instruments, categories, posted_date, close_date, close_date_estimated,
            close_date_note, archive_date, award_floor, award_ceiling, total_funding, expected_awards, cost_sharing,
            contact_name, contact_email, contact_phone, source_url, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (oid, number, title, status, agency, f"HHS-{agency}", f"Agency {agency}", description,
          "Higher education institutions may apply.", "Grant; Cooperative Agreement", categories, day(posted),
          day(close), int(status == "forecasted"), None, day(close and close + 30), 100000, 500000, 2000000, 4, 0,
          "Grants Desk", "grants@example.gov", "301-555-0100", f"https://www.grants.gov/search-results-detail/{n}",
          "2026-11-01T00:00:00+00:00"))
    for code in codes:
        conn.execute("INSERT INTO opportunity_applicant_types VALUES (?, ?, ?)", (oid, code, f"Type {code}"))
    for aln in alns:
        conn.execute("INSERT INTO opportunity_programs VALUES (?, ?)", (oid, aln))
    conn.execute("INSERT INTO opportunities_fts VALUES (?, ?, ?, ?)",
                 (oid, title, description, f"{number} {agency} {categories}"))
    return oid


def find(conn, q: str = "", page: int = 1, agencies=(), statuses=(), categories=(), universities=False,
         closes_within=None, sort="deadline"):
    return opportunities.search(conn, q, page, list(agencies), list(statuses), list(categories), universities,
                                closes_within, sort)


def ids(response) -> list[str]:
    return [r.id for r in response.results]


def test_text_matches_words_call_number_and_agency():
    conn, _ = setup()
    add_call(conn, 1, "Cancer informatics tools", number="RFA-CA-27-019")
    add_call(conn, 2, "Soil microbiome", agency="NSF", description="Microbes in agricultural soil.")
    add_call(conn, 3, "Training grants", description="Supports training in cancer biology.")
    assert ids(find(conn, "cancer")) == ["gg-1", "gg-3"]
    assert ids(find(conn, "  rfa-ca-27-019 ")) == ["gg-1"]
    assert ids(find(conn, "nsf")) == ["gg-2"]
    assert ids(find(conn, '"cancer biology"')) == ["gg-3"]
    assert ids(find(conn, "cancer -training")) == ["gg-1"]
    assert find(conn, "quantum").total == 0


def test_filters():
    conn, _ = setup()
    add_call(conn, 1, "A", agency="NIH", categories="Health", close=10)
    add_call(conn, 2, "B", agency="NSF", categories="Science and Technology; Education", close=40, codes=("25",))
    add_call(conn, 3, "C", agency="DOD", categories="Health; Science and Technology", status="forecasted", close=None,
             codes=("20",))
    assert ids(find(conn, agencies=["NSF", "DOD"])) == ["gg-2", "gg-3"]
    assert ids(find(conn, statuses=["forecasted"])) == ["gg-3"]
    assert ids(find(conn, categories=["Education"])) == ["gg-2"]
    assert ids(find(conn, categories=["Education", "Health"])) == ["gg-1", "gg-2", "gg-3"]
    assert ids(find(conn, universities=True)) == ["gg-1", "gg-3"]
    assert ids(find(conn, closes_within=10)) == ["gg-1"]
    assert ids(find(conn, closes_within=60)) == ["gg-1", "gg-2"]
    assert ids(find(conn, agencies=["NIH"], categories=["Education"])) == []


def test_default_statuses_hide_closed_and_expired_calls():
    conn, _ = setup()
    add_call(conn, 1, "Open", close=5)
    add_call(conn, 2, "Forecast", status="forecasted", close=90)
    add_call(conn, 3, "Closed", status="closed", close=-40)
    add_call(conn, 4, "Expired but still posted", close=-1)
    add_call(conn, 5, "Closes today", close=0)
    add_call(conn, 6, "Overdue forecast", status="forecasted", close=-3)
    assert ids(find(conn)) == ["gg-5", "gg-1", "gg-2"]
    closed = find(conn, statuses=["closed"])
    assert ids(closed) == ["gg-3", "gg-6", "gg-4"]
    assert {r.status for r in closed.results} == {"closed"}  # the passed deadline wins over "posted" or "forecasted"
    assert ids(find(conn, statuses=["forecasted"])) == ["gg-2"]
    assert ids(find(conn, statuses=["posted", "closed"])) == ["gg-3", "gg-6", "gg-4", "gg-5", "gg-1"]


def test_sort_orders():
    conn, _ = setup()
    add_call(conn, 1, "Beta cancer screening", close=None, posted=-1)
    add_call(conn, 2, "Alpha training", close=20, posted=-30, description="Mentions cancer once.")
    add_call(conn, 3, "Gamma cancer cancer registry", close=5, posted=-5, number="RFA-CA-27-001")
    add_call(conn, 4, "Aardvark cohort", close=20, posted=None)
    assert ids(find(conn)) == ["gg-3", "gg-4", "gg-2", "gg-1"]  # soonest, ties by title, no date last
    assert ids(find(conn, sort="newest")) == ["gg-1", "gg-3", "gg-2", "gg-4"]
    assert ids(find(conn, "cancer", sort="relevance")) == ["gg-3", "gg-1", "gg-2"]  # title matches first
    assert ids(find(conn, "rfa-ca-27-001", sort="relevance")) == ["gg-3"]
    assert ids(find(conn, sort="relevance")) == ids(find(conn))  # no query: deadline order
    assert find(conn, sort="newest").sort == "newest"


def test_exact_call_number_ranks_first():
    conn, _ = setup()
    add_call(conn, 1, "NIH cancer center", description="See also PA-27-002 and NIH programs.")
    add_call(conn, 2, "Other", agency="NSF")
    assert ids(find(conn, "PA-27-002", sort="relevance"))[0] == "gg-2"


def test_facets_ignore_their_own_filter():
    conn, _ = setup()
    add_call(conn, 1, "Cancer A", agency="NIH", categories="Health")
    add_call(conn, 2, "Cancer B", agency="NIH", categories="Health; Education", status="forecasted")
    add_call(conn, 3, "Cancer C", agency="NSF", categories="Education")
    add_call(conn, 4, "Cancer D", agency="NSF", categories="Education", status="closed", close=-3)
    add_call(conn, 5, "Unrelated", agency="DOD", categories="Health")
    response = find(conn, "cancer", agencies=["NIH"], categories=["Health"])
    assert ids(response) == ["gg-1", "gg-2"]
    facets = response.facets
    # agencies: query + category + default status, not the agency filter
    assert [(f.value, f.count) for f in facets.agencies] == [("NIH", 2)]
    # categories: query + agency + status, not the category filter
    assert [(f.value, f.count) for f in facets.categories] == [("Health", 2), ("Education", 1)]
    # status: query + agency + category, including closed calls the default filter hides
    assert [(f.value, f.label, f.count) for f in facets.status] == [("forecasted", "Forecasted", 1), ("posted", "Open", 1)]
    everything = find(conn, "cancer").facets
    assert [(f.value, f.count) for f in everything.agencies] == [("NIH", 2), ("NSF", 1)]
    assert [(f.value, f.count) for f in everything.status] == [("posted", 2), ("closed", 1), ("forecasted", 1)]
    assert [(f.value, f.count) for f in everything.categories] == [("Education", 2), ("Health", 2)]


def test_pagination():
    conn, _ = setup()
    for n in range(1, 26):
        add_call(conn, n, f"Call {n:02d}", close=n)
    first, second, third = (find(conn, page=p) for p in (1, 2, 3))
    assert (first.total, first.pageSize, len(first.results)) == (25, opportunities.PAGE_SIZE, 20)
    assert ids(second) == [f"gg-{n}" for n in range(21, 26)] and second.page == 2
    assert third.results == [] and third.total == 25


def test_fields_and_days_left():
    conn, _ = setup()
    add_call(conn, 1, "Soon", close=7, categories="Health; Income Security and Social Services", alns=("93.393", "93.242"))
    add_call(conn, 2, "No date", close=None, codes=("25",), alns=())
    add_call(conn, 3, "Passed", close=-2)
    soon, no_date = find(conn).results
    assert (soon.daysLeft, no_date.daysLeft) == (7, None)
    assert soon.categories == ["Health", "Income Security and Social Services"]
    assert soon.programs == ["93.242", "93.393"] and no_date.programs == []
    assert (soon.universitiesEligible, no_date.universitiesEligible) == (True, False)
    assert soon.source.label == "Grants.gov" and soon.source.url.endswith("/1")
    assert soon.closeDateEstimated is False and soon.agencyName == "Agency NIH"
    assert find(conn, statuses=["closed"]).results[0].daysLeft == -2


def awards_under_program():
    """Two parent awards and a center-grant component, all under 93.393, plus an award under another listing."""
    conn, client = setup(
        record(appl_id=1, core_project_num="P30CA000001", fiscal_year=2024, project_title="Cancer center"),
        record(appl_id=2, core_project_num="P30CA000001", subproject_id=7001, fiscal_year=2024, project_title="Core B"),
        record(appl_id=3, core_project_num="R01CA000003", fiscal_year=2026, project_title="Tumor imaging"),
        record(appl_id=4, core_project_num="R01AG000004", project_title="Aging cohort"),
    )
    for pid, aln in [("nih-P30CA000001", "93.397"), ("nih-P30CA000001", "93.393"), ("nih-P30CA000001-7001", "93.393"),
                     ("nih-R01CA000003", "93.393"), ("nih-R01AG000004", "93.866")]:
        conn.execute("INSERT INTO project_programs VALUES (?, ?, ?)", (pid, aln, "Cancer Cause and Prevention Research"))
    return conn, client


def test_detail_with_past_parent_awards():
    conn, client = awards_under_program()
    add_call(conn, 1, "Cancer prevention", alns=("93.393", "93.397"), codes=("20", "06"),
             description="First paragraph.\n\nSecond paragraph,\nwith a line break.\n\n\n")
    add_call(conn, 2, "Unrelated", alns=("47.050",))
    detail = client.get("/api/opportunities/gg-1").json()
    assert detail["description"] == ["First paragraph.", "Second paragraph,\nwith a line break."]
    assert detail["eligibilityText"] == "Higher education institutions may apply."
    assert detail["applicantTypes"] == [{"code": "06", "label": "Type 06"}, {"code": "20", "label": "Type 20"}]
    assert detail["fundingInstruments"] == ["Grant", "Cooperative Agreement"]
    assert detail["contact"] == {"name": "Grants Desk", "email": "grants@example.gov", "phone": "301-555-0100"}
    assert (detail["totalFunding"], detail["costSharing"], detail["programs"]) == (2000000, False, ["93.393", "93.397"])
    assert detail["pastAwardCount"] == 2  # the component is part of its parent; the parent counts once
    assert [p["id"] for p in detail["pastAwards"]] == ["nih-R01CA000003", "nih-P30CA000001"]  # newest first
    assert detail["pastAwards"][0]["kind"] == "award" and detail["pastAwards"][0]["source"]["url"]
    unrelated = opportunities.detail(conn, "gg-2")
    assert (unrelated.pastAwardCount, unrelated.pastAwards) == (0, [])


def test_for_project_lists_open_calls_under_the_same_program():
    conn, client = awards_under_program()
    add_call(conn, 1, "Later", close=60)
    add_call(conn, 2, "Sooner", close=3)
    add_call(conn, 3, "Forecast", status="forecasted", close=None)
    add_call(conn, 4, "Closed", status="closed", close=-30)
    add_call(conn, 5, "Expired", close=-1)
    add_call(conn, 6, "Other program", close=1, alns=("47.050",))
    add_call(conn, 7, "Parent program only", close=2, alns=("93.397",))
    assert [o["id"] for o in client.get("/api/projects/nih-R01CA000003/opportunities").json()] == ["gg-2", "gg-1", "gg-3"]
    assert [o.id for o in opportunities.for_project(conn, "nih-P30CA000001")] == ["gg-7", "gg-2", "gg-1", "gg-3"]
    # a component also sees its parent's listings
    assert [o.id for o in opportunities.for_project(conn, "nih-P30CA000001-7001")] == ["gg-7", "gg-2", "gg-1", "gg-3"]
    assert opportunities.for_project(conn, "nih-R01AG000004") == []
    for n in range(10, 20):
        add_call(conn, n, f"More {n}", close=n)
    assert len(opportunities.for_project(conn, "nih-R01CA000003")) == opportunities.PROJECT_CALLS


def test_unknown_ids_are_404s():
    conn, client = setup(record())
    add_call(conn, 1, "Known")
    assert client.get("/api/opportunities/gg-1").status_code == 200
    assert client.get("/api/opportunities/gg-404").status_code == 404
    assert client.get("/api/projects/nih-UNKNOWN/opportunities").status_code == 404
    assert client.get("/api/projects/nih-R01AG000001/opportunities").json() == []
    assert opportunities.detail(conn, "gg-404") is None and opportunities.for_project(conn, "nope") is None


def test_search_route_passes_filters_through():
    conn, client = setup()
    add_call(conn, 1, "Cancer A", agency="NIH", close=5)
    add_call(conn, 2, "Cancer B", agency="NSF", close=50, codes=("25",))
    body = client.get("/api/opportunities", params=[("q", "cancer"), ("agency", "NIH"), ("agency", "NSF"),
                                                    ("universities", "true"), ("closes_within", "30")]).json()
    assert [r["id"] for r in body["results"]] == ["gg-1"]
    assert body["total"] == 1 and body["sort"] == "deadline" and body["results"][0]["daysLeft"] == 5
