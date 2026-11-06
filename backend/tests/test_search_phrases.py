"""Search lists records with the phrase or every word, falls back to any word, and explains each hit with a snippet."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from ingest import clinical_trials
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_new_sources import trial
from tests.test_nih_reporter import record


def grant(n: int, title: str, abstract: str, terms: str = "Logistics") -> dict:
    return record(appl_id=n, core_project_num=f"R01AA00000{n}", project_title=title, abstract_text=abstract,
                  phr_text="", pref_terms=terms, project_detail_url=f"https://reporter.nih.gov/project-details/{n}")


@pytest.fixture
def client():
    app = create_app()
    load(app.state.db, merge([
        normalize([
            grant(1, "Hospital logistics", "We model the supply chain for hospital drugs across the region."),
            grant(2, "Chain reactions in blood supply", "A chain of events limits the supply of donor blood."),
            grant(3, "Water supply in cities", "Clean water supply for growing cities.", terms="Water"),
            grant(4, "Bicycle safety", "Helmets and a bicycle chain guard reduce injuries.", terms="Injury"),
        ]),
        clinical_trials.normalize([
            trial(),  # Recruiting
            trial(identificationModule={"nctId": "NCT00000002", "briefTitle": "Ketamine for Opioid Pain"},
                  statusModule={"overallStatus": "COMPLETED", "startDateStruct": {"date": "2024-01-01"},
                                "completionDateStruct": {"date": "2025-06"},
                                "lastUpdatePostDateStruct": {"date": "2026-01-01"}}),
            trial(identificationModule={"nctId": "NCT00000003", "briefTitle": "Ketamine for Opioid Craving"},
                  statusModule={"overallStatus": "NOT_YET_RECRUITING", "startDateStruct": {"date": "2026-09-01"},
                                "completionDateStruct": {"date": "2028-06"},
                                "lastUpdatePostDateStruct": {"date": "2026-05-01"}}),
        ], 2022),
    ]))
    return TestClient(app)


def search(client, **params) -> dict:
    return client.get("/api/search", params=params).json()


def test_a_record_with_only_one_of_the_words_is_not_a_result(client):
    body = search(client, q="supply chain")
    ids = [r["id"] for r in body["results"]]
    assert "nih-R01AA000003" not in ids and "nih-R01AA000004" not in ids  # only "supply", only "chain"
    assert body["total"] == 2 and body["matchMode"] == "phrase"


def test_a_record_with_both_words_comes_after_the_phrase(client):
    ids = [r["id"] for r in search(client, q="supply chain")["results"]]
    assert ids == ["nih-R01AA000001", "nih-R01AA000002"]


def test_facets_count_the_same_records_as_the_list(client):
    body = search(client, q="supply chain")
    assert sum(f["count"] for f in body["facets"]["kinds"]) == body["total"] == 2


def test_falls_back_to_any_word_when_no_record_has_them_all(client):
    body = search(client, q="water helmets")
    assert body["matchMode"] == "any"
    assert {r["id"] for r in body["results"]} == {"nih-R01AA000003", "nih-R01AA000004"}
    assert sum(f["count"] for f in body["facets"]["kinds"]) == body["total"] == 2


def test_match_modes_for_one_word_and_no_query(client):
    assert search(client, q="water")["matchMode"] == "all"  # one word is not a phrase
    assert search(client, q="")["matchMode"] == "browse"
    assert search(client, q="blood supply")["matchMode"] == "phrase"
    assert search(client, q="donor supply")["matchMode"] == "all"


def test_snippet_highlights_the_matched_words(client):
    first = search(client, q="supply chain")["results"][0]
    snippet = first["match"]["snippet"]
    assert "⟦supply⟧ ⟦chain⟧" in snippet and "hospital drugs" in snippet
    assert first["match"]["reason"]  # the existing explanation is kept


def test_snippet_is_null_when_the_text_has_no_query_word(client):
    # "Hospital logistics" matches through its subject term, not its abstract.
    [hit] = search(client, q="logistics hospital")["results"]
    assert hit["match"]["snippet"] is not None  # "hospital" is in the abstract
    [only_terms] = [r for r in search(client, q="logistics")["results"] if r["id"] == "nih-R01AA000002"]
    assert only_terms["match"]["snippet"] is None


def test_quotes_and_exclusions_use_web_search_syntax(client):
    assert [r["id"] for r in search(client, q='"supply chain"')["results"]] == ["nih-R01AA000001"]
    assert [r["id"] for r in search(client, q="supply -water -chain")["results"]] == []
    assert {r["id"] for r in search(client, q="supply -water")["results"]} == {"nih-R01AA000001", "nih-R01AA000002"}


def test_recruiting_filter_keeps_trials_taking_participants(client):
    body = search(client, q="ketamine", status="recruiting")
    assert {r["id"] for r in body["results"]} == {"ct-NCT01234567", "ct-NCT00000003"}
    assert all(r["kind"] == "trial" for r in body["results"])
    facet = {f["value"]: f["count"] for f in body["facets"]["status"]}
    assert facet["recruiting"] == 2
