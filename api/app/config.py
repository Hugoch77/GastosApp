"""Configuración leída de variables de entorno (o de `api/.env` en desarrollo)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Las variables de entorno tienen prioridad sobre el archivo .env.
    model_config = SettingsConfigDict(env_file=API_DIR / ".env", extra="ignore")

    database_url: str
    # Orígenes que pueden llamar a la API desde el navegador, separados por comas.
    cors_origins: str = "http://localhost:5173,http://localhost:4173"
    # Una sesión sin usarse este tiempo deja de servir (hay que volver a iniciar sesión).
    session_max_idle_days: int = 180

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # database_url viene del entorno
