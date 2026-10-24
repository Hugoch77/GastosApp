import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.users import UserError, create_user, set_password
from tests.helpers import PASSWORD, bearer, login


@pytest.mark.parametrize(
    ("email", "password", "message"),
    [
        ("sin-arroba", PASSWORD, "Correo inválido"),
        ("yo@correo.com", "corta", "al menos 12 caracteres"),
    ],
)
def test_create_user_validates_input(db: Session, email: str, password: str, message: str):
    with pytest.raises(UserError, match=message):
        create_user(db, email, password)


def test_email_must_be_unique(db: Session):
    create_user(db, "yo@correo.com", PASSWORD)
    with pytest.raises(UserError, match="Ya existe"):
        create_user(db, "YO@correo.com", PASSWORD)


def test_password_is_not_stored_in_plain_text(db: Session):
    user = create_user(db, "yo@correo.com", PASSWORD)
    assert PASSWORD not in user.password_hash
    assert user.password_hash.startswith("$argon2")


def test_set_password_closes_all_sessions(client: TestClient, db: Session, user_email: str):
    token = login(client, user_email)
    set_password(db, user_email, "otra contraseña larga")

    assert client.get("/auth/me", headers=bearer(token)).status_code == 401
    assert login(client, user_email, password="otra contraseña larga")
