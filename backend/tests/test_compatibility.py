from fastapi.testclient import TestClient

from app.main import create_app
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_nih_reporter import record


def loaded_client():
    app = create_app(":memory:")
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
    app = create_app(":memory:")
    load(app.state.db, merge([normalize([record()])]))
    response = TestClient(app).get("/api/researchers/r-nih-10/compatibility")
    assert response.status_code == 200
    assert response.json()["matches"] == []
