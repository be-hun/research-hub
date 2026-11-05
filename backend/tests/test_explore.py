import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from ingest import clinical_trials, nih_reporter, nsf_awards, openalex
from ingest.load import load, merge
from tests.test_new_sources import OPENALEX_FUNDERS, trial, work
from tests.test_nih_reporter import record
from tests.test_nsf_awards import award


@pytest.fixture
def client():
    app = create_app()
    nih = nih_reporter.normalize([
        record(),  # NIA, medicine, active, FY2025 $500K
        record(appl_id=2, fiscal_year=2024, award_amount=400000),
        # A center-grant component: its money is part of the parent's, so it must not be counted twice.
        record(appl_id=3, subproject_id=7001, award_amount=100000, project_title="Core C"),
    ])
    nsf = nsf_awards.normalize([award(activeAwd="false")])  # CBET, engineering, ended
    ct = clinical_trials.normalize([trial()], 2022)  # recruiting, Temple + Pfizer
    pubs = openalex.normalize({"works": [work()], "funders": OPENALEX_FUNDERS})
    load(app.state.db, merge([nih, nsf, ct, pubs]))
    return TestClient(app)


def test_overview_counts_parents_only(client):
    o = client.get("/api/overview").json()
    assert o["totals"] == {"awards": 2, "active": 1, "trials": 1, "recruiting": 1, "publications": 1,
                           "researchers": 4, "colleges": 3}
    by_college = {c["college"]: c for c in o["byCollege"]}
    assert by_college["medicine"]["funding"] == 900000  # FY2024 + FY2025, component excluded
    assert by_college["engineering"]["active"] == 0
    assert [y["fiscalYear"] for y in o["trend"]] == [2024, 2025]
    assert o["trend"][-1]["mayBeIncomplete"] is True
    assert {t["id"] for t in o["topics"]} >= {"aging", "engineering", "addiction", "cancer"}
    assert all(p["title"] != "Core C" for p in o["recent"])
    types = {t["type"]: t for t in o["fundingTypes"]}
    assert types["industry"]["trials"] == 1 and types["foundation"]["publications"] == 1
    assert types["federal"]["awards"] == 2
    assert [a["agency"] for a in o["federalByAgency"]] == ["NIH", "NSF"]
    assert [p["kind"] for p in o["recruiting"]] == ["trial"]
    assert [p["kind"] for p in o["publications"]] == ["publication"]


def test_search_type_and_funding_filters(client):
    everything = client.get("/api/search").json()
    assert {f["value"]: f["count"] for f in everything["facets"]["kinds"]} == {"award": 2, "trial": 1, "publication": 1}
    industry = client.get("/api/search", params={"funding": "industry"}).json()
    assert [r["id"] for r in industry["results"]] == ["ct-NCT01234567"]
    assert industry["results"][0]["statusLabel"] == "Recruiting"
    assert "Industry" in industry["results"][0]["fundingTypes"]
    pubs = client.get("/api/search", params={"kind": "publication"}).json()
    assert pubs["total"] == 1 and pubs["results"][0]["kind"] == "publication"


def test_trial_and_publication_detail_facts(client):
    t = client.get("/api/projects/ct-NCT01234567").json()
    assert [f["label"] for f in t["facts"]][:2] == ["Status", "Lead sponsor"]
    assert t["facts"][-1]["href"] == "https://clinicaltrials.gov/study/NCT01234567"
    p = client.get("/api/projects/pub-W1").json()
    assert [f["type"] for f in p["funders"]] == ["Foundations & nonprofits", "State & international government"]


def test_topic_detail(client):
    t = client.get("/api/topics/aging").json()
    assert t["topic"]["awards"] == 1 and t["topic"]["funding"] == 900000
    assert t["funders"] == ["National Institute on Aging (NIA)"]
    assert [p["name"] for p in t["people"]] == ["Domenico Pratico"]
    assert client.get("/api/topics/nope").status_code == 404


def test_search_filters_and_facets(client):
    everything = client.get("/api/search", params={"kind": "award"}).json()
    assert everything["total"] == 2
    assert {f["value"]: f["count"] for f in everything["facets"]["status"]} == {"active": 1, "ended": 1}

    active = client.get("/api/search", params={"status": "active", "kind": "award"}).json()
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
