import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from ingest import nih_reporter, nsf_awards
from ingest.load import load, merge
from tests.test_nih_reporter import record
from tests.test_nsf_awards import award


@pytest.fixture
def client():
    app = create_app(":memory:")
    nih = nih_reporter.normalize([
        record(),  # NIA, medicine, active, FY2025 $500K
        record(appl_id=2, fiscal_year=2024, award_amount=400000),
        # A center-grant component: its money is part of the parent's, so it must not be counted twice.
        record(appl_id=3, subproject_id=7001, award_amount=100000, project_title="Core C"),
    ])
    nsf = nsf_awards.normalize([award(activeAwd="false")])  # CBET, engineering, ended
    load(app.state.db, merge([nih, nsf]))
    return TestClient(app)


def test_overview_counts_parents_only(client):
    o = client.get("/api/overview").json()
    assert o["totals"] == {"awards": 2, "active": 1, "researchers": 3, "colleges": 2}
    by_college = {c["college"]: c for c in o["byCollege"]}
    assert by_college["medicine"]["funding"] == 900000  # FY2024 + FY2025, component excluded
    assert by_college["engineering"]["active"] == 0
    assert [y["fiscalYear"] for y in o["trend"]] == [2024, 2025]
    assert o["trend"][-1]["mayBeIncomplete"] is True
    assert {t["id"] for t in o["topics"]} == {"aging", "engineering"}
    assert all(p["title"] != "Core C" for p in o["recent"])


def test_topic_detail(client):
    t = client.get("/api/topics/aging").json()
    assert t["topic"]["awards"] == 1 and t["topic"]["funding"] == 900000
    assert t["funders"] == ["National Institute on Aging (NIA)"]
    assert [p["name"] for p in t["people"]] == ["Domenico Pratico"]
    assert client.get("/api/topics/nope").status_code == 404


def test_search_filters_and_facets(client):
    everything = client.get("/api/search").json()
    assert everything["total"] == 2
    assert {f["value"]: f["count"] for f in everything["facets"]["status"]} == {"active": 1, "ended": 1}

    active = client.get("/api/search", params={"status": "active"}).json()
    assert [r["agency"] for r in active["results"]] == ["NIH"]
    # A facet ignores its own filter, so the other status stays selectable.
    assert {f["value"] for f in active["facets"]["status"]} == {"active", "ended"}

    topic = client.get("/api/search", params={"topic": "engineering"}).json()
    assert [r["id"] for r in topic["results"]] == ["nsf-2622544"]


def test_project_detail_has_yearly_funding_and_topics(client):
    d = client.get("/api/projects/nih-R01AG000001").json()
    assert d["fundingByYear"] == [{"fiscalYear": 2024, "amount": 400000}, {"fiscalYear": 2025, "amount": 500000}]
    assert d["topics"] == [{"id": "aging", "name": "Aging & Alzheimer's"}]
    assert d["active"] is True and d["agency"] == "NIH"
