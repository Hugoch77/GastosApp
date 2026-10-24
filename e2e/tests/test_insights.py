"""Pestaña Gráficas: historia de estados y gasto por categoría."""

from playwright.sync_api import Page, expect

from pages.flows import add_transaction, create_card
from pages.insights_page import InsightsPage


def test_spending_by_statement_and_category(page: Page, set_today):
    # Corte 15, pago 5. Hoy 20 oct: facturado 16 sep–15 oct; actual 16 oct–15 nov.
    set_today("2026-10-20")
    page.goto("/")
    create_card(page)
    add_transaction(
        page, amount="350", description="Restaurante", date="2026-10-01", category="Comida"
    )
    add_transaction(
        page, amount="500", description="Gasolina", date="2026-10-05", category="Gasolina"
    )
    add_transaction(
        page, amount="900", description="Sillón", date="2026-10-02", category="Hogar", months=3
    )
    add_transaction(page, amount="200", description="Tacos", date="2026-10-18", category="Comida")

    insights = InsightsPage(page)
    insights.open()
    expect(insights.history_bars).to_have_count(6)

    # Por defecto: el periodo actual (tacos + 2a mensualidad del sillón).
    expect(insights.title).to_have_text("Periodo actual")
    expect(insights.total).to_have_text("$500.00")
    expect(insights.category_names).to_have_text(["🏠 Hogar", "🍔 Comida"])

    insights.history_bars.nth(4).click()
    expect(insights.title).to_have_text("Facturado")
    expect(insights.range).to_have_text("mié 16 de sep – jue 15 de oct")
    expect(insights.total).to_have_text("$1,150.00")
    expect(insights.category_names).to_have_text(["⛽ Gasolina", "🍔 Comida", "🏠 Hogar"])
    expect(insights.category_amounts).to_have_text(["$500.00", "$350.00", "$300.00"])

    insights.history_bars.nth(0).click()
    expect(insights.title).to_have_text("Estado de jul 2026")  # corte 15 jun, se paga en julio
    expect(insights.empty).to_be_visible()
