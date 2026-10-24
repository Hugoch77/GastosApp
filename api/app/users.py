"""Alta de usuarios y cambio de contraseña (solo desde la línea de comandos, ver cli.py)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuthSession, User
from app.security import MIN_PASSWORD_LENGTH, hash_password


class UserError(ValueError):
    pass


def normalize_email(email: str) -> str:
    return email.strip().lower()


def find_user(db: Session, email: str) -> User | None:
    return db.scalars(select(User).where(User.email == normalize_email(email))).one_or_none()


def _check_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise UserError(f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres")


def create_user(db: Session, email: str, password: str) -> User:
    email = normalize_email(email)
    if "@" not in email:
        raise UserError("Correo inválido")
    if find_user(db, email):
        raise UserError(f"Ya existe un usuario con el correo {email}")
    _check_password(password)

    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    return user


def set_password(db: Session, email: str, password: str) -> None:
    """Cambia la contraseña y cierra todas las sesiones abiertas."""
    user = find_user(db, email)
    if user is None:
        raise UserError(f"No existe un usuario con el correo {normalize_email(email)}")
    _check_password(password)

    user.password_hash = hash_password(password)
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    db.commit()
