"""One people ranking: For you, the full people list and a researcher's own page agree on every score and rank."""

from fastapi.testclient import TestClient

from app import compatibility, models
from app.main import create_app
from ingest import openalex
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_new_sources import OPENALEX_FUNDERS, work
from tests.test_nih_reporter import record

PROFILE = {"college": "medicine", "topics": ["aging"], "terms": ["down syndrome", "proteostasis"]}


def grant(n: int, first: str, last: str, person: int | None = None, **overrides) -> dict:
    """An NIA grant (topic: aging) led by investigator `person` (default: their own, numbered n)."""
    return record(
        appl_id=n, core_project_num=f"R01AG{n:06d}", project_detail_url=f"https://reporter.nih.gov/project-details/{n}",
        principal_investigators=[{"profile_id": person or n, "first_name": first, "middle_name": "", "last_name": last,
                                  "is_contact_pi": True}],
        **overrides,
    )


OLD = {"fiscal_year": 2019, "project_start_date": "2016-01-01T00:00:00", "project_end_date": "2019-06-30T00:00:00",
       "is_active": False}


def client_with(*records: dict, papers: list[dict] | None = None) -> tuple:
    app = create_app()
    sources = [normalize(list(records))]
    if papers:
        sources.append(openalex.normalize({"works": papers, "funders": OPENALEX_FUNDERS}))
    load(app.state.db, merge(sources))
    return app, TestClient(app)


def many_people() -> tuple:
    titles = ["Proteostasis in Down syndrome", "Down syndrome and aging", "Proteostasis of the aging brain",
              "Sleep in older adults", "Memory in aging", "Down syndrome cohort", "Aging and proteostasis networks",
              "Caregivers of people with dementia", "Exercise in aging"]
    grants = [grant(i + 1, f"PERSON{chr(65 + i)}", f"LAST{chr(65 + i)}", project_title=title)
              for i, title in enumerate(titles)]
    grants.append(grant(50, "OLDA", "TIMER", project_title="Proteostasis in Down syndrome", **OLD))
    return client_with(*grants, papers=[work()])


def test_every_ranked_person_has_the_same_score_and_rank_on_their_own_page():
    app, client = many_people()
    ranking = compatibility.rank_people(app.state.db, models.ProfileInput(**PROFILE))
    assert len(ranking) >= 7
    for index, (person, researcher) in enumerate(ranking):
        own = client.post(f"/api/match/researcher/{researcher['id']}", json=PROFILE).json()
        assert (own["score"], own["rank"], own["total"], own["eligible"]) == (person.points, index + 1, len(ranking), True)
        assert own["band"] == compatibility.band_for(person.points)


def test_a_person_with_only_old_records_is_not_eligible():
    _, client = many_people()
    rid = "r-nih-50"  # their grant ended in 2019, though it matches the profile as well as anyone's
    own = client.post(f"/api/match/researcher/{rid}", json=PROFILE).json()
    assert own["eligible"] is False
    assert (own["score"], own["band"], own["rank"], own["records"]) == (0, None, None, [])
    people = client.post("/api/for-you/people", json=PROFILE).json()
    assert rid not in [p["researcherId"] for p in people["results"]]


def test_ties_are_broken_by_breadth_then_recency_not_by_name():
    same = {"project_title": "Proteostasis in Down syndrome"}
    _, client = client_with(
        grant(1, "AARON", "ABLE", **same),  # one matching record; first by name and by id
        grant(2, "ZED", "ZULU", **same),  # two matching records
        grant(3, "ZED", "ZULU", person=2, **same),
        grant(4, "MIA", "MOSS", **same, fiscal_year=2026),  # one record, as Aaron Able, but more recent
    )
    people = client.post("/api/for-you/people", json=PROFILE).json()["results"]
    assert len({p["score"] for p in people}) == 1  # everyone ties on points
    assert [p["name"] for p in people] == ["Zed Zulu", "Mia Moss", "Aaron Able"]
    assert [p["rank"] for p in people] == [1, 2, 3]


def test_for_you_shows_the_first_six_of_the_people_list():
    _, client = many_people()
    for_you = client.post("/api/for-you", json=PROFILE).json()
    page1 = client.post("/api/for-you/people", params={"page": 1}, json=PROFILE).json()
    assert for_you["collaborators"] == page1["results"][:6]
    assert [p["rank"] for p in page1["results"]] == list(range(1, len(page1["results"]) + 1))
    assert for_you["collaboratorTotal"] == page1["total"] and page1["pageSize"] == 20 and page1["page"] == 1
    assert client.post("/api/for-you/people", params={"page": 2}, json=PROFILE).json()["results"] == []
    assert client.post("/api/for-you/people", params={"page": 0}, json=PROFILE).status_code == 422


def test_bands_name_the_score():
    assert compatibility.band_for(compatibility.STRONG_OVERLAP) == "Strong overlap"
    assert compatibility.band_for(compatibility.STRONG_OVERLAP - 1) == "Good overlap"
    assert compatibility.band_for(compatibility.GOOD_OVERLAP) == "Good overlap"
    assert compatibility.band_for(compatibility.MIN_MATCH_SCORE) == "Some overlap"


def test_a_reimport_that_changes_only_topics_refreshes_the_ranking():
    app, client = client_with(grant(1, "AARON", "ABLE"))
    profile = {"topics": ["cancer"], "terms": []}
    assert client.post("/api/for-you", json=profile).json()["collaboratorTotal"] == 0
    db = app.state.db
    db.execute("UPDATE project_topics SET topic_id = 'cancer'")  # same record count, newer import
    db.execute("""INSERT INTO ingest_runs (source, started_at, finished_at, fiscal_years)
                  VALUES ('test', '2026-01-01', '2026-01-01', '2026')""")
    assert client.post("/api/for-you", json=profile).json()["collaboratorTotal"] == 1
