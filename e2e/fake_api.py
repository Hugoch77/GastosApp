"""API de sincronización falsa para E2E: intercepta las peticiones del navegador.

Aplica las mismas reglas que api/app/sync.py (gana el `updatedAt` más reciente,
una revisión por sincronización, no regresa lo que se acaba de subir). Así las
pruebas no dependen de Render ni de Neon.
"""

from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import Page, Route

# La misma dirección que DEFAULT_API_URL en src/data/syncApi.ts.
API_URL = "https://gastosapp-api-wk0x.onrender.com"
EMAIL = "yo@correo.com"
PASSWORD = "una contraseña larga"
KINDS = ("cards", "categories", "transactions")

CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST",
    "access-control-allow-headers": "authorization, content-type",
}


class FakeApi:
    def __init__(self) -> None:
        # kind → id → (registro, revisión)
        self.records: dict[str, dict[str, tuple[dict[str, Any], int]]] = {k: {} for k in KINDS}
        self.revision = 0
        self.tokens: set[str] = set()
        self.sync_requests: list[dict[str, Any]] = []

    def install(self, page: Page) -> None:
        page.route(f"{API_URL}/**", self._handle)

    # ---------- datos de "otro dispositivo" y consultas para las pruebas ----------

    def add(self, kind: str, record: dict[str, Any]) -> None:
        self.revision += 1
        self.records[kind][record["id"]] = (record, self.revision)

    def stored(self, kind: str) -> list[dict[str, Any]]:
        return [record for record, _ in self.records[kind].values()]

    def expire_sessions(self) -> None:
        self.tokens.clear()

    # ---------- rutas ----------

    def _handle(self, route: Route) -> None:
        request = route.request
        if request.method == "OPTIONS":  # verificación de CORS del navegador
            route.fulfill(status=204, headers=CORS_HEADERS)
            return

        path = urlparse(request.url).path
        body = request.post_data_json or {}
        token = (request.headers.get("authorization") or "").removeprefix("Bearer ")

        if path == "/auth/login":
            self._login(route, body)
        elif path not in ("/sync", "/auth/logout", "/auth/logout-all"):
            self._json(route, 404, {"detail": "Not Found"})
        elif token not in self.tokens:
            self._json(route, 401, {"detail": "La sesión no es válida; vuelve a iniciar sesión"})
        elif path == "/sync":
            self._json(route, 200, self._sync(body))
        else:
            if path == "/auth/logout-all":
                self.tokens.clear()
            else:
                self.tokens.discard(token)
            route.fulfill(status=204, headers=CORS_HEADERS)

    def _login(self, route: Route, body: dict[str, Any]) -> None:
        if body.get("email", "").strip().lower() != EMAIL or body.get("password") != PASSWORD:
            self._json(route, 401, {"detail": "Correo o contraseña incorrectos"})
            return
        token = f"token-{len(self.tokens) + 1}"
        self.tokens.add(token)
        self._json(route, 200, {"token": token})

    def _sync(self, body: dict[str, Any]) -> dict[str, Any]:
        self.sync_requests.append(body)
        cursor = body["cursor"]

        written: int | None = None
        for kind in KINDS:
            for record in body.get(kind, []):
                current = self.records[kind].get(record["id"])
                if current and record["updatedAt"] <= current[0]["updatedAt"]:
                    continue
                if written is None:
                    self.revision += 1
                    written = self.revision
                self.records[kind][record["id"]] = (record, written)

        response: dict[str, Any] = {}
        received = [cursor, written or 0]
        for kind in KINDS:
            response[kind] = [
                record
                for record, revision in self.records[kind].values()
                if revision > cursor and revision != written
            ]
            received += [rev for _, rev in self.records[kind].values() if rev > cursor]
        response["cursor"] = max(received)
        return response

    @staticmethod
    def _json(route: Route, status: int, body: dict[str, Any]) -> None:
        route.fulfill(status=status, json=body, headers=CORS_HEADERS)
