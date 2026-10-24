from playwright.sync_api import Page


class SyncPanel:
    """Sección "Cuenta y sincronización" (en Ajustes y en la Bienvenida)."""

    def __init__(self, page: Page) -> None:
        self.page = page
        self.login_form = page.get_by_test_id("sync-login-form")
        self.email = page.locator("#sync-email")
        self.password = page.locator("#sync-password")
        self.device = page.locator("#sync-device")
        self.login_button = page.get_by_test_id("sync-login")
        self.login_error = page.get_by_test_id("sync-login-error")
        self.account = page.get_by_test_id("sync-account")
        self.status = page.get_by_test_id("sync-status")
        self.pending = page.get_by_test_id("sync-pending")
        self.sync_now = page.get_by_test_id("sync-now")
        self.logout_button = page.get_by_test_id("sync-logout")
        self.logout_all_button = page.get_by_test_id("sync-logout-all")
        self.logout_all_confirm = page.get_by_test_id("sync-logout-all-confirm")

    def login(self, email: str, password: str, device: str = "Celular") -> None:
        self.email.fill(email)
        self.password.fill(password)
        self.device.fill(device)
        self.login_button.click()
