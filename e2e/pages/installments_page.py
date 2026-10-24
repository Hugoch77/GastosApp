from playwright.sync_api import Page


class InstallmentsPage:
    """Pantalla /msi: compras a meses vigentes y proyección de mensualidades."""

    def __init__(self, page: Page) -> None:
        self.page = page
        self.remaining_total = page.get_by_test_id("msi-remaining-total")
        self.current_period = page.get_by_test_id("msi-current-period")
        self.after_current_cut = page.get_by_test_id("msi-after-current-cut")
        self.active_count = page.get_by_test_id("msi-active-count")
        self.projection_rows = page.get_by_test_id("msi-projection-row")
        self.plans = page.get_by_test_id("msi-plan")
        self.plan_descriptions = page.get_by_test_id("msi-plan-description")
        self.empty = page.get_by_test_id("msi-empty")

    def open_from_dashboard(self) -> None:
        self.page.get_by_test_id("pending-installments").click()
