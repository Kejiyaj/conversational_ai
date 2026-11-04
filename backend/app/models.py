from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Identity, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from app.db import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # client-supplied session_id
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant')", name="ck_messages_role"),
        CheckConstraint("source IN ('agent', 'mock')", name="ck_messages_source"),
    )

    # The Integer variant only matters for the SQLite DB used in tests (BigInteger PKs don't autoincrement there).
    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), Identity(), primary_key=True
    )
    session_id: Mapped[str] = mapped_column(
        Text, ForeignKey("sessions.id"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    intent: Mapped[str | None] = mapped_column(Text)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str | None] = mapped_column(Text)  # 'agent' | 'mock'; null on user rows
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
