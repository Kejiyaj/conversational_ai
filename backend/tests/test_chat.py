import logging

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import main, models
from app.agent import AgentError, AgentReply


def post_chat(client, session_id="s1", message="hello"):
    return client.post("/api/chat", json={"session_id": session_id, "message": message})


def test_mock_fallback_when_agent_url_empty(client, engine, caplog):
    with caplog.at_level(logging.WARNING, logger="app.chat"):
        r = post_chat(client, message="hi")

    assert r.status_code == 200
    assert r.json() == {"session_id": "s1", "reply": "(mock) You said: hi", "intent": None}
    assert any("mock reply" in rec.message for rec in caplog.records)

    with Session(engine) as db:
        rows = db.scalars(select(models.Message).order_by(models.Message.id)).all()
        assert [(m.role, m.content, m.source) for m in rows] == [
            ("user", "hi", None),
            ("assistant", "(mock) You said: hi", "mock"),
        ]


def test_mock_fallback_when_agent_call_fails(client, monkeypatch, caplog):
    monkeypatch.setenv("AGENT_URL", "http://agent.invalid/invocations")

    def boom(*args, **kwargs):
        raise AgentError("ConnectTimeout: timed out")

    monkeypatch.setattr(main, "call_agent", boom)

    with caplog.at_level(logging.WARNING, logger="app.chat"):
        r = post_chat(client, message="hi")

    assert r.status_code == 200
    assert r.json()["reply"] == "(mock) You said: hi"
    assert any("ConnectTimeout" in rec.message for rec in caplog.records)
    assert client.get("/api/chat/s1/history").json()["messages"][1]["source"] == "mock"


def test_agent_reply_is_stored_with_source_agent(client, monkeypatch):
    monkeypatch.setenv("AGENT_URL", "http://agent.test/invocations")
    monkeypatch.setattr(
        main,
        "call_agent",
        lambda url, sid, msg: AgentReply(reply="Sure!", intent="get_quote", latency_ms=42),
    )

    r = post_chat(client, message="I need a quote")

    assert r.json() == {"session_id": "s1", "reply": "Sure!", "intent": "get_quote"}
    assistant = client.get("/api/chat/s1/history").json()["messages"][1]
    assert assistant["source"] == "agent"
    assert assistant["intent"] == "get_quote"
    assert assistant["latency_ms"] == 42


@pytest.mark.parametrize(
    "payload, detail",
    [
        ({"session_id": "s1", "message": ""}, "message must not be empty"),
        ({"session_id": "s1", "message": "   "}, "message must not be empty"),
        ({"session_id": "", "message": "hi"}, "session_id must not be empty"),
        ({"session_id": "  ", "message": "hi"}, "session_id must not be empty"),
    ],
)
def test_empty_fields_return_400_and_store_nothing(client, engine, payload, detail):
    r = client.post("/api/chat", json=payload)

    assert r.status_code == 400
    assert r.json() == {"detail": detail}
    with Session(engine) as db:
        assert db.scalars(select(models.Message)).all() == []
        assert db.scalars(select(models.Session)).all() == []


def test_history_returns_messages_in_order(client):
    post_chat(client, message="first")
    post_chat(client, message="second")
    post_chat(client, session_id="other", message="not mine")

    r = client.get("/api/chat/s1/history")

    assert r.status_code == 200
    body = r.json()
    assert body["session_id"] == "s1"
    assert [(m["role"], m["content"]) for m in body["messages"]] == [
        ("user", "first"),
        ("assistant", "(mock) You said: first"),
        ("user", "second"),
        ("assistant", "(mock) You said: second"),
    ]
    ids = [m["id"] for m in body["messages"]]
    assert ids == sorted(ids)


def test_history_for_unknown_session_is_empty_and_creates_nothing(client, engine):
    r = client.get("/api/chat/does-not-exist/history")

    assert r.status_code == 200
    assert r.json() == {"session_id": "does-not-exist", "messages": []}
    with Session(engine) as db:
        assert db.scalars(select(models.Session)).all() == []
