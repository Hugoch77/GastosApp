from collections.abc import Callable
from datetime import datetime, timedelta, timezone

import pytest
from playwright.sync_api import Page

from fake_api import API_URL, FakeApi

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
def set_today(page: Page) -> Callable[..., None]:
    """Fija la fecha del navegador (mediodía en CDMX).

    Uso: set_today("2026-10-16"). Si la app ya está abierta, recarga la página para
    que tome la nueva fecha; los datos en LocalStorage se conservan.
    Con `ticking=True` el reloj arranca a esa hora y sigue avanzando (necesario para
    la sincronización, que compara instantes); solo se puede usar una vez por prueba.
    """

    def _set_today(iso_date: str, ticking: bool = False) -> None:
        noon = datetime.fromisoformat(iso_date).replace(hour=12, tzinfo=MEXICO_CITY)
        if ticking:
            page.clock.install(time=noon)
            page.clock.resume()
        else:
            page.clock.set_fixed_time(noon)
        if page.url.startswith("http"):
            page.reload()

    return _set_today


@pytest.fixture(autouse=True)
def block_real_api(page: Page) -> None:
    """Ninguna prueba debe llegar a la API publicada (datos reales)."""
    page.route(f"{API_URL}/**", lambda route: route.abort())


@pytest.fixture
def fake_api(page: Page, block_real_api: None) -> FakeApi:
    """Servidor de sincronización falso; tiene prioridad sobre el bloqueo."""
    api = FakeApi()
    api.install(page)
    return api
