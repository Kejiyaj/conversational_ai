import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.db import Base, get_db
from app.main import app


@pytest.fixture
def engine():
    """In-memory SQLite, so tests need no running Postgres."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def enforce_foreign_keys(dbapi_conn, _record):  # SQLite ignores FKs unless asked, unlike Postgres
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def client(engine, monkeypatch):
    monkeypatch.delenv("AGENT_URL", raising=False)

    def override_get_db():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
