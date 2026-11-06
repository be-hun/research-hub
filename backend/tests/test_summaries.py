import pytest
from fastapi.testclient import TestClient

from app import ai
from app.main import create_app
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_nih_reporter import record


@pytest.fixture
def model(monkeypatch):
    """A stand-in model that records what it was sent and returns the next queued reply."""
    calls: list[str] = []
    replies: list = []

    def grounded_summary(system, content):
        calls.append(content)
        reply = replies.pop(0) if replies else {"summary": "Studies proteostasis in Down syndrome [1].", "points": []}
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(ai, "grounded_summary", grounded_summary)
    return calls, replies


def client():
    app = create_app()
    load(app.state.db, merge([normalize([record()])]))
    return app, TestClient(app)


def test_project_summary_keeps_only_real_citations_and_is_cached(model):
    calls, replies = model
    replies.append({
        "summary": "A grant on proteostasis in Down syndrome [1] and something invented [7].",
        "points": [{"text": "Funded by the National Institute on Aging [1]", "records": [1, 7]},
                   {"text": "Made-up point", "records": [9]}],
    })
    _, c = client()
    body = c.get("/api/summaries/project/nih-R01AG000001").json()
    assert body["available"] is True
    assert body["summary"] == "A grant on proteostasis in Down syndrome [1] and something invented."
    assert body["points"] == [{"text": "Funded by the National Institute on Aging", "citations": [1]}]
    assert [ci["id"] for ci in body["citations"]] == ["nih-R01AG000001"]
    assert "Proteostasis in Down syndrome" in calls[0]

    again = c.get("/api/summaries/project/nih-R01AG000001").json()
    assert again == body
    assert len(calls) == 1  # served from the cache


def test_summary_without_any_valid_citation_is_not_shown(model):
    _, replies = model
    replies.append({"summary": "A great researcher doing important work.", "points": []})
    _, c = client()
    body = c.get("/api/summaries/researcher/r-nih-10").json()
    assert body["available"] is False
    assert body["summary"] == ""
    assert body["citations"][0]["id"] == "nih-R01AG000001"


def test_model_failure_is_reported_and_retried_next_time(model):
    calls, replies = model
    replies.append(ai.AIUnavailable("The assistant service could not be reached."))
    _, c = client()
    first = c.get("/api/summaries/topic/aging").json()
    assert first["available"] is False and first["message"] == "The assistant service could not be reached."
    second = c.get("/api/summaries/topic/aging").json()
    assert second["available"] is True
    assert len(calls) == 2


def test_cached_summary_is_rewritten_when_its_records_change(model):
    calls, _ = model
    app, c = client()
    c.get("/api/summaries/college/medicine")
    app.state.db.execute("UPDATE projects SET updated_at = '2030-01-01' WHERE id = 'nih-R01AG000001'")
    c.get("/api/summaries/college/medicine")
    assert len(calls) == 2


def test_unknown_subjects(model):
    _, c = client()
    assert c.get("/api/summaries/project/nope").status_code == 404
    assert c.get("/api/summaries/topic/not-a-topic").status_code == 404
    assert c.get("/api/summaries/planet/earth").status_code == 422
