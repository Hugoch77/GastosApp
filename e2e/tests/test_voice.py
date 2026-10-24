"""Captura por voz y por enlace (?texto=), y el acceso directo "Gasto por voz".

El reconocimiento de voz real no se puede usar en CI: se reemplaza por uno falso
que "escucha" la frase indicada.
"""

from urllib.parse import quote

from playwright.sync_api import Page, expect

from pages.dashboard_page import DashboardPage
from pages.flows import create_card
from pages.transaction_form_page import TransactionFormPage
from pages.transactions_page import TransactionsPage

FAKE_RECOGNITION = """
window.SpeechRecognition = class {
    start() {
        setTimeout(() => {
            const config = window.__fakeSpeech
            if (config.error) this.onerror?.({ error: config.error })
            else this.onresult?.({ results: [[{ transcript: config.transcript }]] })
            this.onend?.()
        }, 50)
    }
    stop() {}
    abort() {}
}
"""


def fake_speech(page: Page, transcript: str = "", error: str = "") -> None:
    """Hace que el micrófono "escuche" `transcript` (o falle con `error`)."""
    page.add_init_script(
        f"window.__fakeSpeech = {{ transcript: {transcript!r}, error: {error!r} }};"
        + FAKE_RECOGNITION
    )


def test_text_in_link_prefills_the_form(page: Page, set_today):
    set_today("2026-10-23")
    page.goto("/")
    create_card(page)

    page.goto(f"/#/movimientos/nuevo?texto={quote('250 en Rappi ayer')}")
    form = TransactionFormPage(page)
    expect(page.get_by_test_id("voice-transcript")).to_contain_text("250 en Rappi ayer")
    expect(form.amount).to_have_value("250.00")
    expect(form.description).to_have_value("Rappi")
    expect(form.date).to_have_value("2026-10-22")
    expect(form.category).to_have_value("food")

    # Abierto desde un enlace no hay historial: al guardar regresa a Movimientos.
    form.save()
    transactions = TransactionsPage(page)
    expect(transactions.rows.first).to_contain_text("Rappi")
    expect(transactions.rows.first).to_contain_text("Comida")


def test_voice_button_fills_installment_purchase(page: Page, set_today):
    set_today("2026-10-23")
    fake_speech(page, "Llantas 9 mil 220 a 6 meses")
    page.goto("/")
    create_card(page)

    DashboardPage(page).add_transaction_button.click()
    page.get_by_test_id("voice-button").click()

    form = TransactionFormPage(page)
    expect(form.amount).to_have_value("9220.00")
    expect(form.description).to_have_value("Llantas")
    expect(form.installments_toggle).to_be_checked()
    expect(form.months).to_have_value("6")
    expect(form.category).to_have_value("transport")
    expect(form.installments_preview).to_contain_text("6 mensualidades")


def test_voice_shortcut_starts_listening_on_open(page: Page, set_today):
    set_today("2026-10-23")
    fake_speech(page, "pagué 3000")
    page.goto("/")
    create_card(page)

    # Lo que abre el acceso directo "Gasto por voz" del ícono de la app.
    page.goto("/#/movimientos/nuevo?voz=1")

    form = TransactionFormPage(page)
    expect(form.amount).to_have_value("3000.00")
    expect(
        page.get_by_test_id("transaction-type").get_by_role("radio", name="Pago")
    ).to_be_checked()


def test_microphone_error_is_shown(page: Page, set_today):
    set_today("2026-10-23")
    fake_speech(page, error="not-allowed")
    page.goto("/")
    create_card(page)

    DashboardPage(page).add_transaction_button.click()
    page.get_by_test_id("voice-button").click()
    expect(page.get_by_test_id("voice-error")).to_contain_text("Permite el uso del micrófono")
