"""Inicio y cierre de sesión.

No hay registro público: el único usuario se crea con `python -m app.cli create-user`.
Cada dispositivo inicia sesión una vez y guarda su token; la sesión dura mientras se
use al menos una vez cada `session_max_idle_days` días.
"""

import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import AuthSession, User
from app.schemas import LoginRequest, LoginResponse, Me
from app.security import new_token, token_hash, verify_password
from app.users import find_user

router = APIRouter(prefix="/auth", tags=["auth"])

_bearer = HTTPBearer(auto_error=False)

Db = Annotated[Session, Depends(get_db)]


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"}
    )


def current_session(
    db: Db,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthSession:
    """Dependencia para las rutas que requieren sesión (encabezado `Authorization: Bearer ...`)."""
    if credentials is None:
        raise _unauthorized("Inicia sesión")

    session = db.scalars(
        select(AuthSession).where(AuthSession.token_hash == token_hash(credentials.credentials))
    ).one_or_none()
    if session is None:
        raise _unauthorized("La sesión no es válida; vuelve a iniciar sesión")

    now = dt.datetime.now(dt.UTC)
    max_idle = dt.timedelta(days=get_settings().session_max_idle_days)
    if now - session.last_used_at > max_idle:
        db.delete(session)
        db.commit()
        raise _unauthorized("La sesión expiró; vuelve a iniciar sesión")

    session.last_used_at = now
    db.commit()
    return session


CurrentSession = Annotated[AuthSession, Depends(current_session)]


@router.post("/login")
def login(body: LoginRequest, db: Db) -> LoginResponse:
    user = find_user(db, body.email)
    if not verify_password(user.password_hash if user else None, body.password):
        raise _unauthorized("Correo o contraseña incorrectos")
    assert user is not None  # verify_password regresa False si no existe

    token = new_token()
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=token_hash(token),
            device_name=body.device_name.strip(),
        )
    )
    db.commit()
    return LoginResponse(token=token)


@router.get("/me")
def me(session: CurrentSession, db: Db) -> Me:
    user = db.get_one(User, session.user_id)
    return Me(email=user.email)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(session: CurrentSession, db: Db) -> Response:
    """Cierra la sesión de este dispositivo."""
    db.delete(session)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(session: CurrentSession, db: Db) -> Response:
    """Cierra la sesión en todos los dispositivos (p. ej. si se perdió el celular)."""
    db.execute(delete(AuthSession).where(AuthSession.user_id == session.user_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
