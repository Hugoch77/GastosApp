"""Contraseñas (Argon2) y tokens de sesión."""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

MIN_PASSWORD_LENGTH = 12

_hasher = PasswordHasher()
# Si el correo no existe se verifica contra este hash de todos modos, para que la
# respuesta tarde lo mismo y no revele qué correos están registrados.
_DUMMY_HASH = _hasher.hash("contraseña que no se usa")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """`password_hash` es None si el correo no existe."""
    try:
        _hasher.verify(password_hash or _DUMMY_HASH, password)
    except (VerifyMismatchError, InvalidHashError):
        return False
    return password_hash is not None


def new_token() -> str:
    """Token aleatorio que el dispositivo guarda y manda en cada petición."""
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    """En la base solo se guarda el hash: si alguien la lee, no puede usar los tokens."""
    return hashlib.sha256(token.encode()).hexdigest()
