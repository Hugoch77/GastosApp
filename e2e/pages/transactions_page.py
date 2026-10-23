from playwright.sync_api import Page

VIEW_LABELS = {"current": "Periodo actual", "billed": "Facturado", "all": "Todos"}


class TransactionsPage:
    def __init__(self, page: Page) -> None:
        self.page = page
        self.rows = page.get_by_test_id("transaction-row")
        self.descriptions = page.get_by_test_id("transaction-description")
        self.amounts = page.get_by_test_id("transaction-amount")
        self.period_range = page.get_by_test_id("period-range")
        self.period_total = page.get_by_test_id("period-total")
        self.empty_list = page.get_by_test_id("empty-list")

    def open(self) -> None:
        self.page.get_by_test_id("nav-transactions").click()

    def select_view(self, view: str) -> None:
        self.page.get_by_test_id("period-view").get_by_role(
            "radio", name=VIEW_LABELS[view]
        ).click()
