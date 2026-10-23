import json
from pathlib import Path

from playwright.sync_api import Page, expect

from pages.card_form_page import CardFormPage
from pages.dashboard_page import DashboardPage
from pages.settings_page import SettingsPage


def create_card(page: Page, name: str = "Azul") -> None:
    form = CardFormPage(page)
    form.fill(name, cut_day=15, due_day=5)
    form.save()
    expect(DashboardPage(page).title).to_have_text(name)


def test_data_persists_after_reload(page: Page, set_today):
    set_today("2026-10-23")
    page.goto("/")
    create_card(page)

    page.reload()

    expect(DashboardPage(page).title).to_have_text("Azul")


def test_export_and_import_on_another_device(page: Page, set_today, tmp_path: Path):
    set_today("2026-10-23")
    page.goto("/")
    create_card(page, "Mi tarjeta")

    settings = SettingsPage(page)
    settings.open()
    backup = settings.export_backup(tmp_path)
    assert backup.name == "gastosapp-respaldo-2026-10-23.json"
    assert json.loads(backup.read_text(encoding="utf-8"))["schemaVersion"] == 2

    # "Otro dispositivo": sin datos, se importa desde la pantalla de bienvenida.
    page.evaluate("localStorage.clear()")
    page.reload()
    expect(CardFormPage(page).title).to_have_text("Configura tu tarjeta")

    SettingsPage(page).choose_backup_file(backup)

    expect(DashboardPage(page).title).to_have_text("Mi tarjeta")


def test_invalid_backup_is_rejected_without_touching_data(
    page: Page, set_today, tmp_path: Path
):
    set_today("2026-10-23")
    page.goto("/")
    create_card(page)

    bad_file = tmp_path / "malo.json"
    bad_file.write_text('{"schemaVersion": 1}', encoding="utf-8")

    settings = SettingsPage(page)
    settings.open()
    settings.choose_backup_file(bad_file)
    settings.import_confirm.click()

    expect(settings.import_message).to_contain_text("datos inválidos")
    page.get_by_test_id("nav-dashboard").click()
    expect(DashboardPage(page).title).to_have_text("Azul")
