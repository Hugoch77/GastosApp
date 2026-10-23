from playwright.sync_api import Page


class DashboardPage:
    def __init__(self, page: Page) -> None:
        self.page = page
        self.title = page.get_by_test_id("page-title")
        self.payment_hero = page.get_by_test_id("payment-hero")
        self.payment_status = page.get_by_test_id("payment-status")
        self.no_interest_amount = page.get_by_test_id("no-interest-amount")
        self.suggested_payment_date = page.get_by_test_id("suggested-payment-date")
        self.due_date = page.get_by_test_id("due-date")
        self.next_cut = page.get_by_test_id("next-cut-value")
        self.next_cut_detail = page.get_by_test_id("next-cut-detail")
        self.current_period = page.get_by_test_id("current-period-value")
        self.total_balance = page.get_by_test_id("total-balance-value")
        self.pending_installments = page.get_by_test_id("pending-installments-value")
        self.add_transaction_button = page.get_by_test_id("add-transaction")

    def open(self) -> None:
        self.page.goto("/")

    def status(self) -> str | None:
        """Estado del semáforo: on-track, due-soon, past-suggested, overdue o paid."""
        return self.payment_status.get_attribute("data-status")
