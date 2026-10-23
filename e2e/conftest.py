from collections.abc import Callable
from datetime import datetime, timedelta, timezone

import pytest
from playwright.sync_api import Page

# CDMX no tiene horario de verano desde 2022: siempre UTC-6. Se usa un desfase fijo
# porque Windows no incluye la base de datos de zonas horarias que necesita zoneinfo.
MEXICO_CITY = timezone(timedelta(hours=-6))


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args, playwright):
    """Todas las pruebas corren con viewport de celular y zona horaria de CDMX."""
    return {
        **browser_context_args,
        **playwright.devices["Pixel 7"],
        "locale": "es-MX",
        "timezone_id": "America/Mexico_City",
    }


@pytest.fixture
def set_today(page: Page) -> Callable[[str], None]:
    """Fija la fecha del navegador (mediodía en CDMX).

    Uso: set_today("2026-10-16"). Si la app ya está abierta, recarga la página para
    que tome la nueva fecha; los datos en LocalStorage se conservan.
    """

    def _set_today(iso_date: str) -> None:
        noon = datetime.fromisoformat(iso_date).replace(hour=12, tzinfo=MEXICO_CITY)
        page.clock.set_fixed_time(noon)
        if page.url.startswith("http"):
            page.reload()

    return _set_today
