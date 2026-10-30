import pytest
from fastapi.testclient import TestClient

from app import ai
from app.main import create_app
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_nih_reporter import record


@pytest.fixture
def client():
    app = create_app(":memory:")
    load(app.state.db, merge([normalize([record()])]))
    return TestClient(app)


@pytest.fixture
def fake_model(monkeypatch):
    calls = []

    def install(result):
        def grounded_answer(system, messages):
            calls.append(messages)
            if isinstance(result, Exception):
                raise result
            return result
        monkeypatch.setattr(ai, "grounded_answer", grounded_answer)
        return calls

    return install


def ask(client, text):
    return client.post("/api/assistant", json={"messages": [{"role": "user", "text": text}]})


def test_nothing_found_skips_the_model(client, fake_model):
    calls = fake_model({"answerable": True, "answer": "should not be used", "cited_records": [1]})
    res = ask(client, "quantum cryptography blockchain")
    assert res.status_code == 200
    assert res.json()["sources"] == []
    assert "couldn't find" in res.json()["reply"]
    assert calls == []


def test_answer_keeps_only_real_citations(client, fake_model):
    calls = fake_model({"answerable": True, "answer": "Proteostasis work in Down syndrome [1].", "cited_records": [1, 7]})
    res = ask(client, "Who studies Down syndrome?")
    body = res.json()
    assert body["reply"] == "Proteostasis work in Down syndrome [1]."
    assert [(s["n"], s["id"]) for s in body["sources"]] == [(1, "nih-R01AG000001")]
    sent = calls[0][-1]["content"]
    assert '<record number="1" id="nih-R01AG000001" kind="award">' in sent and "Domenico Pratico (Contact PI)" in sent


def test_answer_without_valid_citations_is_rejected(client, fake_model):
    fake_model({"answerable": True, "answer": "Made-up claim.", "cited_records": [9]})
    body = ask(client, "Down syndrome research").json()
    assert body["sources"] == [] and "Made-up" not in body["reply"]


def test_unanswerable_passes_through_without_sources(client, fake_model):
    fake_model({"answerable": False, "answer": "The records cover Down syndrome, not funding totals.", "cited_records": [1]})
    body = ask(client, "Down syndrome total funding").json()
    assert body["sources"] == []


def test_model_unavailable_returns_503(client, fake_model):
    fake_model(ai.AIUnavailable("The assistant is not configured."))
    res = ask(client, "Down syndrome")
    assert res.status_code == 503 and res.json()["detail"] == "The assistant is not configured."


def test_rejects_conversation_ending_with_assistant(client):
    res = client.post("/api/assistant", json={"messages": [{"role": "assistant", "text": "hi"}]})
    assert res.status_code == 422
