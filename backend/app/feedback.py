import json
import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from app import models
from app.auth import current_user
from app.db import get_db

# The provisional reason list (FR-004, pending approval). This is the only place it is defined.
REASONS = ("incorrect", "unclear", "wanted_a_person", "other")
MAX_COMMENT_CHARS = 1000
RATINGS = ("up", "down")
MESSAGE_ID_PATTERN = re.compile(r"[1-9][0-9]{0,17}")

router = APIRouter()
logger = logging.getLogger("app.feedback")


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message_id: int
    rating: str
    reason: str | None
    comment: str | None
    trace_id: str | None
    created_at: datetime
    updated_at: datetime


async def raw_body(request: Request) -> bytes:
    """The raw request body. Read here so the handler can stay a plain sync def."""
    return await request.body()


def bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=400, detail=detail)


def parse_message_id(value: str) -> int:
    if not MESSAGE_ID_PATTERN.fullmatch(value):
        raise bad_request("message_id must be a positive whole number of at most 18 digits")
    return int(value)


def is_storable(text: str) -> bool:
    """Whether Postgres can store the text. It rejects a NUL character in text, and a lone
    surrogate (valid in JSON, e.g. "\\ud800") can't be encoded as UTF-8, so either would
    otherwise surface as a 500. SQLite accepts a NUL, so only Postgres catches that case."""
    if "\x00" in text:
        return False
    try:
        text.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return True


def parse_feedback_body(raw: bytes) -> dict:
    """Validate the request body, cheapest checks first. The first failure wins.

    Only the fields in the contract are read, so anything else in the body (such as trace_id)
    is ignored.
    """
    try:
        body = json.loads(raw)
    except (ValueError, RecursionError):  # invalid UTF-8, an empty body, or absurdly deep nesting
        body = None
    if not isinstance(body, dict):
        raise bad_request("request body must be a JSON object")

    rating = body.get("rating")
    if not isinstance(rating, str) or rating not in RATINGS:
        raise bad_request('rating must be "up" or "down"')

    reason = body.get("reason")
    if reason is not None:
        if not isinstance(reason, str) or reason not in REASONS:
            raise bad_request("reason must be one of: " + ", ".join(REASONS))
        if rating == "up":
            raise bad_request('reason is only allowed with a "down" rating')

    comment = body.get("comment")
    if comment is not None:
        if not isinstance(comment, str):
            raise bad_request("comment must be a string")
        if not is_storable(comment):
            raise bad_request("comment must not contain null or unpaired surrogate characters")
        if not comment.strip():
            comment = None  # empty or whitespace-only means no comment
        elif len(comment) > MAX_COMMENT_CHARS:
            raise bad_request(f"comment must be at most {MAX_COMMENT_CHARS} characters")

    return {"rating": rating, "reason": reason, "comment": comment}


def find_feedback(db: DbSession, message_id: int) -> models.Feedback | None:
    return db.scalars(select(models.Feedback).where(models.Feedback.message_id == message_id)).first()


def save_feedback(db: DbSession, message_id: int, data: dict) -> models.Feedback:
    """Create the message's feedback row, or replace the existing one, in one transaction.

    Every field is assigned, so an omitted reason or comment clears the earlier value. Assigning
    equal values issues no UPDATE, so resubmitting identical feedback leaves updated_at alone.
    """
    for attempt in (1, 2):
        try:
            row = find_feedback(db, message_id)
            if row is None:
                row = models.Feedback(message_id=message_id)
                db.add(row)
            row.rating = data["rating"]
            row.reason = data["reason"]
            row.comment = data["comment"]
            db.commit()
            return row
        except IntegrityError:
            # A concurrent request inserted the row between our lookup and insert; retry once so
            # this request replaces it (last write wins).
            db.rollback()
            if attempt == 2:
                raise


@router.post("/api/messages/{message_id}/feedback", response_model=FeedbackResponse)
def submit_feedback(
    message_id: str,
    raw: bytes = Depends(raw_body),
    user_id: str = Depends(current_user),
    db: DbSession = Depends(get_db),
):
    id_ = parse_message_id(message_id)
    data = parse_feedback_body(raw)

    message = db.get(models.Message, id_)
    session = db.get(models.Session, message.session_id) if message is not None else None
    if session is None or session.user_id != user_id:
        # Missing, someone else's or nobody's: the same 404, before anything about the message
        # (such as its role) is revealed (spec 008 FR-016, FR-017).
        case = "missing" if message is None else "nobody's" if session.user_id is None else "someone else's"
        logger.warning("Feedback refused (404): message is %s (message_id=%s)", case, id_)
        raise HTTPException(status_code=404, detail="message not found")
    if message.role != "assistant":
        raise bad_request("feedback is only allowed on assistant messages")

    return save_feedback(db, message.id, data)
