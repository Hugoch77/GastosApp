from playwright.sync_api import Locator, Page


class CardFormPage:
    """Formulario de tarjeta (también es la pantalla de bienvenida sin tarjetas)."""

    def __init__(self, page: Page) -> None:
        self.page = page
        self.title = page.get_by_test_id("page-title")
        self.name = page.locator("#card-name")
        self.cut_day = page.locator("#cut-day")
        self.due_day = page.locator("#due-day")
        self.buffer_days = page.locator("#buffer")
        self.preview_cut_date = page.get_by_test_id("preview-cut-date")
        self.preview_due_date = page.get_by_test_id("preview-due-date")
        self.preview_suggested_date = page.get_by_test_id("preview-suggested-date")
        self.grace_warning = page.get_by_test_id("grace-warning")
        self.save_button = page.get_by_test_id("save-card")

    def fill(self, name: str, cut_day: int, due_day: int, buffer_days: int | None = None) -> None:
        self.name.fill(name)
        self.cut_day.select_option(str(cut_day))
        self.due_day.select_option(str(due_day))
        if buffer_days is not None:
            self.buffer_days.fill(str(buffer_days))

    def save(self) -> None:
        self.save_button.click()

    def error_for(self, field_id: str) -> Locator:
        return self.page.get_by_test_id(f"{field_id}-error")
