"""Alembic: aplica las migraciones sobre la base de DATABASE_URL."""

from logging.config import fileConfig

from alembic import context

from app.db import get_engine
from app.models import Base

if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name, disable_existing_loggers=False)

with get_engine().connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
