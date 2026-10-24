"""Compartir texto a la app desde otra (menú "Compartir" de Android, Web Share Target).

Playwright no puede abrir el menú del sistema; se simula lo que hace Android:
abrir la URL `action` del manifest con el texto en los parámetros que declara.
"""

from urllib.parse import urlencode

from playwright.sync_api import Page, expect

from pages.flows import create_card
from pages.transaction_form_page import TransactionFormPage
from pages.transactions_page import TransactionsPage


def share_url(page: Page, base_url: str, **fields: str) -> str:
    """URL que abriría Android al compartir `fields` (title, text, url) a la app."""
    manifest = page.request.get(f"{base_url}/manifest.webmanifest").json()
    target = manifest["share_target"]
    assert target["method"] == "GET"
    query = urlencode({target["params"][field]: value for field, value in fields.items()})
    return f"{target['action']}?{query}"


def test_manifest_declares_share_target(page: Page, base_url: str):
    manifest = page.request.get(f"{base_url}/manifest.webmanifest").json()
    target = manifest["share_target"]
    assert target["action"] == "./"
    assert set(target["params"]) == {"title", "text", "url"}


def test_shared_text_prefills_the_form(page: Page, base_url: str, set_today):
    set_today("2026-10-23")
    page.goto("/")
    create_card(page)

    page.goto(share_url(page, base_url, title="Pedido", text="Pedido 250 en Rappi ayer"))

    form = TransactionFormPage(page)
    expect(page.get_by_test_id("voice-transcript")).to_contain_text(
        "Recibí: “Pedido 250 en Rappi ayer”"
    )
    expect(form.amount).to_have_value("250.00")
    expect(form.description).to_have_value("Pedido en Rappi")
    expect(form.date).to_have_value("2026-10-22")
    expect(form.category).to_have_value("food")
    # Los parámetros de "Compartir" ya no quedan en la URL.
    assert "compartido" not in page.url
    assert page.url.endswith("#/movimientos/nuevo?texto=Pedido%20250%20en%20Rappi%20ayer")

    form.save()
    expect(TransactionsPage(page).rows.first).to_contain_text("Pedido en Rappi")


def test_empty_share_opens_empty_form(page: Page, base_url: str, set_today):
    set_today("2026-10-23")
    page.goto("/")
    create_card(page)

    page.goto(share_url(page, base_url, text=""))

    form = TransactionFormPage(page)
    expect(form.amount).to_have_value("")
    expect(page.get_by_test_id("voice-transcript")).to_have_count(0)
