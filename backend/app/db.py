import os
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session


class Base(DeclarativeBase):
    # Matches the constraint/index names used in the Alembic migration.
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "pk": "pk_%(table_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s",
        }
    )


def normalize_database_url(url: str) -> str:
    """Force the psycopg (v3) driver so a plain postgresql:// URL works with SQLAlchemy."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return normalize_database_url(url)


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_database_url(), pool_pre_ping=True)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one DB session per request."""
    with Session(get_engine()) as db:
        yield db
