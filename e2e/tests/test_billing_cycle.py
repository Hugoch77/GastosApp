"""Flujo principal: capturar movimientos y ver cómo pasan de "actual" a "facturado"."""

from playwright.sync_api import Page, expect

from pages.card_form_page import CardFormPage
from pages.dashboard_page import DashboardPage
from pages.transaction_form_page import TransactionFormPage
from pages.transactions_page import TransactionsPage


def create_card(page: Page) -> None:
    form = CardFormPage(page)
    form.fill("Azul", cut_day=15, due_day=5)
    form.save()
    expect(DashboardPage(page).payment_hero).to_be_visible()


def add_transaction(page: Page, **fields) -> None:
    DashboardPage(page).add_transaction_button.click()
    form = TransactionFormPage(page)
    form.fill(**fields)
    form.save()
    expect(DashboardPage(page).payment_hero).to_be_visible()


def test_movements_move_from_current_to_billed_after_cut(page: Page, set_today):
    # Tarjeta: corte día 15, pago día 5.
    set_today("2026-10-10")
    page.goto("/")
    create_card(page)

    add_transaction(page, amount="1,000", description="Supermercado", date="2026-10-01")
    add_transaction(page, amount="3000", description="Liverpool", date="2026-10-05", months=3)
    # El mismo día del corte: pertenece al estado que cierra ese día.
    add_transaction(page, amount="200.50", description="Café", date="2026-10-15")

    # Antes del corte todo está en el periodo actual y no hay nada que pagar.
    dashboard = DashboardPage(page)
    expect(dashboard.payment_status).to_have_attribute("data-status", "paid")
    expect(dashboard.current_period).to_have_text("$2,200.50")
    expect(dashboard.total_balance).to_have_text("$4,200.50")
    expect(dashboard.pending_installments).to_have_text("$2,000.00")

    # Al día siguiente del corte, el periodo se factura.
    set_today("2026-10-16")
    expect(dashboard.no_interest_amount).to_have_text("$2,200.50")
    expect(dashboard.payment_status).to_have_attribute("data-status", "on-track")
    expect(dashboard.due_date).to_have_text("jueves, 5 de noviembre")
    expect(dashboard.suggested_payment_date).to_have_text("martes, 3 de noviembre")
    expect(dashboard.current_period).to_have_text("$1,000.00")  # mensualidad 2/3

    transactions = TransactionsPage(page)
    transactions.open()
    transactions.select_view("billed")
    expect(transactions.descriptions).to_have_text(["Café", "Liverpool", "Supermercado"])
    expect(transactions.rows.filter(has_text="Liverpool")).to_contain_text("MSI 1/3")
    expect(transactions.period_total).to_have_text("$2,200.50")


def test_payment_status_changes_as_due_date_approaches(page: Page, set_today):
    set_today("2026-10-10")
    page.goto("/")
    create_card(page)
    add_transaction(page, amount="500", description="Farmacia", date="2026-10-02")

    dashboard = DashboardPage(page)
    set_today("2026-10-29")  # faltan 5 días para la fecha sugerida (3 nov)
    expect(dashboard.payment_status).to_have_attribute("data-status", "due-soon")

    set_today("2026-11-04")  # ya pasó la sugerida, aún no la límite
    expect(dashboard.payment_status).to_have_attribute("data-status", "past-suggested")

    add_transaction(
        page, amount="500", description="", date="2026-11-04", transaction_type="payment"
    )
    expect(dashboard.payment_status).to_have_attribute("data-status", "paid")


def test_bank_that_moves_cut_day_purchases_to_next_statement(page: Page, set_today):
    # Corte día 5, pago día 25; lo comprado el día 5 se paga hasta el mes siguiente.
    set_today("2026-10-05")
    page.goto("/")
    form = CardFormPage(page)
    form.fill("Platinum", cut_day=5, due_day=25, cut_day_in_next_period=True)
    form.save()
    dashboard = DashboardPage(page)
    expect(dashboard.payment_hero).to_be_visible()
    # El día de corte el estado ya cerró: el próximo corte es el siguiente mes.
    expect(dashboard.next_cut).to_have_text("jue 5 de nov")

    add_transaction(page, amount="800", description="Día anterior", date="2026-10-04")
    add_transaction(page, amount="300", description="Día de corte", date="2026-10-05")

    expect(dashboard.no_interest_amount).to_have_text("$800.00")
    expect(dashboard.due_date).to_have_text("domingo, 25 de octubre")
    expect(dashboard.current_period).to_have_text("$300.00")

    transactions = TransactionsPage(page)
    transactions.open()
    expect(transactions.period_range).to_have_text("lun 5 de oct – mié 4 de nov")
    expect(transactions.descriptions).to_have_text(["Día de corte"])
