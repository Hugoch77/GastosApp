import datetime as dt

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import AuthSession
from app.security import token_hash
from tests.helpers import PASSWORD, bearer, login


def test_login_returns_a_token_that_opens_the_session(client: TestClient, user_email: str):
    token = login(client, user_email)
    response = client.get("/auth/me", headers=bearer(token))
    assert response.status_code == 200
    assert response.json() == {"email": "yo@correo.com"}


@pytest.mark.parametrize("email", ["yo@correo.com", "YO@CORREO.COM", "  yo@correo.com "])
def test_email_ignores_case_and_spaces(client: TestClient, user_email: str, email: str):
    assert login(client, email)


@pytest.mark.parametrize(
    ("email", "password"),
    [
        ("yo@correo.com", "contraseña equivocada"),
        ("nadie@correo.com", PASSWORD),
        ("yo@correo.com", ""),
    ],
)
def test_wrong_credentials_get_the_same_error(
    client: TestClient, user_email: str, email: str, password: str
):
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 401
    # Mismo mensaje para correo inexistente y contraseña mala: no revela qué correos existen.
    assert response.json()["detail"] == "Correo o contraseña incorrectos"


@pytest.mark.parametrize(
    "headers",
    [{}, bearer("token-inventado"), {"Authorization": "Basic abc"}],
    ids=["sin token", "token inventado", "otro esquema"],
)
@pytest.mark.parametrize(
    ("method", "path"),
    [("GET", "/auth/me"), ("POST", "/sync"), ("POST", "/auth/logout"), ("POST", "/auth/logout-all")],
)
def test_protected_routes_require_a_valid_token(
    client: TestClient, headers: dict[str, str], method: str, path: str
):
    response = client.request(method, path, headers=headers, json={"cursor": 0})
    assert response.status_code == 401


def test_only_the_token_hash_is_stored(client: TestClient, user_email: str, db: Session):
    token = login(client, user_email, device="Celular")
    stored = db.scalars(select(AuthSession)).one()
    assert stored.token_hash == token_hash(token)
    assert token not in stored.token_hash
    assert stored.device_name == "Celular"


def test_logout_closes_only_this_device(client: TestClient, user_email: str):
    phone = login(client, user_email, device="Celular")
    computer = login(client, user_email, device="Computadora")

    assert client.post("/auth/logout", headers=bearer(phone)).status_code == 204
    assert client.get("/auth/me", headers=bearer(phone)).status_code == 401
    assert client.get("/auth/me", headers=bearer(computer)).status_code == 200


def test_logout_all_closes_every_device(client: TestClient, user_email: str):
    phone = login(client, user_email)
    computer = login(client, user_email)

    assert client.post("/auth/logout-all", headers=bearer(phone)).status_code == 204
    assert client.get("/auth/me", headers=bearer(phone)).status_code == 401
    assert client.get("/auth/me", headers=bearer(computer)).status_code == 401


@pytest.mark.parametrize(
    ("idle_days", "expected_status"),
    [(179, 200), (181, 401)],
    ids=["usada hace 179 días", "sin usar más de 180 días"],
)
def test_session_expires_only_after_long_inactivity(
    client: TestClient, user_email: str, db: Session, idle_days: int, expected_status: int
):
    token = login(client, user_email)
    last_used = dt.datetime.now(dt.UTC) - dt.timedelta(days=idle_days)
    db.execute(update(AuthSession).values(last_used_at=last_used))
    db.commit()

    assert client.get("/auth/me", headers=bearer(token)).status_code == expected_status


def test_using_the_session_keeps_it_alive(client: TestClient, user_email: str, db: Session):
    token = login(client, user_email)
    old = dt.datetime.now(dt.UTC) - dt.timedelta(days=100)
    db.execute(update(AuthSession).values(last_used_at=old))
    db.commit()

    client.get("/auth/me", headers=bearer(token))
    db.expire_all()
    stored = db.scalars(select(AuthSession)).one()
    assert stored.last_used_at > old + dt.timedelta(days=99)
