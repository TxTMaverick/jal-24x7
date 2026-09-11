"""SQLAlchemy engine / session wiring."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

# check_same_thread is a SQLite-only quirk: FastAPI serves requests from a
# threadpool, and SQLite otherwise refuses connections created on another thread.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

# pool_pre_ping tests a connection before handing it out, and pool_recycle
# retires one after five minutes. Both matter on serverless Postgres such as
# Neon, which suspends compute when idle and closes the sockets with it: the
# pool would otherwise keep handing out connections the server has already
# dropped, and the first request after a quiet spell would fail.
engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency -- yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
