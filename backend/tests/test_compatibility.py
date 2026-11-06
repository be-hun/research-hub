from fastapi.testclient import TestClient

from app.main import create_app
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_new_sources import trial
from ingest import clinical_trials
from tests.test_nih_reporter import record


def loaded_client():
    app = create_app()
    load(app.state.db, merge([normalize([record()])]))
    return TestClient(app)


def test_demo_profile_returns_synthetic_label_and_active_matches():
    response = loaded_client().get("/api/demo-profile")
    assert response.status_code == 200
    body = response.json()
    assert body["isSynthetic"] is True
    assert body["name"] == "Maya Patel"
    assert body["compatibility"]["isSynthetic"] is True
    assert body["compatibility"]["matches"][0]["project"]["id"] == "nih-R01AG000001"


def test_researcher_compatibility_excludes_the_researchers_own_records():
    app = create_app()
    load(app.state.db, merge([normalize([record()])]))
    response = TestClient(app).get("/api/researchers/r-nih-10/compatibility")
    assert response.status_code == 200
    assert response.json()["matches"] == []


def test_for_you_filters_status_and_profile_topics():
    app = create_app()
    load(app.state.db, merge([normalize([record()]), clinical_trials.normalize([trial()], 2022)]))
    client = TestClient(app)

    aging = client.post("/api/for-you", json={"topics": ["aging"], "terms": []})
    assert aging.status_code == 200
    assert all(item["project"]["kind"] == "award" for item in aging.json()["grants"])
    assert aging.json()["trials"] == []

    addiction = client.post("/api/for-you", json={"topics": ["addiction"], "terms": []})
    assert addiction.status_code == 200
    assert addiction.json()["trials"][0]["project"]["statusLabel"] == "Recruiting"
    assert addiction.json()["trials"][0]["project"]["kind"] == "trial"


def test_for_you_collaborators_are_real_and_deterministic():
    app = create_app()
    load(app.state.db, merge([normalize([record()]), clinical_trials.normalize([trial()], 2022)]))
    client = TestClient(app)
    body = {"topics": ["aging"], "terms": ["alzheimer"]}
    first = client.post("/api/for-you", json=body).json()
    second = client.post("/api/for-you", json=body).json()
    assert first["collaborators"] == second["collaborators"]
    researcher_ids = {row["id"] for row in app.state.db.execute("SELECT id FROM researchers")}
    assert first["collaborators"]
    assert all(item["researcherId"] in researcher_ids for item in first["collaborators"])


def test_profile_validation_and_matching_endpoints():
    app = create_app()
    load(app.state.db, merge([normalize([record()])]))
    client = TestClient(app)

    assert client.post("/api/for-you", json={"topics": ["unknown-topic"]}).status_code == 422
    assert client.post("/api/match/researcher/nope", json={}).status_code == 404
    researcher = client.post("/api/match/researcher/r-nih-10", json={"topics": ["aging"]})
    assert researcher.status_code == 200
    assert all(
        row["id"] in {"nih-R01AG000001"}
        for row in researcher.json()["records"]
    )
    projects = client.post("/api/match/projects", json={"profile": {"topics": ["aging"]}, "ids": ["missing"] * 60})
    assert projects.status_code == 422
    assert client.post("/api/match/projects", json={"profile": {"topics": ["aging"]}, "ids": ["missing"]}).json() == {
        "matches": []
    }


def test_compatibility_does_not_recommend_a_college_match_without_domain_evidence():
    app = create_app()
    load(app.state.db, merge([normalize([record()])]))
    app.state.db.execute(
        """INSERT INTO projects (
            id, award_number, kind, status_label, title, summary, abstract, terms, agency, funder,
            start_year, end_year, latest_fy, is_active, source, source_label, source_url, verification, updated_at
        ) VALUES (?, ?, 'award', 'Active', ?, ?, ?, ?, 'NIH', 'NIH', 2025, 2027, 2025, 1,
                  'nih-reporter', 'NIH RePORTER', 'https://example.test/other', 'public-award-record', '2025-01-01')
        """,
        ("nih-R01OTHER", "R01OTHER", "Unrelated project", "Unrelated", "Unrelated", "unrelated"),
    )
    app.state.db.execute(
        "INSERT INTO project_colleges (project_id, college) VALUES (?, ?)",
        ("nih-R01OTHER", "medicine"),
    )

    response = TestClient(app).get("/api/researchers/r-nih-10/compatibility")

    assert response.status_code == 200
    assert all(match["project"]["id"] != "nih-R01OTHER" for match in response.json()["matches"])


def _two_grants_client():
    """The base record plus a grant that says "machine learning" and "sensor array" as phrases, and one that only
    has the same words apart."""
    phrases = record(
        appl_id=2, core_project_num="R01EB000002", project_title="Sensor array decoding with machine learning",
        abstract_text="Machine learning methods for a sensor array.", phr_text="", pref_terms="Sensor Array",
        principal_investigators=[{"profile_id": 20, "first_name": "ANA", "middle_name": "", "last_name": "LOPEZ",
                                  "is_contact_pi": True}],
        project_detail_url="https://reporter.nih.gov/project-details/2",
    )
    apart = record(
        appl_id=3, core_project_num="R01EB000003", project_title="A learning curve for every machine",
        abstract_text="We array each sensor by hand; the machine keeps learning.", phr_text="", pref_terms="Teaching",
        principal_investigators=[{"profile_id": 30, "first_name": "BEN", "middle_name": "", "last_name": "OKAFOR",
                                  "is_contact_pi": True}],
        project_detail_url="https://reporter.nih.gov/project-details/3",
    )
    app = create_app()
    load(app.state.db, merge([normalize([record(), phrases, apart])]))
    return TestClient(app)


def test_interests_match_as_whole_phrases_not_scattered_words():
    loaded = body = _two_grants_client().post(
        "/api/for-you", json={"terms": ["machine learning", "sensor array"]}
    ).json()
    ids = [m["project"]["id"] for m in body["grants"]]
    assert "nih-R01EB000002" in ids
    assert "nih-R01EB000003" not in ids
    reasons = next(m["reasons"] for m in loaded["grants"] if m["project"]["id"] == "nih-R01EB000002")
    assert "Shares stored terms: machine learning, sensor array" in reasons


def test_generic_words_alone_never_match():
    body = _two_grants_client().post("/api/for-you", json={"terms": ["disease", "therapy", "learning"]}).json()
    assert body["grants"] == [] and body["trials"] == [] and body["collaborators"] == []


def test_a_person_gets_the_same_score_in_the_people_list_and_on_their_page():
    client = _two_grants_client()
    profile = {"college": "medicine", "topics": ["aging"], "terms": ["down syndrome"]}
    people = client.post("/api/for-you", json=profile).json()["collaborators"]
    assert people
    for person in people:
        own = client.post(f"/api/match/researcher/{person['researcherId']}", json=profile).json()
        assert own["score"] == person["score"]
        assert not ("Linked to the same college" in person["reasons"] and "Expands beyond your college" in person["reasons"])
