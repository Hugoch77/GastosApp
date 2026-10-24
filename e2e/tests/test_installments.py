"""Pantalla de compras a meses sin intereses vigentes."""

from playwright.sync_api import Page, expect

from pages.flows import add_transaction, create_card
from pages.installments_page import InstallmentsPage


def test_active_installments_and_projection(page: Page, set_today):
    # Corte 15, pago 5. Hoy 20 oct: el estado del 15 oct ya cortó.
    set_today("2026-10-20")
    page.goto("/")
    create_card(page)
    add_transaction(page, amount="3000", description="Pantalla", date="2026-10-01", months=3)
    add_transaction(page, amount="1200", description="Celular", date="2026-09-20", months=12)
    add_transaction(page, amount="500", description="Súper", date="2026-10-18")

    msi = InstallmentsPage(page)
    msi.open_from_dashboard()

    # Pantalla: 2 de 3 pendientes ($2,000); Celular: 11 de 12 ($1,100).
    expect(msi.remaining_total).to_have_text("$3,100.00")
    expect(msi.current_period).to_have_text("$1,100.00")
    expect(msi.active_count).to_have_text("2")
    # La que termina primero va arriba.
    expect(msi.plan_descriptions).to_have_text(["Pantalla", "Celular"])
    expect(msi.plans.first).to_contain_text("1/3")
    expect(msi.plans.first).to_contain_text("Termina ene 2027")

    expect(msi.projection_rows).to_have_count(6)
    expect(msi.projection_rows.nth(0)).to_contain_text("dic 2026")
    expect(msi.projection_rows.nth(0)).to_contain_text("$1,100.00")
    expect(msi.projection_rows.nth(2)).to_contain_text("$100.00")  # Pantalla ya terminó


def test_no_active_installments(page: Page, set_today):
    set_today("2026-10-20")
    page.goto("/")
    create_card(page)
    add_transaction(page, amount="500", description="Súper", date="2026-10-18")

    msi = InstallmentsPage(page)
    msi.open_from_dashboard()
    expect(msi.empty).to_be_visible()
