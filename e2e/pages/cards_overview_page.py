from playwright.sync_api import Locator, Page


class CardsOverviewPage:
    """Pantalla "Todas las tarjetas" (/tarjetas)."""

    def __init__(self, page: Page) -> None:
        self.page = page
        self.total_no_interest = page.get_by_test_id("cards-total-no-interest")
        self.total_balance = page.get_by_test_id("cards-total-balance")
        self.total_pending_installments = page.get_by_test_id("cards-total-pending-installments")
        self.rows = page.get_by_test_id("card-overview-row")
        self.names = page.get_by_test_id("card-overview-name")

    def row(self, name: str) -> Locator:
        return self.rows.filter(has=self.page.get_by_test_id("card-overview-name").get_by_text(name, exact=True))

    def status_of(self, name: str) -> str | None:
        """Semáforo de la tarjeta: on-track, due-soon, past-suggested, overdue o paid."""
        return self.row(name).get_by_test_id("card-overview-status").get_attribute("data-status")
