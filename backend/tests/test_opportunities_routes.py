"""The funding-opportunity routes exist with their final shapes (contract PR; behaviour comes in later PRs)."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_opportunity_routes_answer_with_their_contract_shapes():
    client = TestClient(create_app())
    search = client.get("/api/opportunities", params={"q": "cancer", "universities": "true", "closes_within": 30})
    assert search.status_code == 200
    assert search.json()["sort"] == "deadline" and search.json()["results"] == []
    assert client.get("/api/opportunities", params={"status": "open"}).status_code == 422
    assert client.get("/api/opportunities/gg-0").status_code == 404
    assert client.get("/api/opportunities/gg-0/researchers").json()["notice"]
