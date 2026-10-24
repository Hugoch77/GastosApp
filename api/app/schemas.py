"""Formato JSON de la API (Pydantic). Repite las reglas de `src/data/schema.ts` (Zod).

El JSON usa camelCase igual que la app (`cutDay`, `amountCents`...); en Python los
campos van en snake_case y `to_camel` hace la conversión.
"""

import datetime as dt
from typing import Annotated, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    model_validator,
)
from pydantic.alias_generators import to_camel

# Límite por lista en una sincronización (la primera sube todo lo que hay en el celular).
MAX_RECORDS_PER_SYNC = 20_000


def to_js_timestamp(value: dt.datetime) -> str:
    """Mismo formato que `Date.toISOString()` de JavaScript: 2026-10-24T20:15:00.000Z."""
    utc = value.astimezone(dt.UTC)
    return utc.strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc.microsecond // 1000:03d}Z"


# Con zona horaria obligatoria; se responde en el formato de JavaScript.
Timestamp = Annotated[AwareDatetime, PlainSerializer(to_js_timestamp, return_type=str)]
Id = Annotated[str, StringConstraints(min_length=1, max_length=64)]
DayOfMonth = Annotated[int, Field(ge=1, le=31)]


def _text(max_length: int) -> StringConstraints:
    """Texto sin espacios al inicio o al final, de 1 a `max_length` caracteres."""
    return StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Card(ApiModel):
    id: Id
    name: Annotated[str, _text(40)]
    cut_day: DayOfMonth
    cut_day_in_next_period: bool
    due_day: DayOfMonth
    payment_buffer_days: int = Field(ge=0, le=10)
    created_at: Timestamp
    updated_at: Timestamp
    deleted_at: Timestamp | None


class Category(ApiModel):
    id: Id
    name: Annotated[str, _text(30)]
    # Un emoji; algunos ocupan varias unidades de texto (p. ej. con tono de piel).
    icon: Annotated[str, _text(16)]
    updated_at: Timestamp
    deleted_at: Timestamp | None


class Installments(ApiModel):
    months: int = Field(ge=2, le=48)


class Transaction(ApiModel):
    id: Id
    card_id: Id
    date: dt.date
    description: Annotated[str, _text(80)]
    # Siempre positivo; el signo lo da `type`.
    amount_cents: int = Field(gt=0, le=10**12)
    type: Literal["charge", "payment", "refund"]
    category_id: Id | None
    installments: Installments | None
    created_at: Timestamp
    updated_at: Timestamp
    deleted_at: Timestamp | None

    @model_validator(mode="after")
    def only_charges_have_installments(self) -> "Transaction":
        if self.type != "charge" and self.installments is not None:
            raise ValueError("Solo los cargos pueden ser a meses sin intereses")
        return self


class SyncRequest(ApiModel):
    """Lo que el dispositivo cambió desde su última sincronización."""

    # Última revisión que el dispositivo ya recibió; 0 = nunca ha sincronizado.
    cursor: int = Field(ge=0)
    cards: list[Card] = Field(default_factory=list, max_length=MAX_RECORDS_PER_SYNC)
    categories: list[Category] = Field(default_factory=list, max_length=MAX_RECORDS_PER_SYNC)
    transactions: list[Transaction] = Field(
        default_factory=list, max_length=MAX_RECORDS_PER_SYNC
    )


class SyncResponse(ApiModel):
    """Lo que cambió en el servidor desde `cursor` (sin repetir lo que se acaba de subir)."""

    cursor: int
    cards: list[Card]
    categories: list[Category]
    transactions: list[Transaction]


class LoginRequest(ApiModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)
    # Para reconocer la sesión, p. ej. "Celular" o "Computadora".
    device_name: str = Field(default="", max_length=60)


class LoginResponse(ApiModel):
    token: str


class Me(ApiModel):
    email: str
