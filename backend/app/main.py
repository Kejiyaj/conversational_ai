import logging
import os
from datetime import datetime
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from app import models
from app.agent import AgentError, call_agent
from app.db import get_db

logging.basicConfig(format="%(levelname)s [%(name)s] %(message)s")  # show the level on app logs
logger = logging.getLogger("app.chat")

app = FastAPI(title="Conversational AI backend")


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    intent: str | None = None


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


def _persist(db: DbSession, session_id: str, message: str, result: dict) -> None:
    """Store the session (if new) plus the user and assistant messages in one transaction."""
    for attempt in (1, 2):
        try:
            if db.get(models.Session, session_id) is None:
                db.add(models.Session(id=session_id))
                # No relationship() links the models, so the unit of work won't order the inserts
                # by FK; flush the session row first (still the same transaction).
                db.flush()
            db.add(models.Message(session_id=session_id, role="user", content=message))
            db.add(
                models.Message(
                    session_id=session_id,
                    role="assistant",
                    content=result["reply"],
                    intent=result["intent"],
                    latency_ms=result["latency_ms"],
                    source=result["source"],
                )
            )
            db.commit()
            return
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
    _persist(db, req.session_id, req.message, result)
    return ChatResponse(session_id=req.session_id, reply=result["reply"], intent=result["intent"])


@app.get("/api/chat/{session_id}/history", response_model=HistoryResponse)
def history(session_id: str, db: DbSession = Depends(get_db)):
    rows = db.scalars(
        select(models.Message)
        .where(models.Message.session_id == session_id)
        .order_by(models.Message.created_at, models.Message.id)
    ).all()
    return HistoryResponse(session_id=session_id, messages=rows)
