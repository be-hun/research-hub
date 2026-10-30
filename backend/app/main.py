from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.db import connect, init_schema


def create_app(db_path: Path | str | None = None) -> FastAPI:
    app = FastAPI(title="Research Hub API")
    app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])

    conn = connect(db_path or config.DB_PATH)
    init_schema(conn)
    app.state.db = conn

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    return app


app = create_app()
