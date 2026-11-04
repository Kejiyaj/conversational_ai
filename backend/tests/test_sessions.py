"""GET /api/sessions — contract: specs/001-chat-session-sidebar/contracts/sessions-api.md."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app import models

BASE = datetime(2026, 11, 4, 9, 0, tzinfo=timezone.utc)


def post_chat(client, session_id, message):
    r = client.post("/api/chat", json={"session_id": session_id, "message": message})
    assert r.status_code == 200
    return r


def set_activity(engine, session_id, minutes):
    """Pin a session's timestamps so ordering doesn't depend on wall-clock resolution."""
    at = BASE + timedelta(minutes=minutes)
    with Session(engine) as db:
        db.execute(update(models.Session).where(models.Session.id == session_id).values(created_at=at))
        db.execute(
            update(models.Message).where(models.Message.session_id == session_id).values(created_at=at)
        )
        db.commit()
    return at


def list_sessions(client, *ids):
    return client.get("/api/sessions", params=[("ids", i) for i in ids])


def row_counts(engine):
    with Session(engine) as db:
        return (
            db.scalar(select(func.count()).select_from(models.Session)),
            db.scalar(select(func.count()).select_from(models.Message)),
        )


def test_returns_requested_sessions_newest_first_with_title_and_last_active(client, engine):
    post_chat(client, "a", "first topic")
    post_chat(client, "a", "a follow-up")
    post_chat(client, "b", "second topic")
    set_activity(engine, "a", minutes=1)
    set_activity(engine, "b", minutes=5)

    r = list_sessions(client, "a", "b")

    assert r.status_code == 200
    sessions = r.json()["sessions"]
    assert [s["session_id"] for s in sessions] == ["b", "a"]
    assert [s["title"] for s in sessions] == ["second topic", "first topic"]
    for s in sessions:
        assert set(s) == {"session_id", "title", "created_at", "last_active_at"}
    assert datetime.fromisoformat(sessions[0]["last_active_at"]).replace(
        tzinfo=timezone.utc
    ) == BASE + timedelta(minutes=5)


def test_last_active_is_the_latest_message_time(client, engine):
    post_chat(client, "a", "first topic")
    set_activity(engine, "a", minutes=1)
    with Session(engine) as db:
        first_turn_max_id = db.scalar(select(func.max(models.Message.id)))
    post_chat(client, "a", "later message")
    later = BASE + timedelta(minutes=30)
    with Session(engine) as db:  # pin the second turn (user + assistant rows) after the first
        db.execute(
            update(models.Message).where(models.Message.id > first_turn_max_id).values(created_at=later)
        )
        db.commit()

    s = list_sessions(client, "a").json()["sessions"][0]

    assert datetime.fromisoformat(s["last_active_at"]).replace(tzinfo=timezone.utc) == later
    assert datetime.fromisoformat(s["created_at"]).replace(tzinfo=timezone.utc) == BASE + timedelta(
        minutes=1
    )
    assert s["title"] == "first topic"


def test_unknown_and_unrequested_ids_are_not_returned(client):
    post_chat(client, "mine", "hello")
    post_chat(client, "someone-else", "private")

    sessions = list_sessions(client, "mine", "does-not-exist").json()["sessions"]

    assert [s["session_id"] for s in sessions] == ["mine"]


def test_no_ids_or_only_blank_ids_returns_empty_list(client):
    post_chat(client, "a", "hello")

    assert client.get("/api/sessions").json() == {"sessions": []}
    assert list_sessions(client, "", "   ").json() == {"sessions": []}


def test_more_than_200_ids_returns_400(client):
    r = list_sessions(client, *[f"s{i}" for i in range(201)])
    assert r.status_code == 400
    assert r.json() == {"detail": "too many session ids (max 200)"}

    assert list_sessions(client, *[f"s{i}" for i in range(200)]).status_code == 200


def test_long_or_multiline_first_message_is_collapsed_and_truncated(client):
    long_message = "  Hello\n\nthere   " + "x" * 100
    post_chat(client, "long", long_message)
    post_chat(client, "short", "  short\n  title  ")

    titles = {s["session_id"]: s["title"] for s in list_sessions(client, "long", "short").json()["sessions"]}

    expected = ("Hello there " + "x" * 100)[:80] + "…"
    assert titles["long"] == expected
    assert len(titles["long"]) == 81
    assert titles["short"] == "short title"


def test_duplicate_ids_return_one_entry(client):
    post_chat(client, "a", "hello")

    sessions = list_sessions(client, "a", "a", " a ").json()["sessions"]

    assert [s["session_id"] for s in sessions] == ["a"]


def test_listing_creates_no_rows(client, engine):
    post_chat(client, "a", "hello")
    before = row_counts(engine)

    list_sessions(client, "a", "new-unknown-id")
    client.get("/api/sessions")

    assert row_counts(engine) == before


def test_continuing_an_older_session_moves_it_to_the_top(client, engine):
    post_chat(client, "a", "first topic")
    post_chat(client, "b", "second topic")
    set_activity(engine, "a", minutes=1)
    set_activity(engine, "b", minutes=2)
    assert [s["session_id"] for s in list_sessions(client, "a", "b").json()["sessions"]] == ["b", "a"]

    with Session(engine) as db:
        before = db.scalar(select(func.max(models.Message.id)))
    post_chat(client, "a", "continuing the first topic")
    with Session(engine) as db:  # the new turn in "a" is the most recent activity
        db.execute(
            update(models.Message)
            .where(models.Message.id > before)
            .values(created_at=BASE + timedelta(minutes=10))
        )
        db.commit()

    sessions = list_sessions(client, "a", "b").json()["sessions"]
    assert [s["session_id"] for s in sessions] == ["a", "b"]
    assert sessions[0]["title"] == "first topic"  # the label stays the first message
