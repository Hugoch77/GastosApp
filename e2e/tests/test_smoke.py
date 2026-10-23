from datetime import datetime

from playwright.sync_api import Page, expect


def test_app_loads_with_fixed_today(page: Page):
    # 23:30 en CDMX (05:30 UTC del día siguiente): "hoy" debe seguir siendo el 23.
    page.clock.set_fixed_time(datetime.fromisoformat("2026-10-24T05:30:00+00:00"))
    page.goto("/")

    expect(page.get_by_test_id("app-title")).to_have_text("GastosApp")
    expect(page.get_by_test_id("today")).to_have_text("2026-10-23")
