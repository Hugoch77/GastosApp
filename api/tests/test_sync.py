"""Sincronización entre dos dispositivos (celular y computadora) del mismo usuario."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.users import create_user
from tests.factories import card, category, transaction
from tests.helpers import PASSWORD, bearer, login

Sync = Callable[..., dict[str, Any]]


@pytest.fixture
def phone(client: TestClient, user_email: str) -> dict[str, str]:
    return bearer(login(client, user_email, device="Celular"))


@pytest.fixture
def computer(client: TestClient, user_email: str) -> dict[str, str]:
    return bearer(login(client, user_email, device="Computadora"))


def test_new_device_receives_everything(sync: Sync, phone, computer):
    sync(phone, cards=[card()], categories=[category()], transactions=[transaction()])

    received = sync(computer, cursor=0)
    assert received["cards"] == [card()]
    assert received["categories"] == [category()]
    assert received["transactions"] == [transaction()]
    assert received["cursor"] > 0


def test_records_round_trip_exactly(sync: Sync, phone, computer):
    """Lo que baja es idéntico a lo que subió (formato de fechas incluido)."""
    msi = transaction(
        "tx-msi",
        updated_at="2026-10-24T20:15:30.123Z",
        installments={"months": 12},
        deletedAt="2026-10-24T20:15:30.123Z",
        categoryId=None,
    )
    sync(phone, transactions=[msi])
    assert sync(computer)["transactions"] == [msi]


def test_own_changes_are_not_sent_back(sync: Sync, phone):
    result = sync(phone, cards=[card()], transactions=[transaction()])
    assert result["cards"] == []
    assert result["transactions"] == []
    assert result["cursor"] > 0


def test_only_new_changes_after_the_cursor(sync: Sync, phone, computer):
    sync(phone, transactions=[transaction("tx-1")])
    cursor = sync(computer)["cursor"]

    sync(phone, transactions=[transaction("tx-2")])
    received = sync(computer, cursor=cursor)
    assert [t["id"] for t in received["transactions"]] == ["tx-2"]

    # Sin cambios nuevos: nada que bajar y el cursor no cambia.
    again = sync(computer, cursor=received["cursor"])
    assert again["transactions"] == []
    assert again["cursor"] == received["cursor"]


def test_empty_sync_with_nothing_stored(sync: Sync, phone):
    assert sync(phone) == {"cursor": 0, "cards": [], "categories": [], "transactions": []}


@pytest.mark.parametrize(
    ("server_updated_at", "incoming_updated_at", "winner"),
    [
        ("2026-10-01T12:00:00.000Z", "2026-10-02T12:00:00.000Z", "incoming"),
        ("2026-10-02T12:00:00.000Z", "2026-10-01T12:00:00.000Z", "server"),
        ("2026-10-01T12:00:00.000Z", "2026-10-01T12:00:00.000Z", "server"),
        ("2026-10-01T12:00:00.000Z", "2026-10-01T12:00:00.001Z", "incoming"),
    ],
    ids=["más nuevo gana", "más viejo se ignora", "empate se queda el servidor", "1 ms basta"],
)
def test_most_recent_change_wins(
    sync: Sync, phone, computer, server_updated_at, incoming_updated_at, winner
):
    sync(phone, cards=[card(name="Servidor", updated_at=server_updated_at)])
    sync(computer, cards=[card(name="Entrante", updated_at=incoming_updated_at)])

    stored = sync(phone, cursor=0)["cards"][0]
    assert stored["name"] == ("Entrante" if winner == "incoming" else "Servidor")


def test_losing_change_receives_the_winner(sync: Sync, phone, computer):
    """Si lo que sube un dispositivo es más viejo, recibe la versión del servidor."""
    sync(phone, transactions=[transaction(description="Nuevo", updated_at="2026-10-05T00:00:00.000Z")])
    cursor = 0
    result = sync(
        computer,
        cursor=cursor,
        transactions=[transaction(description="Viejo", updated_at="2026-10-01T00:00:00.000Z")],
    )
    assert [t["description"] for t in result["transactions"]] == ["Nuevo"]


def test_deletions_are_synced(sync: Sync, phone, computer):
    sync(phone, transactions=[transaction()])
    cursor = sync(computer)["cursor"]

    deleted = transaction(
        updated_at="2026-10-03T00:00:00.000Z", deletedAt="2026-10-03T00:00:00.000Z"
    )
    sync(phone, transactions=[deleted])
    assert sync(computer, cursor=cursor)["transactions"] == [deleted]


def test_repeated_id_in_one_request_keeps_the_newest(sync: Sync, phone, computer):
    sync(
        phone,
        categories=[
            category(name="Nuevo", updated_at="2026-10-02T00:00:00.000Z"),
            category(name="Viejo", updated_at="2026-10-01T00:00:00.000Z"),
        ],
    )
    assert [c["name"] for c in sync(computer)["categories"]] == ["Nuevo"]


def test_users_do_not_see_each_other(client: TestClient, db: Session, sync: Sync, phone):
    create_user(db, "otra@correo.com", PASSWORD)
    other = bearer(login(client, "otra@correo.com"))

    sync(phone, cards=[card()])
    sync(other, cards=[card(name="De otra persona", updated_at="2026-12-01T00:00:00.000Z")])

    # El mismo id en dos usuarios son registros distintos.
    assert sync(phone, cursor=0)["cards"][0]["name"] == "BBVA Platinum"
    assert sync(other, cursor=0)["cards"][0]["name"] == "De otra persona"


def test_text_is_trimmed_like_the_app(sync: Sync, phone, computer):
    sync(phone, categories=[category(name="  Comida  ")])
    assert sync(computer)["categories"][0]["name"] == "Comida"


@pytest.mark.parametrize(
    "changes",
    [
        {"cards": [card(cutDay=32)]},
        {"cards": [card(paymentBufferDays=11)]},
        {"cards": [card(name="")]},
        {"cards": [card(createdAt="2026-10-01T12:00:00")]},  # sin zona horaria
        {"categories": [category(icon="   ")]},
        {"transactions": [transaction(amountCents=0)]},
        {"transactions": [transaction(amountCents=-100)]},
        {"transactions": [transaction(amountCents=12.5)]},
        {"transactions": [transaction(type="transfer")]},
        {"transactions": [transaction(date="2026-02-30")]},
        {"transactions": [transaction(type="payment", installments={"months": 3})]},
        {"transactions": [transaction(installments={"months": 1})]},
        {"transactions": [transaction(description="x" * 81)]},
        {"transactions": [transaction(campoExtra=True)]},
        {"cursor": -1},
    ],
    ids=lambda changes: next(iter(changes)),
)
def test_invalid_data_is_rejected_and_nothing_is_saved(
    client: TestClient, sync: Sync, phone, changes
):
    body = {"cursor": 0, "cards": [card("card-valida")], **changes}
    response = client.post("/sync", headers=phone, json=body)
    assert response.status_code == 422

    # La tarjeta válida del mismo envío tampoco se guardó.
    assert sync(phone)["cards"] == []
