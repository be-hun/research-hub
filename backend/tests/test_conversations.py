# ruff: noqa: F811  (pytest fixtures imported from test_assistant are parameters below)
from app import conversations
from tests.test_assistant import client, fake_model  # noqa: F401  fixtures

MAYA = {"X-Client-Id": "demo-maya"}
OTHER = {"X-Client-Id": "0b6f6c1e-5d1a-4b5e-9f7c-2a1d3c4e5f60"}
ANSWER = {"summary": "Proteostasis work in Down syndrome [1].",
          "records": [{"record": 1, "takeaway": "Brain protein clearance in Down syndrome"}]}


def ask(client, messages, headers=None, conversation_id=None):
    body = {"messages": [{"role": r, "text": t} for r, t in messages]}
    if conversation_id:
        body["conversationId"] = conversation_id
    return client.post("/api/assistant", json=body, headers=headers or {})


def start(client, question="What Down syndrome research is there?"):
    res = ask(client, [("user", question)], MAYA)
    assert res.status_code == 200
    return res.json()


def test_answer_with_header_creates_then_appends(client, fake_model):
    fake_model(ANSWER)
    first = start(client)
    cid = first["conversationId"]
    assert cid and first["mode"] == "research"

    follow = ask(client, [("user", "What Down syndrome research is there?"), ("assistant", first["summary"]),
                          ("user", "Who leads the Down syndrome work?")], MAYA, cid).json()
    assert follow["conversationId"] == cid

    saved = client.get(f"/api/conversations/{cid}", headers=MAYA).json()
    assert saved["title"] == "What Down syndrome research is there?"
    assert [(m["role"], m["text"]) for m in saved["messages"]] == [
        ("user", "What Down syndrome research is there?"), ("assistant", first["summary"]),
        ("user", "Who leads the Down syndrome work?"), ("assistant", follow["summary"]),
    ]
    assert saved["messages"][0]["reply"] is None
    reply = saved["messages"][1]["reply"]
    assert reply["records"][0]["project"]["id"] == "nih-R01AG000001" and reply["conversationId"] == cid
    assert saved["updatedAt"] >= saved["createdAt"]


def test_nothing_found_answers_are_saved(client, fake_model):
    fake_model(ANSWER)
    body = start(client, "quantum cryptography blockchain")
    assert body["mode"] == "none" and body["conversationId"]
    saved = client.get(f"/api/conversations/{body['conversationId']}", headers=MAYA).json()
    assert saved["messages"][1]["reply"]["mode"] == "none"


def test_without_header_nothing_is_saved(client, fake_model):
    fake_model(ANSWER)
    body = ask(client, [("user", "What Down syndrome research is there?")]).json()
    assert body["conversationId"] is None and body["mode"] == "research"
    assert client.get("/api/conversations", headers=MAYA).json() == {"conversations": []}


def test_model_errors_are_not_saved(client, fake_model):
    from app import ai

    fake_model(ai.AIUnavailable("down"))
    assert ask(client, [("user", "Down syndrome")], MAYA).status_code == 503
    assert client.get("/api/conversations", headers=MAYA).json() == {"conversations": []}


def test_list_rename_and_delete(client, fake_model):
    fake_model(ANSWER)
    older = start(client, "Down syndrome research one")["conversationId"]
    newer = start(client, "Down syndrome research two")["conversationId"]

    listed = client.get("/api/conversations", headers=MAYA).json()["conversations"]
    assert [c["id"] for c in listed] == [newer, older]
    assert listed[0]["title"] == "Down syndrome research two" and listed[0]["messageCount"] == 2

    renamed = client.patch(f"/api/conversations/{older}", json={"title": "  Aging grants  "}, headers=MAYA)
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Aging grants" and renamed.json()["messageCount"] == 2
    assert client.patch(f"/api/conversations/{older}", json={"title": "   "}, headers=MAYA).status_code == 422
    assert client.patch(f"/api/conversations/{older}", json={"title": "x" * 121}, headers=MAYA).status_code == 422

    assert client.delete(f"/api/conversations/{older}", headers=MAYA).status_code == 204
    assert client.get(f"/api/conversations/{older}", headers=MAYA).status_code == 404
    assert client.delete(f"/api/conversations/{older}", headers=MAYA).status_code == 404
    assert [c["id"] for c in client.get("/api/conversations", headers=MAYA).json()["conversations"]] == [newer]


def test_another_owner_gets_404(client, fake_model):
    calls = fake_model(ANSWER)
    cid = start(client)["conversationId"]
    assert client.get(f"/api/conversations/{cid}", headers=OTHER).status_code == 404
    assert client.patch(f"/api/conversations/{cid}", json={"title": "Mine"}, headers=OTHER).status_code == 404
    assert client.delete(f"/api/conversations/{cid}", headers=OTHER).status_code == 404
    assert client.get("/api/conversations", headers=OTHER).json() == {"conversations": []}
    assert ask(client, [("user", "Down syndrome")], OTHER, cid).status_code == 404
    assert len(calls) == 1  # the 404 is decided before the model is called
    assert client.get(f"/api/conversations/{cid}", headers=MAYA).json()["title"] != "Mine"


def test_bad_or_missing_header_gets_400(client, fake_model):
    fake_model(ANSWER)
    for bad in ["short", "x" * 65, "has spaces in it", "semi;colon-id"]:
        assert client.get("/api/conversations", headers={"X-Client-Id": bad}).status_code == 400
        assert ask(client, [("user", "Down syndrome")], {"X-Client-Id": bad}).status_code == 400
    assert client.get("/api/conversations").status_code == 400
    assert client.delete("/api/conversations/abc").status_code == 400


def test_failed_save_still_returns_the_answer(client, fake_model, monkeypatch):
    fake_model(ANSWER)

    def broken(*args, **kwargs):
        raise RuntimeError("database went away")

    monkeypatch.setattr(conversations, "save_turn", broken)
    res = ask(client, [("user", "What Down syndrome research is there?")], MAYA)
    assert res.status_code == 200
    assert res.json()["mode"] == "research" and res.json()["conversationId"] is None


def test_title_is_cut_at_a_word_boundary():
    question = "Which Temple researchers study machine learning for cardiovascular prevention in older adults today?"
    title = conversations.title_for(question)
    assert len(title) <= 80 and question.startswith(title) and question[len(title)] == " "
    assert conversations.title_for("  short\n question ") == "short question"
    assert len(conversations.title_for("x" * 200)) == 80
