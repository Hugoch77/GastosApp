"""Utilidades para las pruebas de la API."""

from fastapi.testclient import TestClient

PASSWORD = "una contraseña larga"


def login(client: TestClient, email: str, password: str = PASSWORD, device: str = "") -> str:
    """Inicia sesión y regresa el token (exige 200)."""
    response = client.post(
        "/auth/login", json={"email": email, "password": password, "deviceName": device}
    )
    assert response.status_code == 200, response.text
    return response.json()["token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
