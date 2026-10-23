from playwright.sync_api import Page

TYPE_LABELS = {"charge": "Cargo", "payment": "Pago", "refund": "Devolución"}


class TransactionFormPage:
    def __init__(self, page: Page) -> None:
        self.page = page
        self.amount = page.locator("#amount")
        self.description = page.locator("#description")
        self.date = page.locator("#date")
        self.months = page.locator("#months")
        self.installments_toggle = page.get_by_test_id("installments-toggle")
        self.installments_preview = page.get_by_test_id("installments-preview")
        self.save_button = page.get_by_test_id("save-transaction")

    def select_type(self, transaction_type: str) -> None:
        self.page.get_by_test_id("transaction-type").get_by_role(
            "radio", name=TYPE_LABELS[transaction_type]
        ).click()

    def fill(
        self,
        amount: str,
        description: str,
        date: str,
        transaction_type: str = "charge",
        months: int | None = None,
    ) -> None:
        self.select_type(transaction_type)
        self.amount.fill(amount)
        self.description.fill(description)
        self.date.fill(date)
        if months is not None:
            self.installments_toggle.check()
            self.months.fill(str(months))

    def save(self) -> None:
        self.save_button.click()
