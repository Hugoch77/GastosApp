"""Sincronización: el dispositivo sube sus cambios y recibe los de los demás.

Reglas:
- Gana el cambio más reciente (`updatedAt`). Uno igual o más viejo que el guardado se ignora.
- Nada se borra de verdad: un borrado es un cambio con `deletedAt`.
- Todos los registros guardados en una misma sincronización reciben la misma revisión
  (un número de `sync_revision_seq`). El dispositivo manda la última revisión que
  recibió (`cursor`) y se le regresa todo lo que tenga una revisión mayor, menos lo que
  acaba de subir (ya lo tiene).
- Las sincronizaciones de un mismo usuario se hacen de una en una (candado de Postgres),
  así una revisión nunca queda "detrás" de un cursor ya entregado.
"""

from collections.abc import Callable, Sequence
from typing import Any

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import CurrentSession, Db
from app.models import CardRow, CategoryRow, SyncedRow, TransactionRow, revision_seq
from app.schemas import (
    Card,
    Category,
    Installments,
    SyncRequest,
    SyncResponse,
    Transaction,
)

router = APIRouter(tags=["sync"])


# ---------- conversión JSON <-> columnas ----------


def card_columns(card: Card) -> dict[str, Any]:
    return {
        "name": card.name,
        "cut_day": card.cut_day,
        "cut_day_in_next_period": card.cut_day_in_next_period,
        "due_day": card.due_day,
        "payment_buffer_days": card.payment_buffer_days,
        "created_at": card.created_at,
        "updated_at": card.updated_at,
        "deleted_at": card.deleted_at,
    }


def card_from_row(row: CardRow) -> Card:
    return Card(
        id=row.id,
        name=row.name,
        cut_day=row.cut_day,
        cut_day_in_next_period=row.cut_day_in_next_period,
        due_day=row.due_day,
        payment_buffer_days=row.payment_buffer_days,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


def category_columns(category: Category) -> dict[str, Any]:
    return {
        "name": category.name,
        "icon": category.icon,
        "updated_at": category.updated_at,
        "deleted_at": category.deleted_at,
    }


def category_from_row(row: CategoryRow) -> Category:
    return Category(
        id=row.id,
        name=row.name,
        icon=row.icon,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


def transaction_columns(transaction: Transaction) -> dict[str, Any]:
    return {
        "card_id": transaction.card_id,
        "date": transaction.date,
        "description": transaction.description,
        "amount_cents": transaction.amount_cents,
        "type": transaction.type,
        "category_id": transaction.category_id,
        "installment_months": (
            transaction.installments.months if transaction.installments else None
        ),
        "created_at": transaction.created_at,
        "updated_at": transaction.updated_at,
        "deleted_at": transaction.deleted_at,
    }


def transaction_from_row(row: TransactionRow) -> Transaction:
    return Transaction(
        id=row.id,
        card_id=row.card_id,
        date=row.date,
        description=row.description,
        amount_cents=row.amount_cents,
        type=row.type,  # type: ignore[arg-type]  # la columna solo guarda valores válidos
        category_id=row.category_id,
        installments=(
            Installments(months=row.installment_months) if row.installment_months else None
        ),
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


# ---------- lógica de sincronización ----------


class RevisionCounter:
    """Pide el número de revisión a Postgres solo si de verdad se guarda algo."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.value: int | None = None

    def get(self) -> int:
        if self.value is None:
            self.value = self.db.execute(select(revision_seq.next_value())).scalar_one()
        return self.value


def apply_changes[R: SyncedRow](
    db: Session,
    user_id: int,
    model: type[R],
    records: Sequence[Card | Category | Transaction],
    to_columns: Callable[[Any], dict[str, Any]],
    revision: RevisionCounter,
) -> None:
    """Guarda los registros que sean más recientes que los del servidor."""
    if not records:
        return

    ids = {record.id for record in records}
    existing = {
        row.id: row
        for row in db.scalars(select(model).where(model.user_id == user_id, model.id.in_(ids)))
    }

    for record in records:
        row = existing.get(record.id)
        if row is not None and record.updated_at <= row.updated_at:
            continue  # el servidor ya tiene este cambio o uno más reciente

        # Primero la revisión: pedirla hace una consulta, y SQLAlchemy guarda lo
        # pendiente antes de consultar (autoflush); un registro nuevo a medio llenar fallaría.
        row_revision = revision.get()
        if row is None:
            row = model(user_id=user_id, id=record.id)
            existing[record.id] = row
        for column, value in to_columns(record).items():
            setattr(row, column, value)
        row.revision = row_revision
        db.add(row)


def changed_since[R: SyncedRow](
    db: Session, user_id: int, model: type[R], cursor: int, skip_revision: int | None
) -> list[R]:
    query = select(model).where(model.user_id == user_id, model.revision > cursor)
    if skip_revision is not None:
        query = query.where(model.revision != skip_revision)
    return list(db.scalars(query.order_by(model.revision, model.id)))


@router.post("/sync")
def sync(body: SyncRequest, session: CurrentSession, db: Db) -> SyncResponse:
    user_id = session.user_id
    # Candado por usuario hasta el commit: dos dispositivos no sincronizan a la vez.
    db.execute(select(func.pg_advisory_xact_lock(user_id)))

    revision = RevisionCounter(db)
    apply_changes(db, user_id, CardRow, body.cards, card_columns, revision)
    apply_changes(db, user_id, CategoryRow, body.categories, category_columns, revision)
    apply_changes(db, user_id, TransactionRow, body.transactions, transaction_columns, revision)
    db.flush()

    cards = changed_since(db, user_id, CardRow, body.cursor, revision.value)
    categories = changed_since(db, user_id, CategoryRow, body.cursor, revision.value)
    transactions = changed_since(db, user_id, TransactionRow, body.cursor, revision.value)

    # El nuevo cursor cubre lo recibido y lo que se acaba de guardar.
    received = [row.revision for row in [*cards, *categories, *transactions]]
    new_cursor = max([body.cursor, revision.value or 0, *received])
    db.commit()

    return SyncResponse(
        cursor=new_cursor,
        cards=[card_from_row(row) for row in cards],
        categories=[category_from_row(row) for row in categories],
        transactions=[transaction_from_row(row) for row in transactions],
    )
