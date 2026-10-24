"""Las pruebas usan una base de datos real (rama `test` de Neon o el Postgres de CI).

TEST_DATABASE_URL sale del entorno o de api/.env. Al iniciar se recrean todas las
tablas con las migraciones, y antes de cada prueba se vacían.
"""

import os
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from dotenv import dotenv_values

API_DIR = Path(__file__).resolve().parent.parent

_env_file = dotenv_values(API_DIR / ".env")
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or _env_file.get("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    raise pytest.UsageError("Falta TEST_DATABASE_URL (variable de entorno o api/.env)")
if TEST_DATABASE_URL == (os.environ.get("DATABASE_URL") or _env_file.get("DATABASE_URL")):
    raise pytest.UsageError("TEST_DATABASE_URL no puede ser la misma base que DATABASE_URL")

# Antes de importar la app: toda la configuración apunta a la base de pruebas.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import get_engine, get_session_factory  # noqa: E402
from app.main import app  # noqa: E402
from app.users import create_user  # noqa: E402
from tests.helpers import PASSWORD, bearer, login  # noqa: E402

def alembic_config() -> Config:
    return Config(API_DIR / "alembic.ini")


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    """Recrea el esquema desde cero con las migraciones (así también se prueban)."""
    command.downgrade(alembic_config(), "base")
    command.upgrade(alembic_config(), "head")
    yield
    get_engine().dispose()


@pytest.fixture(autouse=True)
def clean_tables() -> None:
    with get_engine().begin() as connection:
        connection.execute(
            text(
                "TRUNCATE users, sessions, cards, categories, transactions "
                "RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def db() -> Iterator[Session]:
    with get_session_factory()() as session:
        yield session


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def user_email(db: Session) -> str:
    return create_user(db, "Yo@Correo.com", PASSWORD).email


@pytest.fixture
def auth_headers(client: TestClient, user_email: str) -> dict[str, str]:
    return bearer(login(client, user_email))


@pytest.fixture
def sync(client: TestClient) -> Callable[..., dict[str, Any]]:
    """sync(headers, cursor=0, cards=[...], ...) → JSON de la respuesta (exige 200)."""

    def _sync(headers: dict[str, str], cursor: int = 0, **changes: list[dict]) -> dict[str, Any]:
        response = client.post("/sync", headers=headers, json={"cursor": cursor, **changes})
        assert response.status_code == 200, response.text
        return response.json()

    return _sync
