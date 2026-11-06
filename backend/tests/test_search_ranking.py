from fastapi.testclient import TestClient

from app.main import create_app
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_nih_reporter import record


def test_search_ranks_an_exact_phrase_above_the_same_words_apart():
    apart = record(
        appl_id=2, core_project_num="R01AA000002", project_title="Chain reactions in blood supply",
        abstract_text="A chain of events limits the supply of donor blood.", phr_text="", pref_terms="Blood",
        project_detail_url="https://reporter.nih.gov/project-details/2",
    )
    phrase = record(
        appl_id=3, core_project_num="R01AA000003", project_title="Hospital logistics",
        abstract_text="We model the supply chain for hospital drugs.", phr_text="", pref_terms="Logistics",
        project_detail_url="https://reporter.nih.gov/project-details/3",
    )
    app = create_app()
    load(app.state.db, merge([normalize([apart, phrase])]))
    results = TestClient(app).get("/api/search", params={"q": "supply chain"}).json()["results"]
    assert [r["id"] for r in results][:2] == ["nih-R01AA000003", "nih-R01AA000002"]
