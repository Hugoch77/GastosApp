"""Registros en el mismo formato JSON que usa la app (camelCase, fechas de JavaScript)."""

from typing import Any

T0 = "2026-10-01T12:00:00.000Z"


def card(id: str = "card-1", updated_at: str = T0, **fields: Any) -> dict[str, Any]:
    return {
        "id": id,
        "name": "BBVA Platinum",
        "cutDay": 5,
        "cutDayInNextPeriod": True,
        "dueDay": 25,
        "paymentBufferDays": 2,
        "createdAt": T0,
        "updatedAt": updated_at,
        "deletedAt": None,
        **fields,
    }


def category(id: str = "food", updated_at: str = T0, **fields: Any) -> dict[str, Any]:
    return {
        "id": id,
        "name": "Comida",
        "icon": "🍔",
        "updatedAt": updated_at,
        "deletedAt": None,
        **fields,
    }


def transaction(id: str = "tx-1", updated_at: str = T0, **fields: Any) -> dict[str, Any]:
    return {
        "id": id,
        "cardId": "card-1",
        "date": "2026-10-01",
        "description": "Rappi",
        "amountCents": 25000,
        "type": "charge",
        "categoryId": "food",
        "installments": None,
        "createdAt": T0,
        "updatedAt": updated_at,
        "deletedAt": None,
        **fields,
    }
