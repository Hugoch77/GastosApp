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
        self.backup_reminder = page.get_by_test_id("backup-reminder")
        self.backup_reminder_download = page.get_by_test_id("backup-reminder-download")
        self.paid_since_cut = page.get_by_test_id("paid-since-cut")
        self.mark_paid_button = page.get_by_test_id("mark-paid")
        self.mark_paid_amount = page.locator("#mark-paid-amount")
        self.mark_paid_date = page.locator("#mark-paid-date")
        self.mark_paid_confirm = page.get_by_test_id("mark-paid-confirm")
        self.mark_paid_date_error = page.get_by_test_id("mark-paid-date-error")

    def open(self) -> None:
        self.page.goto("/")

    def status(self) -> str | None:
        """Estado del semáforo: on-track, due-soon, past-suggested, overdue o paid."""
        return self.payment_status.get_attribute("data-status")

    def mark_as_paid(self, amount: str | None = None, date: str | None = None) -> None:
        """Atajo "Ya pagué"; sin argumentos registra lo pendiente con fecha de hoy."""
        self.mark_paid_button.click()
        if amount is not None:
            self.mark_paid_amount.fill(amount)
        if date is not None:
            self.mark_paid_date.fill(date)
        self.mark_paid_confirm.click()
