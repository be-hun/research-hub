from fastapi.testclient import TestClient

from app.main import create_app


def test_health():
    client = TestClient(create_app(":memory:"))
    assert client.get("/health").json() == {"ok": True}
    assert client.get("/api/health").json() == {"ok": True}


def test_assistant_has_no_rate_limit():
    client = TestClient(create_app(":memory:"))
    body = {"messages": [{"role": "user", "text": "test"}]}
    for _ in range(10):
        assert client.post("/api/assistant", json=body).status_code in (200, 503)
