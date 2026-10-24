"""Categorías editables: crear, renombrar y borrar."""

from playwright.sync_api import Page, expect

from pages.categories_page import CategoriesPage
from pages.flows import add_transaction, create_card
from pages.transactions_page import TransactionsPage


def test_create_rename_and_delete_category(page: Page, set_today):
    set_today("2026-10-20")
    page.goto("/")
    create_card(page)

    categories = CategoriesPage(page)
    categories.open_from_settings()
    categories.add_button.click()
    categories.fill("Mascotas", "🐶")
    categories.save_button.click()
    expect(categories.names.filter(has_text="Mascotas")).to_be_visible()

    # Las pantallas de categorías no tienen pestañas: se vuelve al panel.
    page.goto("/")
    add_transaction(
        page, amount="250", description="Croquetas", date="2026-10-19", category="Mascotas"
    )
    transactions = TransactionsPage(page)
    transactions.open()
    expect(transactions.rows.first).to_contain_text("Mascotas")

    categories.open_from_settings()
    expect(categories.rows.filter(has_text="Mascotas")).to_contain_text("1 movimiento")
    categories.open_category("Mascotas")
    categories.name.fill("Perro")
    categories.save_button.click()
    expect(categories.names.filter(has_text="Perro")).to_be_visible()

    page.goto("/")
    transactions.open()
    expect(transactions.rows.first).to_contain_text("Perro")

    categories.open_from_settings()
    categories.open_category("Perro")
    categories.delete_button.click()
    categories.delete_confirm.click()
    expect(categories.names.filter(has_text="Perro")).to_have_count(0)

    page.goto("/")
    transactions.open()
    expect(transactions.rows.first).to_contain_text("Otros")


def test_category_validation_and_protected_other(page: Page, set_today):
    set_today("2026-10-20")
    page.goto("/")
    create_card(page)

    categories = CategoriesPage(page)
    categories.open_from_settings()
    categories.add_button.click()
    categories.fill("comida", "🍕")  # ya existe "Comida"
    categories.save_button.click()
    expect(categories.error_for("category-name")).to_contain_text("Ya existe")

    page.go_back()
    categories.open_category("Otros")
    expect(categories.delete_button).to_have_count(0)
