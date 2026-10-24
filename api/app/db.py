"""Conexión a Postgres con SQLAlchemy."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


def sqlalchemy_url(database_url: str) -> str:
    """Neon da `postgresql://...`; SQLAlchemy necesita saber que el driver es psycopg (v3)."""
    for prefix in ("postgresql://", "postgres://"):
        if database_url.startswith(prefix):
            return "postgresql+psycopg://" + database_url.removeprefix(prefix)
    return database_url


@lru_cache
def get_engine() -> Engine:
    # pool_pre_ping: Neon suspende la base tras unos minutos sin uso y corta las
    # conexiones abiertas; así se detectan y se reemplazan antes de usarlas.
    return create_engine(sqlalchemy_url(get_settings().database_url), pool_pre_ping=True)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesión de base de datos por petición."""
    with get_session_factory()() as db:
        yield db
