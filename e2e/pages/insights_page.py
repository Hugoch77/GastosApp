from playwright.sync_api import Page


class InsightsPage:
    """Pestaña Gráficas: historia de estados y gasto por categoría."""

    def __init__(self, page: Page) -> None:
        self.page = page
        self.history_bars = page.get_by_test_id("history-bar")
        self.title = page.get_by_test_id("insights-title")
        self.range = page.get_by_test_id("insights-range")
        self.total = page.get_by_test_id("insights-total")
        self.category_names = page.get_by_test_id("insights-category-name")
        self.category_amounts = page.get_by_test_id("insights-category-amount")
        self.empty = page.get_by_test_id("insights-empty")

    def open(self) -> None:
        self.page.get_by_test_id("nav-insights").click()
