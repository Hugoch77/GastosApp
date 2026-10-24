from playwright.sync_api import Locator, Page


class CategoriesPage:
    """Lista /categorias y formulario de categoría."""

    def __init__(self, page: Page) -> None:
        self.page = page
        self.rows = page.get_by_test_id("category-row")
        self.names = page.get_by_test_id("category-name")
        self.add_button = page.get_by_test_id("add-category")
        self.name = page.locator("#category-name")
        self.icon = page.locator("#category-icon")
        self.icon_options = page.get_by_test_id("icon-option")
        self.save_button = page.get_by_test_id("save-category")
        self.delete_button = page.get_by_test_id("delete-category")
        self.delete_confirm = page.get_by_test_id("delete-category-confirm")

    def open_from_settings(self) -> None:
        self.page.get_by_test_id("nav-settings").click()
        self.page.get_by_test_id("manage-categories").click()

    def open_category(self, name: str) -> None:
        self.rows.filter(has_text=name).click()

    def fill(self, name: str, icon: str) -> None:
        self.name.fill(name)
        self.icon.fill(icon)

    def error_for(self, field_id: str) -> Locator:
        return self.page.get_by_test_id(f"{field_id}-error")
