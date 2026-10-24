"""Sincronización con la nube contra un servidor falso (ver e2e/fake_api.py)."""

import re
from collections.abc import Callable

from playwright.sync_api import Page, expect

from fake_api import EMAIL, PASSWORD, FakeApi
from pages.dashboard_page import DashboardPage
from pages.flows import add_transaction, create_card
from pages.settings_page import SettingsPage
from pages.sync_panel import SyncPanel
from pages.transactions_page import TransactionsPage

T0 = "2026-10-01T12:00:00.000Z"
SYNCED = re.compile(r"Última sincronización: hoy")


def wait_until(page: Page, condition: Callable[[], bool], timeout_ms: int = 10_000) -> None:
    """Espera a que el servidor falso cumpla `condition` (sus rutas corren mientras se espera)."""
    for _ in range(timeout_ms // 100):
        if condition():
            return
        page.wait_for_timeout(100)
    raise AssertionError("El servidor falso no recibió lo esperado a tiempo")


def login_from_settings(page: Page) -> SyncPanel:
    SettingsPage(page).open()
    panel = SyncPanel(page)
    panel.login(EMAIL, PASSWORD)
    expect(panel.status).to_have_text(SYNCED)
    return panel


def test_login_uploads_the_data_of_this_device(page: Page, set_today, fake_api: FakeApi):
    set_today("2026-10-20", ticking=True)
    page.goto("/")
    create_card(page, "Azul")
    add_transaction(page, amount="250", description="Rappi", date="2026-10-18")

    panel = login_from_settings(page)

    expect(panel.account).to_contain_text(EMAIL)
    expect(panel.account).to_contain_text("Este dispositivo: Celular")
    assert [c["name"] for c in fake_api.stored("cards")] == ["Azul"]
    assert [t["description"] for t in fake_api.stored("transactions")] == ["Rappi"]
    # Las categorías por defecto sin tocar viajan con fecha 1970.
    food = next(c for c in fake_api.stored("categories") if c["id"] == "food")
    assert food["updatedAt"] == "1970-01-01T00:00:00.000Z"


def test_new_device_gets_its_data_from_the_welcome_screen(
    page: Page, set_today, fake_api: FakeApi
):
    """Una computadora nueva: inicia sesión desde la Bienvenida y recibe todo."""
    fake_api.add("cards", {
        "id": "card-bbva", "name": "BBVA Platinum", "cutDay": 5, "cutDayInNextPeriod": True,
        "dueDay": 25, "paymentBufferDays": 2, "createdAt": T0, "updatedAt": T0, "deletedAt": None,
    })
    fake_api.add("categories", {
        "id": "food", "name": "Restaurantes", "icon": "🍔", "updatedAt": T0, "deletedAt": None,
    })
    fake_api.add("transactions", {
        "id": "tx-1", "cardId": "card-bbva", "date": "2026-10-18", "description": "Tacos",
        "amountCents": 18000, "type": "charge", "categoryId": "food", "installments": None,
        "createdAt": T0, "updatedAt": T0, "deletedAt": None,
    })
    set_today("2026-10-20", ticking=True)
    page.goto("/")

    SyncPanel(page).login(EMAIL, PASSWORD, device="Computadora")

    expect(DashboardPage(page).title).to_have_text("BBVA Platinum")
    transactions = TransactionsPage(page)
    transactions.open()
    expect(transactions.rows.first).to_contain_text("Tacos")
    # La categoría renombrada en el otro dispositivo no se pisó con la de por defecto.
    expect(transactions.rows.first).to_contain_text("Restaurantes")


def test_wrong_password_shows_an_error(page: Page, set_today, fake_api: FakeApi):
    set_today("2026-10-20", ticking=True)
    page.goto("/")
    create_card(page)
    SettingsPage(page).open()

    panel = SyncPanel(page)
    panel.login(EMAIL, "otra contraseña")

    expect(panel.login_error).to_have_text("Correo o contraseña incorrectos")
    expect(panel.login_form).to_be_visible()


def test_new_changes_are_uploaded_automatically(page: Page, set_today, fake_api: FakeApi):
    set_today("2026-10-20", ticking=True)
    page.goto("/")
    create_card(page)
    login_from_settings(page)

    page.get_by_test_id("nav-dashboard").click()
    add_transaction(page, amount="99", description="Netflix", date="2026-10-19")

    # Unos segundos después del cambio se sube solo, sin tocar nada.
    wait_until(page, lambda: len(fake_api.stored("transactions")) == 1)
    assert fake_api.stored("transactions")[0]["description"] == "Netflix"
    SettingsPage(page).open()
    expect(SyncPanel(page).pending).to_have_count(0)
    # La última subida solo llevó el movimiento nuevo.
    last = fake_api.sync_requests[-1]
    assert (len(last["cards"]), len(last["transactions"])) == (0, 1)


def test_expired_session_asks_to_login_again(page: Page, set_today, fake_api: FakeApi):
    set_today("2026-10-20", ticking=True)
    page.goto("/")
    create_card(page)
    panel = login_from_settings(page)

    fake_api.expire_sessions()
    panel.sync_now.click()

    expect(panel.login_form).to_be_visible()
    expect(panel.login_error).to_contain_text("vuelve a iniciar sesión")


def test_logout_keeps_the_data_on_this_device(page: Page, set_today, fake_api: FakeApi):
    set_today("2026-10-20", ticking=True)
    page.goto("/")
    create_card(page, "Azul")
    panel = login_from_settings(page)

    panel.logout_button.click()

    expect(panel.login_form).to_be_visible()
    assert fake_api.tokens == set()
    page.get_by_test_id("nav-dashboard").click()
    expect(DashboardPage(page).title).to_have_text("Azul")


def test_logout_everywhere_closes_every_session(page: Page, set_today, fake_api: FakeApi):
    set_today("2026-10-20", ticking=True)
    page.goto("/")
    create_card(page)
    panel = login_from_settings(page)

    panel.logout_all_button.click()
    panel.logout_all_confirm.click()

    expect(panel.login_form).to_be_visible()
    assert fake_api.tokens == set()


def test_backup_reminder_is_hidden_while_signed_in(page: Page, set_today, fake_api: FakeApi):
    set_today("2026-10-01")
    page.goto("/")
    create_card(page)
    set_today("2026-10-20")  # 19 días sin respaldo: normalmente aparece el aviso
    expect(DashboardPage(page).backup_reminder).to_be_visible()

    login_from_settings(page)
    page.get_by_test_id("nav-dashboard").click()
    expect(DashboardPage(page).backup_reminder).to_have_count(0)


def test_the_real_api_is_never_called(page: Page, set_today):
    """Sin `fake_api`, cualquier llamada a la API publicada se bloquea."""
    set_today("2026-10-20", ticking=True)
    page.goto("/")
    create_card(page)
    SettingsPage(page).open()

    SyncPanel(page).login(EMAIL, PASSWORD)
    expect(SyncPanel(page).login_error).to_contain_text("No se pudo conectar")
