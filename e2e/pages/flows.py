"""Pasos que se repiten en varias pruebas (crear tarjeta, capturar movimientos)."""

from playwright.sync_api import Page, expect

from pages.card_form_page import CardFormPage
from pages.dashboard_page import DashboardPage
from pages.transaction_form_page import TransactionFormPage


def create_card(page: Page, name: str = "Azul", cut_day: int = 15, due_day: int = 5) -> None:
    form = CardFormPage(page)
    form.fill(name, cut_day=cut_day, due_day=due_day)
    form.save()
    expect(DashboardPage(page).title).to_have_text(name)


def add_transaction(page: Page, category: str | None = None, **fields) -> None:
    """Captura un movimiento desde el botón "+"; `category` es el texto de la opción."""
    DashboardPage(page).add_transaction_button.click()
    form = TransactionFormPage(page)
    form.fill(**fields)
    if category:
        # Las opciones muestran "🍔 Comida": se busca por el nombre sin el emoji.
        option = form.category.locator("option", has_text=category).first
        form.category.select_option(option.get_attribute("value"))
    form.save()
    expect(DashboardPage(page).add_transaction_button).to_be_visible()
