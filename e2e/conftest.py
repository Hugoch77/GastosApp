import pytest


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args, playwright):
    """Todas las pruebas corren con viewport de celular y zona horaria de CDMX."""
    return {
        **browser_context_args,
        **playwright.devices["Pixel 7"],
        "locale": "es-MX",
        "timezone_id": "America/Mexico_City",
    }
