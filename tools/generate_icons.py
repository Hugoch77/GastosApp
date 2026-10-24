"""Genera los íconos de la app (favicon y PWA) a partir de un solo diseño SVG.

Uso (desde la raíz del proyecto):
    .venv/Scripts/python tools/generate_icons.py

Usa el Chromium de Playwright para convertir el SVG a PNG, así no se necesita
ninguna herramienta extra. Los archivos generados se guardan en public/.
"""

from pathlib import Path

from playwright.sync_api import sync_playwright

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"

# Mismos tonos que la paleta `brand` de la app (emerald de Tailwind).
BRAND = "#059669"  # emerald-600
BRAND_LIGHT = "#a7f3d0"  # emerald-200
BRAND_DARK = "#065f46"  # emerald-800


def icon_svg(rounded: bool) -> str:
    """Tarjeta de crédito con una palomita ("pagado a tiempo") sobre fondo verde.

    - rounded=True: esquinas redondeadas y fondo transparente (favicon, ícono normal).
    - rounded=False: fondo cuadrado completo, para íconos "maskable" (Android recorta
      la forma) y el de iOS (que redondea solo). El dibujo queda dentro de la zona
      segura del 80 % central.
    """
    corner = 112 if rounded else 0
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="{corner}" fill="{BRAND}"/>
  <rect x="96" y="148" width="320" height="216" rx="32" fill="#ffffff"/>
  <rect x="96" y="196" width="320" height="44" fill="{BRAND_LIGHT}"/>
  <rect x="132" y="292" width="96" height="24" rx="12" fill="{BRAND}" opacity="0.35"/>
  <circle cx="352" cy="304" r="36" fill="{BRAND_DARK}"/>
  <path d="M335 304l12 12 22-24" fill="none" stroke="#ffffff" stroke-width="10"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""


def shortcut_svg(symbol: str) -> str:
    """Ícono de acceso directo (mantener presionado el ícono de la app en Android).

    Fondo completo porque Android lo recorta en círculo; el símbolo va al centro.
    """
    symbols = {
        # Micrófono: "Gasto por voz"
        "voice": """<rect x="206" y="112" width="100" height="176" rx="50" fill="#ffffff"/>
  <path d="M146 236a110 110 0 0 0 220 0M256 346v54" fill="none" stroke="#ffffff"
        stroke-width="32" stroke-linecap="round"/>""",
        # Más: "Nuevo movimiento"
        "new": """<path d="M256 136v240M136 256h240" fill="none" stroke="#ffffff"
        stroke-width="40" stroke-linecap="round"/>""",
    }
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="{BRAND}"/>
  {symbols[symbol]}
</svg>
"""


# (archivo, tamaño en px, ¿esquinas redondeadas?)
PNG_ICONS = [
    ("pwa-192x192.png", 192, True),
    ("pwa-512x512.png", 512, True),
    ("maskable-512x512.png", 512, False),
    ("apple-touch-icon.png", 180, False),
]

# (archivo, símbolo)
SHORTCUT_ICONS = [
    ("shortcut-voice-192x192.png", "voice"),
    ("shortcut-new-192x192.png", "new"),
]


def render_png(page, svg: str, size: int, destination: Path) -> None:
    page.set_viewport_size({"width": size, "height": size})
    page.set_content(
        f"<style>html,body{{margin:0;background:transparent}}"
        f"svg{{display:block;width:{size}px;height:{size}px}}</style>{svg}"
    )
    page.screenshot(path=destination, omit_background=True)


def main() -> None:
    (PUBLIC_DIR / "favicon.svg").write_text(icon_svg(rounded=True), encoding="utf-8")
    print("public/favicon.svg")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for file_name, size, rounded in PNG_ICONS:
            render_png(page, icon_svg(rounded), size, PUBLIC_DIR / file_name)
            print(f"public/{file_name}")
        for file_name, symbol in SHORTCUT_ICONS:
            render_png(page, shortcut_svg(symbol), 192, PUBLIC_DIR / file_name)
            print(f"public/{file_name}")
        browser.close()


if __name__ == "__main__":
    main()
