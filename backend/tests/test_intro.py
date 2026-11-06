import pytest
from fastapi.testclient import TestClient

from app import ai
from app.main import create_app
from ingest.load import load, merge
from ingest.nih_reporter import normalize
from tests.test_nih_reporter import record

RESEARCHER = "r-nih-10"  # Domenico Pratico, contact PI on the one fixture grant
PROFILE = {"topics": ["aging"], "terms": ["down syndrome"]}


@pytest.fixture
def client():
    app = create_app()
    load(app.state.db, merge([normalize([record()])]))
    return TestClient(app)


@pytest.fixture
def fake_model(monkeypatch):
    calls = []

    def install(result):
        def grounded_intro(system, content):
            calls.append(content)
            if isinstance(result, Exception):
                raise result
            return {"enough_overlap": True, "subject": "", "body": "", "records": [], **result}
        monkeypatch.setattr(ai, "grounded_intro", grounded_intro)
        return calls

    return install


def draft(client, profile=PROFILE, researcher=RESEARCHER, **extra):
    return client.post("/api/intro-draft", json={"researcherId": researcher, "profile": profile, **extra})


def test_draft_cites_only_shared_records_read_from_the_database(client, fake_model):
    calls = fake_model({
        "subject": "Down syndrome and aging research",
        "body": "Dear Domenico Pratico,\n\nYour grant on proteostasis in Down syndrome [1] connects to my interest.\n\nMaya Patel",
        "records": [1, 7, 1],
    })
    res = draft(client, senderName="Maya Patel")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is True and body["message"] is None
    assert body["researcherName"] == "Domenico Pratico"
    assert body["subject"] == "Down syndrome and aging research"
    assert "[1]" not in body["body"] and body["body"].startswith("Dear Domenico Pratico,")
    assert [(c["n"], c["id"], c["kind"]) for c in body["citations"]] == [(1, "nih-R01AG000001", "award")]
    assert [t["id"] for t in body["sharedTopics"]] == ["aging"]
    assert body["band"] is not None
    sent = calls[0]
    assert "from Maya Patel to Domenico Pratico" in sent
    assert '<record number="1" id="nih-R01AG000001" kind="award">' in sent and "<sender_profile>" in sent


def test_no_overlap_says_so_without_calling_the_model(client, fake_model):
    calls = fake_model({"subject": "x", "body": "should not be used", "records": [1]})
    body = draft(client, profile={"terms": ["quantum cryptography"]}).json()
    assert body["available"] is False and body["body"] == "" and body["citations"] == []
    assert "isn't enough shared work" in body["message"]
    assert calls == []


def test_model_saying_overlap_is_thin_is_passed_on(client, fake_model):
    fake_model({"enough_overlap": False, "subject": "Invented", "body": "Invented collaboration", "records": [1]})
    body = draft(client).json()
    assert body["available"] is False and body["body"] == "" and "too thin" in body["message"]
    assert [c["id"] for c in body["citations"]] == ["nih-R01AG000001"]  # what was looked at, for the reader


def test_draft_without_a_real_citation_is_rejected(client, fake_model):
    fake_model({"subject": "Hello", "body": "Your work on an invented project [9].", "records": [9]})
    body = draft(client).json()
    assert body["available"] is False and "Invented" not in body["body"] and body["body"] == ""


def test_unknown_researcher_and_unavailable_model(client, fake_model):
    fake_model(ai.AIUnavailable("The assistant is not configured."))
    assert draft(client, researcher="nope").status_code == 404
    res = draft(client)
    assert res.status_code == 503 and res.json()["detail"] == "The assistant is not configured."
