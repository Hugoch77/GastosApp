from datetime import datetime

from playwright.sync_api import Page, expect

from pages.card_form_page import CardFormPage
from pages.dashboard_page import DashboardPage


def test_new_user_sees_onboarding(page: Page, set_today):
    set_today("2026-10-23")
    page.goto("/")

    expect(CardFormPage(page).title).to_have_text("Configura tu tarjeta")


def test_today_uses_mexico_city_time_zone(page: Page):
    # 23:30 en CDMX = 05:30 UTC del día siguiente. Si la app usara UTC, el corte
    # del día 23 ya habría pasado y mostraría noviembre.
    page.clock.set_fixed_time(datetime.fromisoformat("2026-10-24T05:30:00+00:00"))
    page.goto("/")

    form = CardFormPage(page)
    form.fill("Azul", cut_day=23, due_day=12)

    expect(form.preview_cut_date).to_have_text("viernes, 23 de octubre")


def test_cut_day_31_in_february_uses_last_day_of_month(page: Page, set_today):
    set_today("2027-02-10")
    page.goto("/")

    form = CardFormPage(page)
    form.fill("Oro", cut_day=31, due_day=20)
    expect(form.preview_cut_date).to_have_text("domingo, 28 de febrero")
    expect(form.preview_due_date).to_have_text("sábado, 20 de marzo")
    # 2 días antes de la fecha límite
    expect(form.preview_suggested_date).to_have_text("jueves, 18 de marzo")
    form.save()

    dashboard = DashboardPage(page)
    expect(dashboard.title).to_have_text("Oro")
    expect(dashboard.next_cut).to_have_text("dom 28 de feb")
    expect(dashboard.next_cut_detail).to_have_text("en 18 días")


def test_warns_when_grace_period_looks_too_short(page: Page, set_today):
    set_today("2026-10-23")
    page.goto("/")

    form = CardFormPage(page)
    form.fill("Azul", cut_day=15, due_day=25)

    expect(form.grace_warning).to_contain_text("solo 10 días")


def test_required_fields_are_validated(page: Page, set_today):
    set_today("2026-10-23")
    page.goto("/")

    form = CardFormPage(page)
    form.save()

    expect(form.error_for("card-name")).to_be_visible()
    expect(form.error_for("cut-day")).to_be_visible()
    expect(form.error_for("due-day")).to_be_visible()
