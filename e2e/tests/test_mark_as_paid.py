"""Atajo "Ya pagué": registrar el pago del estado facturado sin esperar a la fecha límite."""

from playwright.sync_api import Page, expect

from pages.card_form_page import CardFormPage
from pages.cards_overview_page import CardsOverviewPage
from pages.dashboard_page import DashboardPage
from pages.flows import add_transaction, create_card
from pages.transactions_page import TransactionsPage


def test_mark_as_paid_updates_balances_right_away(page: Page, set_today):
    # Corte 5, pago 25 (como la BBVA): límite miércoles 25 nov, sugerida lunes 23 nov.
    set_today("2026-11-18")
    page.goto("/")
    create_card(page, "Oro", cut_day=5, due_day=25)
    add_transaction(page, amount="1,500", description="Súper", date="2026-11-01")
    add_transaction(page, amount="300", description="Cine", date="2026-11-10")

    dashboard = DashboardPage(page)
    expect(dashboard.no_interest_amount).to_have_text("$1,500.00")
    expect(dashboard.total_balance).to_have_text("$1,800.00")

    # Pagó antes de la fecha sugerida: queda al corriente desde ya.
    dashboard.mark_as_paid()
    expect(dashboard.payment_status).to_have_attribute("data-status", "paid")
    expect(dashboard.paid_since_cut).to_contain_text("$1,500.00")
    expect(dashboard.total_balance).to_have_text("$300.00")

    # Queda como un movimiento de pago normal (se puede editar o borrar).
    transactions = TransactionsPage(page)
    transactions.open()
    expect(transactions.rows.filter(has_text="Pago a tarjeta")).to_have_count(1)


def test_partial_payment_with_an_earlier_date(page: Page, set_today):
    set_today("2026-11-24")
    page.goto("/")
    create_card(page, "Oro", cut_day=5, due_day=25)
    add_transaction(page, amount="1,500", description="Súper", date="2026-11-01")

    dashboard = DashboardPage(page)
    # Pagó $1,000 el 23 y lo registra hasta el 24.
    dashboard.mark_as_paid(amount="1000", date="2026-11-23")
    expect(dashboard.no_interest_amount).to_have_text("$500.00")
    expect(dashboard.payment_status).not_to_have_attribute("data-status", "paid")


def test_payment_dated_before_the_cut_is_rejected(page: Page, set_today):
    set_today("2026-11-18")
    page.goto("/")
    create_card(page, "Oro", cut_day=5, due_day=25)
    add_transaction(page, amount="1,500", description="Súper", date="2026-11-01")

    dashboard = DashboardPage(page)
    dashboard.mark_as_paid(date="2026-11-04")
    expect(dashboard.mark_paid_date_error).to_contain_text("estado anterior")
    expect(dashboard.no_interest_amount).to_have_text("$1,500.00")


def test_mark_all_cards_as_paid(page: Page, set_today):
    set_today("2026-10-20")
    page.goto("/")
    # Azul: corte 15 / pago 5. Oro: corte 5 / pago 25.
    create_card(page, "Azul", cut_day=15, due_day=5)
    add_transaction(page, amount="500", description="Súper", date="2026-10-01")
    page.goto("/#/tarjetas/nueva")
    form = CardFormPage(page)
    form.fill("Oro", cut_day=5, due_day=25)
    form.save()
    expect(DashboardPage(page).title).to_have_text("Oro")
    add_transaction(page, amount="300", description="Cine", date="2026-09-20")

    page.get_by_test_id("all-cards-link").click()
    overview = CardsOverviewPage(page)
    expect(overview.total_no_interest).to_have_text("$800.00")

    overview.mark_all_paid_button.click()
    expect(overview.mark_all_paid_list).to_contain_text("Oro")
    expect(overview.mark_all_paid_list).to_contain_text("Azul")
    overview.mark_all_paid_confirm.click()

    expect(overview.total_no_interest).to_have_text("$0.00")
    assert overview.status_of("Oro") == "paid"
    assert overview.status_of("Azul") == "paid"
    expect(overview.mark_all_paid_button).to_have_count(0)
