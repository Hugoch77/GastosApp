"""Búsqueda y filtro por categoría en Movimientos."""

from playwright.sync_api import Page, expect

from pages.flows import add_transaction, create_card
from pages.transactions_page import TransactionsPage


def test_search_and_filter_transactions(page: Page, set_today):
    set_today("2026-10-20")
    page.goto("/")
    create_card(page)
    add_transaction(page, amount="100", description="Rappi", date="2026-10-17", category="Comida")
    add_transaction(page, amount="50.50", description="Rappi", date="2026-10-18", category="Comida")
    add_transaction(
        page, amount="500", description="Gasolina", date="2026-10-19", category="Gasolina"
    )
    add_transaction(page, amount="45", description="Café", date="2026-10-19", category="Comida")

    transactions = TransactionsPage(page)
    transactions.open()
    transactions.search.fill("rappi")
    expect(transactions.descriptions).to_have_text(["Rappi", "Rappi"])
    expect(transactions.filter_count).to_have_text("2 resultados")
    expect(transactions.filter_total).to_have_text("$150.50")

    # Sin acentos también encuentra.
    transactions.search.fill("cafe")
    expect(transactions.descriptions).to_have_text(["Café"])

    # Los filtros se conservan al abrir un movimiento y regresar.
    transactions.rows.first.click()
    page.go_back()
    expect(transactions.search).to_have_value("cafe")

    transactions.search.fill("")
    transactions.filter_by_category("Gasolina")
    expect(transactions.descriptions).to_have_text(["Gasolina"])

    transactions.search.fill("rappi")
    expect(transactions.empty_list).to_contain_text("Ningún movimiento coincide")

    transactions.clear_filters.click()
    expect(transactions.rows).to_have_count(4)
    expect(transactions.search).to_have_value("")
