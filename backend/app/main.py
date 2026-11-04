import logging
import os
from datetime import datetime
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from app import feedback, models
from app.agent import AgentError, call_agent
from app.db import get_db

logging.basicConfig(format="%(levelname)s [%(name)s] %(message)s")  # show the level on app logs
logger = logging.getLogger("app.chat")

app = FastAPI(title="Conversational AI backend")
app.include_router(feedback.router)


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    intent: str | None = None
    # Id of the assistant message created for this reply (the id to rate). Typed nullable because
    # new fields must be nullable or optional (Principle I), but always an integer today.
    message_id: int | None


class HistoryMessage(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: Literal["user", "assistant"]
    content: str
    intent: str | None
    latency_ms: int | None
    source: Literal["agent", "mock"] | None
    created_at: datetime


class HistoryResponse(BaseModel):
    session_id: str
    messages: list[HistoryMessage]


class SessionSummary(BaseModel):
    session_id: str
    title: str
    created_at: datetime
    last_active_at: datetime


class SessionsResponse(BaseModel):
    sessions: list[SessionSummary]


MAX_SESSION_IDS = 200
TITLE_MAX_CHARS = 80


@app.get("/api/health")
def health():
    return {"status": "ok"}


def _reply_for(session_id: str, message: str) -> dict:
    """Ask the agent; fall back to the mock reply (and log why) if it is unset or fails."""
    agent_url = os.getenv("AGENT_URL")  # full URL, e.g. http://localhost:8080/invocations
    if not agent_url:
        logger.warning("AGENT_URL is not set; returning mock reply (session_id=%s)", session_id)
    else:
        try:
            result = call_agent(agent_url, session_id, message)
            return {
                "reply": result.reply,
                "intent": result.intent,
                "latency_ms": result.latency_ms,
                "source": "agent",
            }
        except AgentError as e:
            logger.warning(
                "Agent call failed (%s); returning mock reply (session_id=%s)", e, session_id
            )
    return {
        "reply": f"(mock) You said: {message}",
        "intent": None,
        "latency_ms": None,
        "source": "mock",
    }


def _persist(db: DbSession, session_id: str, message: str, result: dict) -> int:
    """Store the session (if new) plus the user and assistant messages in one transaction.

    Returns the id of the assistant message.
    """
    for attempt in (1, 2):
        try:
            if db.get(models.Session, session_id) is None:
                db.add(models.Session(id=session_id))
                # No relationship() links the models, so the unit of work won't order the inserts
                # by FK; flush the session row first (still the same transaction).
                db.flush()
            db.add(models.Message(session_id=session_id, role="user", content=message))
            assistant = models.Message(
                session_id=session_id,
                role="assistant",
                content=result["reply"],
                intent=result["intent"],
                latency_ms=result["latency_ms"],
                source=result["source"],
            )
            db.add(assistant)
            db.flush()  # assigns the id; read it before commit, which expires the object
            assistant_id = assistant.id
            db.commit()
            return assistant_id
        except IntegrityError:
            # Lost a race creating the same new session concurrently; retry once.
            db.rollback()
            if attempt == 2:
                raise


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: DbSession = Depends(get_db)):
    if not req.session_id.strip():
        raise HTTPException(status_code=400, detail="session_id must not be empty")
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message must not be empty")

    # The agent is called before touching the DB so no connection/transaction is held open during
    # the HTTP call; both messages are still written and committed together afterwards.
    result = _reply_for(req.session_id, req.message)
    message_id = _persist(db, req.session_id, req.message, result)
    return ChatResponse(
        session_id=req.session_id,
        reply=result["reply"],
        intent=result["intent"],
        message_id=message_id,
    )


@app.get("/api/chat/{session_id}/history", response_model=HistoryResponse)
def history(session_id: str, db: DbSession = Depends(get_db)):
    rows = db.scalars(
        select(models.Message)
        .where(models.Message.session_id == session_id)
        .order_by(models.Message.created_at, models.Message.id)
    ).all()
    return HistoryResponse(session_id=session_id, messages=rows)


def _title_from(message: str) -> str:
    """First user message as a one-line label: collapse whitespace, cap at 80 chars plus '…'."""
    text = " ".join(message.split())
    return text if len(text) <= TITLE_MAX_CHARS else text[:TITLE_MAX_CHARS] + "…"


@app.get("/api/sessions", response_model=SessionsResponse)
def list_sessions(ids: list[str] = Query(default=[]), db: DbSession = Depends(get_db)):
    """Summaries of the requested sessions (the browser's own list), newest activity first.

    Read-only: unknown ids are skipped and nothing is created.
    """
    if len(ids) > MAX_SESSION_IDS:
        raise HTTPException(status_code=400, detail=f"too many session ids (max {MAX_SESSION_IDS})")
    wanted = {i.strip() for i in ids if i.strip()}
    if not wanted:
        return SessionsResponse(sessions=[])

    msg = models.Message
    first_user_message = (
        select(msg.content)
        .where(msg.session_id == models.Session.id, msg.role == "user")
        .order_by(msg.created_at, msg.id)
        .limit(1)
        .correlate(models.Session)
        .scalar_subquery()
    )
    last_active = func.max(msg.created_at).label("last_active_at")
    rows = db.execute(
        select(models.Session.id, models.Session.created_at, last_active, first_user_message.label("title"))
        .join(msg, msg.session_id == models.Session.id)
        .where(models.Session.id.in_(wanted))
        .group_by(models.Session.id, models.Session.created_at)
        .order_by(last_active.desc(), models.Session.id)
    ).all()

    return SessionsResponse(
        sessions=[
            SessionSummary(
                session_id=r.id,
                title=_title_from(r.title or ""),
                created_at=r.created_at,
                last_active_at=r.last_active_at,
            )
            for r in rows
        ]
    )
