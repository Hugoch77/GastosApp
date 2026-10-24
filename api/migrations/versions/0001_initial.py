"""Tablas iniciales: usuarios, sesiones y datos sincronizados.

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def timestamp() -> sa.DateTime:
    return sa.DateTime(timezone=True)


def synced_columns() -> list[sa.Column]:
    """Columnas comunes de las tablas sincronizadas (ver SyncedRow en models.py)."""
    return [
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("updated_at", timestamp(), nullable=False),
        sa.Column("deleted_at", timestamp(), nullable=True),
        sa.Column("revision", sa.BigInteger, nullable=False, index=True),
    ]


def upgrade() -> None:
    op.execute(sa.schema.CreateSequence(sa.Sequence("sync_revision_seq")))

    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("created_at", timestamp(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("device_name", sa.String(60), nullable=False),
        sa.Column("created_at", timestamp(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_used_at", timestamp(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "cards",
        *synced_columns(),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("cut_day", sa.SmallInteger, nullable=False),
        sa.Column("cut_day_in_next_period", sa.Boolean, nullable=False),
        sa.Column("due_day", sa.SmallInteger, nullable=False),
        sa.Column("payment_buffer_days", sa.SmallInteger, nullable=False),
        sa.Column("created_at", timestamp(), nullable=False),
    )

    op.create_table(
        "categories",
        *synced_columns(),
        sa.Column("name", sa.String(30), nullable=False),
        sa.Column("icon", sa.String(16), nullable=False),
    )

    op.create_table(
        "transactions",
        *synced_columns(),
        sa.Column("card_id", sa.String(64), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("description", sa.String(80), nullable=False),
        sa.Column("amount_cents", sa.BigInteger, nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("category_id", sa.String(64), nullable=True),
        sa.Column("installment_months", sa.SmallInteger, nullable=True),
        sa.Column("created_at", timestamp(), nullable=False),
    )


def downgrade() -> None:
    for table in ("transactions", "categories", "cards", "sessions", "users"):
        op.drop_table(table)
    op.execute(sa.schema.DropSequence(sa.Sequence("sync_revision_seq")))
