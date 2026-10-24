from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from app.db import get_engine
from app.models import Base


def test_migrations_match_the_models():
    """Si cambias models.py, hace falta una migración nueva (y viceversa)."""
    with get_engine().connect() as connection:
        differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    assert differences == []
