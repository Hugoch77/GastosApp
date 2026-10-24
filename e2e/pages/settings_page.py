from pathlib import Path

from playwright.sync_api import Page


class SettingsPage:
    def __init__(self, page: Page) -> None:
        self.page = page
        self.export_button = page.get_by_test_id("export-backup")
        self.import_input = page.get_by_test_id("import-file")
        self.import_confirm = page.get_by_test_id("import-confirm")
        self.import_message = page.get_by_test_id("import-message")
        self.last_backup = page.get_by_test_id("last-backup")

    def open(self) -> None:
        self.page.get_by_test_id("nav-settings").click()

    def export_backup(self, destination: Path) -> Path:
        with self.page.expect_download() as download_info:
            self.export_button.click()
        download = download_info.value
        path = destination / download.suggested_filename
        download.save_as(path)
        return path

    def choose_backup_file(self, path: Path) -> None:
        self.import_input.set_input_files(path)
