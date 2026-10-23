"""La app es instalable (manifest + íconos) y funciona sin conexión."""

from playwright.sync_api import Page, expect

from pages.card_form_page import CardFormPage
from pages.dashboard_page import DashboardPage


def wait_for_service_worker(page: Page) -> None:
    """Espera a que el service worker esté activo (con todo el build en caché)."""
    page.evaluate("navigator.serviceWorker.ready.then(() => true)")


def test_manifest_is_valid_and_icons_exist(page: Page, base_url: str):
    response = page.request.get(f"{base_url}/manifest.webmanifest")
    assert response.ok
    manifest = response.json()

    assert manifest["name"] == "GastosApp"
    assert manifest["display"] == "standalone"
    assert manifest["lang"] == "es-MX"
    sizes = {icon["sizes"] for icon in manifest["icons"]}
    assert {"192x192", "512x512"} <= sizes
    assert any(icon.get("purpose") == "maskable" for icon in manifest["icons"])

    for icon in manifest["icons"]:
        assert page.request.get(f"{base_url}/{icon['src']}").ok, icon["src"]


def test_works_offline_with_saved_data(page: Page, set_today):
    set_today("2026-10-23")
    page.goto("/")
    form = CardFormPage(page)
    form.fill("Azul", cut_day=15, due_day=5)
    form.save()
    expect(DashboardPage(page).title).to_have_text("Azul")

    wait_for_service_worker(page)
    expect(page.get_by_test_id("pwa-toast")).to_contain_text("sin conexión")

    page.context.set_offline(True)
    page.reload()

    expect(DashboardPage(page).title).to_have_text("Azul")
    expect(DashboardPage(page).next_cut).to_have_text("dom 15 de nov")
