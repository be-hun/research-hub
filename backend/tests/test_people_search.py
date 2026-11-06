"""People search matches the start of each word of a name or department, in any order, and tolerates typos."""

import pytest
from fastapi.testclient import TestClient

from app.db import has_trigrams
from app.main import create_app
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_nih_reporter import record


def pi(n: int, first: str, middle: str, last: str, dept: str = "INTERNAL MEDICINE/MEDICINE") -> dict:
    return record(appl_id=n, core_project_num=f"R01AG00000{n}", organization={"dept_type": dept},
                  project_detail_url=f"https://reporter.nih.gov/project-details/{n}",
                  principal_investigators=[{"profile_id": 100 + n, "first_name": first, "middle_name": middle,
                                            "last_name": last, "is_contact_pi": True}])


@pytest.fixture
def app():
    app = create_app()
    load(app.state.db, merge([normalize([
        pi(1, "GRACE", "X.", "MA"),
        pi(2, "THOMAS", "", "SMITH"),
        pi(3, "MARY", "GRACE", "MURRAY"),
        pi(4, "LEE", "", "JONES", dept="MATHEMATICS"),
    ])]))
    return app


def names(app, q: str) -> list[str]:
    body = TestClient(app).get("/api/researchers", params={"q": q}).json()
    return [p["name"] for p in body["results"]]


def test_every_word_matches_the_start_of_a_name_word_in_any_order(app):
    for q in ("Grace Ma", "grace ma", "Ma Grace", "  GRACE   MA "):
        assert names(app, q)[0] == "Grace X. Ma", q
    assert "Grace X. Ma" in names(app, "grace x. ma")


def test_a_short_word_never_matches_inside_another_word(app):
    found = names(app, "ma")
    assert "Thomas Smith" not in found
    assert {"Grace X. Ma", "Mary Grace Murray", "Lee Jones"} <= set(found)  # Lee Jones: department Mathematics


def test_the_department_counts_as_words_too(app):
    assert names(app, "jones math") == ["Lee Jones"]
    assert names(app, "smith medicine") == ["Thomas Smith"]


def test_a_misspelled_name_still_finds_the_person_with_pg_trgm(app):
    if not has_trigrams(app.state.db):
        pytest.skip("pg_trgm is not installed on this database")
    assert names(app, "Grace Mah")[0] == "Grace X. Ma"
    assert names(app, "zzzz qqqq") == []


def test_name_sort_still_applies_to_a_query(app):
    body = TestClient(app).get("/api/researchers", params={"q": "grace", "sort": "name"}).json()
    assert [p["name"] for p in body["results"]] == ["Grace X. Ma", "Mary Grace Murray"]
