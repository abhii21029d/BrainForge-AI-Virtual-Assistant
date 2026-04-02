import sqlite3
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import backend.main as main


@pytest.fixture()
def temp_db(monkeypatch: pytest.MonkeyPatch) -> Path:
    test_data_dir = Path(".testdata")
    test_data_dir.mkdir(exist_ok=True)
    db_path = test_data_dir / f"brainforge-{uuid4().hex}.db"
    real_connect = sqlite3.connect

    def connect(_: str) -> sqlite3.Connection:
        return real_connect(db_path)

    monkeypatch.setattr(main.sqlite3, "connect", connect)
    main.init_db()
    yield db_path
    if db_path.exists():
        db_path.unlink()


@pytest.fixture()
def app_client(temp_db: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(main, "client", None)
    monkeypatch.setattr(main, "elevenlabs_key", "test-elevenlabs-key")
    return TestClient(main.app)


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_user(client: TestClient, email: str = "student@example.com", password: str = "secret123"):
    return client.post(
        "/register",
        json={"name": "Student", "email": email, "password": password},
    )


def test_register_login_and_me_flow(app_client: TestClient):
    register_response = register_user(app_client)
    assert register_response.status_code == 200
    payload = register_response.json()
    assert payload["email"] == "student@example.com"
    assert payload["name"] == "Student"
    assert payload["token"]

    me_response = app_client.get("/me", headers=auth_headers(payload["token"]))
    assert me_response.status_code == 200
    assert me_response.json() == {"email": "student@example.com", "name": "Student"}

    login_response = app_client.post(
        "/login",
        json={"email": "student@example.com", "password": "secret123"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["email"] == "student@example.com"


def test_register_rejects_duplicate_email(app_client: TestClient):
    first = register_user(app_client)
    second = register_user(app_client)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "Email already registered"


def test_login_rejects_wrong_password(app_client: TestClient):
    register_user(app_client)

    response = app_client.post(
        "/login",
        json={"email": "student@example.com", "password": "wrongpass"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_me_requires_authentication(app_client: TestClient):
    response = app_client.get("/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_chat_requires_authentication(app_client: TestClient):
    response = app_client.post("/chat", json={"character": "Py-Thanos", "message": "hello"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_chat_returns_simulated_response_without_gemini(app_client: TestClient):
    token = register_user(app_client).json()["token"]

    response = app_client.post(
        "/chat",
        headers=auth_headers(token),
        json={"character": "Py-Thanos", "message": "Explain loops"},
    )

    assert response.status_code == 200
    assert "Simulated response for Py-Thanos: Explain loops" in response.json()["response"]


def test_chat_forwards_recent_history_to_gemini(app_client: TestClient, monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        text = "History-aware answer"

    class FakeModels:
        def generate_content(self, **kwargs):
            captured.update(kwargs)
            return FakeResponse()

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(main, "client", FakeClient())
    token = register_user(app_client).json()["token"]
    history = [{"role": "user", "text": f"question-{i}"} for i in range(12)]

    response = app_client.post(
        "/chat",
        headers=auth_headers(token),
        json={"character": "Py-Thanos", "message": "latest question", "history": history},
    )

    assert response.status_code == 200
    assert response.json()["response"] == "History-aware answer"
    assert len(captured["contents"]) == 11
    assert captured["contents"][0]["parts"][0]["text"] == "question-2"
    assert captured["contents"][-1]["parts"][0]["text"] == "latest question"


def test_conversation_save_list_and_load_flow(app_client: TestClient):
    token = register_user(app_client).json()["token"]
    save_response = app_client.post(
        "/conversations/save",
        headers=auth_headers(token),
        json={
            "character": "Py-Thanos",
            "messages": [
                {"role": "user", "text": "Explain loops"},
                {"role": "model", "text": "Loops repeat actions."}
            ]
        },
    )

    assert save_response.status_code == 200
    conversation_id = save_response.json()["conversation_id"]

    list_response = app_client.get("/conversations", headers=auth_headers(token))
    assert list_response.status_code == 200
    assert list_response.json()["conversations"][0]["id"] == conversation_id
    assert list_response.json()["conversations"][0]["title"].startswith("Explain loops")

    detail_response = app_client.get(f"/conversations/{conversation_id}", headers=auth_headers(token))
    assert detail_response.status_code == 200
    messages = detail_response.json()["conversation"]["messages"]
    assert [msg["role"] for msg in messages] == ["user", "model"]
    assert messages[0]["text"] == "Explain loops"


def test_conversation_update_replaces_messages(app_client: TestClient):
    token = register_user(app_client).json()["token"]
    initial = app_client.post(
        "/conversations/save",
        headers=auth_headers(token),
        json={
            "character": "Py-Thanos",
            "messages": [{"role": "user", "text": "First question"}]
        },
    ).json()

    updated = app_client.post(
        "/conversations/save",
        headers=auth_headers(token),
        json={
            "conversation_id": initial["conversation_id"],
            "character": "Py-Thanos",
            "messages": [
                {"role": "user", "text": "Updated question"},
                {"role": "model", "text": "Updated answer"}
            ]
        },
    )

    assert updated.status_code == 200
    detail_response = app_client.get(f"/conversations/{initial['conversation_id']}", headers=auth_headers(token))
    messages = detail_response.json()["conversation"]["messages"]
    assert len(messages) == 2
    assert messages[0]["text"] == "Updated question"


def test_conversation_access_is_scoped_to_user(app_client: TestClient):
    first_token = register_user(app_client, email="first@example.com").json()["token"]
    second_token = register_user(app_client, email="second@example.com").json()["token"]
    saved = app_client.post(
        "/conversations/save",
        headers=auth_headers(first_token),
        json={
            "character": "Py-Thanos",
            "messages": [{"role": "user", "text": "Private conversation"}]
        },
    ).json()

    response = app_client.get(f"/conversations/{saved['conversation_id']}", headers=auth_headers(second_token))

    assert response.status_code == 404
    assert response.json()["detail"] == "Conversation not found"


def test_conversation_can_be_deleted(app_client: TestClient):
    token = register_user(app_client).json()["token"]
    saved = app_client.post(
        "/conversations/save",
        headers=auth_headers(token),
        json={
            "character": "Py-Thanos",
            "messages": [{"role": "user", "text": "Delete me"}]
        },
    ).json()

    delete_response = app_client.delete(
        f"/conversations/{saved['conversation_id']}",
        headers=auth_headers(token),
    )

    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": True, "conversation_id": saved["conversation_id"]}

    list_response = app_client.get("/conversations", headers=auth_headers(token))
    assert list_response.status_code == 200
    assert list_response.json()["conversations"] == []

    detail_response = app_client.get(
        f"/conversations/{saved['conversation_id']}",
        headers=auth_headers(token),
    )
    assert detail_response.status_code == 404


def test_conversation_delete_is_scoped_to_user(app_client: TestClient):
    first_token = register_user(app_client, email="first@example.com").json()["token"]
    second_token = register_user(app_client, email="second@example.com").json()["token"]
    saved = app_client.post(
        "/conversations/save",
        headers=auth_headers(first_token),
        json={
            "character": "Py-Thanos",
            "messages": [{"role": "user", "text": "Keep this private"}]
        },
    ).json()

    response = app_client.delete(
        f"/conversations/{saved['conversation_id']}",
        headers=auth_headers(second_token),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Conversation not found"


def test_tts_requires_authentication(app_client: TestClient):
    response = app_client.get("/tts", params={"text": "Hello"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_tts_validates_text(app_client: TestClient):
    token = register_user(app_client).json()["token"]

    blank = app_client.get("/tts", params={"text": "   "}, headers=auth_headers(token))
    too_long = app_client.get(
        "/tts",
        params={"text": "x" * (main.MAX_TTS_LENGTH + 1)},
        headers=auth_headers(token),
    )

    assert blank.status_code == 400
    assert blank.json()["detail"] == "Text is required."
    assert too_long.status_code == 413
    assert str(main.MAX_TTS_LENGTH) in too_long.json()["detail"]


def test_tts_streams_audio_from_upstream(app_client: TestClient, monkeypatch: pytest.MonkeyPatch):
    token = register_user(app_client).json()["token"]

    class FakeTTSResponse:
        status_code = 200
        text = ""

        def iter_content(self, chunk_size: int):
            assert chunk_size == 1024
            yield b"audio-1"
            yield b"audio-2"

    def fake_post(url, json, headers, stream, timeout):
        assert "text-to-speech" in url
        assert json["text"] == "Hello there"
        assert headers["xi-api-key"] == "test-elevenlabs-key"
        assert stream is True
        assert timeout == 30
        return FakeTTSResponse()

    monkeypatch.setattr(main.requests, "post", fake_post)

    response = app_client.get("/tts", params={"text": "Hello there"}, headers=auth_headers(token))

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"audio-1audio-2"


def test_tts_propagates_upstream_failure_status(app_client: TestClient, monkeypatch: pytest.MonkeyPatch):
    token = register_user(app_client).json()["token"]

    class FakeTTSResponse:
        status_code = 429
        text = "rate limited"

    monkeypatch.setattr(main.requests, "post", lambda *args, **kwargs: FakeTTSResponse())

    response = app_client.get("/tts", params={"text": "Hello"}, headers=auth_headers(token))

    assert response.status_code == 429
    assert response.json()["detail"] == "rate limited"


def test_tts_returns_server_error_when_elevenlabs_is_not_configured(app_client: TestClient, monkeypatch: pytest.MonkeyPatch):
    token = register_user(app_client).json()["token"]
    monkeypatch.setattr(main, "elevenlabs_key", None)

    response = app_client.get("/tts", params={"text": "Hello"}, headers=auth_headers(token))

    assert response.status_code == 500
    assert response.json()["detail"] == "Backend Error: ELEVENLABS_API_KEY not set."
