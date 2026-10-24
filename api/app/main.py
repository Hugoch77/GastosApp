"""Punto de entrada: `uvicorn app.main:app` (desde la carpeta api/)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import auth, sync
from app.config import get_settings

app = FastAPI(title="GastosApp API")

# La app se sirve desde otro dominio (GitHub Pages), así que el navegador pide permiso
# (CORS) antes de llamar a la API. Solo se permite a los orígenes configurados.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(sync.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Para saber si el servidor está despierto; no toca la base de datos."""
    return {"status": "ok"}
