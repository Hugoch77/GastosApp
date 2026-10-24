"""Pantalla "Todas las tarjetas": totales y lo más urgente arriba."""

from playwright.sync_api import Page, expect

from pages.card_form_page import CardFormPage
from pages.cards_overview_page import CardsOverviewPage
from pages.dashboard_page import DashboardPage
from pages.flows import add_transaction, create_card


def test_link_only_appears_with_several_cards(page: Page, set_today):
    set_today("2026-10-20")
    page.goto("/")
    create_card(page, "Azul")
    expect(page.get_by_test_id("all-cards-link")).to_have_count(0)


def test_shows_totals_and_most_urgent_card_first(page: Page, set_today):
    set_today("2026-10-20")
    page.goto("/")
    # Azul: corte 15, pago 5 → se sugiere pagar el 3 nov (en 14 días).
    create_card(page, "Azul", cut_day=15, due_day=5)
    add_transaction(page, amount="500", description="Súper", date="2026-10-01")

    # Oro: corte 5, pago 25 → se sugiere pagar el 23 oct (en 3 días).
    page.goto("/#/tarjetas/nueva")
    form = CardFormPage(page)
    form.fill("Oro", cut_day=5, due_day=25)
    form.save()
    expect(DashboardPage(page).title).to_have_text("Oro")
    add_transaction(page, amount="300", description="Cine", date="2026-09-20")
    add_transaction(page, amount="1200", description="Tenis", date="2026-10-10", months=3)

    page.get_by_test_id("all-cards-link").click()
    overview = CardsOverviewPage(page)
    expect(overview.total_no_interest).to_have_text("$800.00")
    expect(overview.total_balance).to_have_text("$2,000.00")
    expect(overview.total_pending_installments).to_have_text("$800.00")

    expect(overview.names).to_have_text(["Oro", "Azul"])
    assert overview.status_of("Oro") == "due-soon"
    assert overview.status_of("Azul") == "on-track"
    expect(overview.row("Oro")).to_contain_text("Paga el vie 23 de oct")

    # Al tocar una tarjeta se abre su panel.
    overview.row("Azul").click()
    dashboard = DashboardPage(page)
    expect(dashboard.title).to_have_text("Azul")
    expect(dashboard.no_interest_amount).to_have_text("$500.00")
