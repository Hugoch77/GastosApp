"""Tablas de la base de datos.

Las tablas sincronizadas (cards, categories, transactions) guardan lo mismo que la app
en LocalStorage, más:
- `user_id`: de quién es el registro (la llave primaria es usuario + id).
- `revision`: número creciente que se asigna al guardar un cambio. Cada dispositivo
  recuerda la última revisión que recibió (su "cursor") y en la siguiente
  sincronización pide solo lo que tenga una revisión mayor.
"""

import datetime as dt

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Sequence,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# Una sola secuencia para todas las tablas: así un solo número sirve de cursor.
revision_seq = Sequence("sync_revision_seq", metadata=Base.metadata)


def timestamp() -> DateTime:
    return DateTime(timezone=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Se guarda en minúsculas para que el inicio de sesión no dependa de mayúsculas.
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[dt.datetime] = mapped_column(timestamp(), server_default=func.now())


class AuthSession(Base):
    """Un dispositivo con la sesión iniciada. Solo se guarda el hash del token."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    device_name: Mapped[str] = mapped_column(String(60))
    created_at: Mapped[dt.datetime] = mapped_column(timestamp(), server_default=func.now())
    last_used_at: Mapped[dt.datetime] = mapped_column(timestamp(), server_default=func.now())


class SyncedRow:
    """Columnas comunes de las tablas sincronizadas."""

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    updated_at: Mapped[dt.datetime] = mapped_column(timestamp())
    deleted_at: Mapped[dt.datetime | None] = mapped_column(timestamp())
    revision: Mapped[int] = mapped_column(BigInteger, index=True)


class CardRow(SyncedRow, Base):
    __tablename__ = "cards"

    name: Mapped[str] = mapped_column(String(40))
    cut_day: Mapped[int] = mapped_column(SmallInteger)
    cut_day_in_next_period: Mapped[bool]
    due_day: Mapped[int] = mapped_column(SmallInteger)
    payment_buffer_days: Mapped[int] = mapped_column(SmallInteger)
    created_at: Mapped[dt.datetime] = mapped_column(timestamp())


class CategoryRow(SyncedRow, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(30))
    icon: Mapped[str] = mapped_column(String(16))


class TransactionRow(SyncedRow, Base):
    __tablename__ = "transactions"

    card_id: Mapped[str] = mapped_column(String(64))
    date: Mapped[dt.date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(80))
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    type: Mapped[str] = mapped_column(String(10))
    category_id: Mapped[str | None] = mapped_column(String(64))
    # null = de contado; si no, los meses sin intereses.
    installment_months: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[dt.datetime] = mapped_column(timestamp())
