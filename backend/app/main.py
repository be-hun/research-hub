from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from app import ai, assistant, config, explore, models, queries
from app.db import connect, init_schema


def create_app(db_path: Path | str | None = None) -> FastAPI:
    app = FastAPI(title="Research Hub API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_origin_regex=config.CORS_ORIGIN_REGEX or None,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    conn = connect(db_path or config.DB_PATH)
    init_schema(conn)
    app.state.db = conn

    def db(request: Request):
        return request.app.state.db

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    @app.get("/api/search")
    def search(
        request: Request,
        q: str = "",
        page: int = Query(1, ge=1),
        college: list[str] = Query(default=[]),
        funder: list[str] = Query(default=[]),
        verification: list[str] = Query(default=[]),
        status: list[str] = Query(default=[]),
        topic: list[str] = Query(default=[]),
    ) -> models.SearchResponse:
        return queries.search(db(request), q, page, college, funder, verification, status, topic)

    @app.get("/api/overview")
    def overview(request: Request) -> models.Overview:
        return explore.overview(db(request))

    @app.get("/api/topics")
    def topics(request: Request) -> list[models.TopicSummary]:
        return explore.overview(db(request)).topics

    @app.get("/api/topics/{topic_id}")
    def topic(request: Request, topic_id: str) -> models.TopicDetail:
        detail = explore.topic_detail(db(request), topic_id)
        if not detail:
            raise HTTPException(404, "Topic not found")
        return detail

    @app.get("/api/projects/featured")
    def featured(request: Request) -> list[models.Project]:
        return queries.featured(db(request))

    @app.get("/api/projects/{project_id}")
    def project(request: Request, project_id: str) -> models.ProjectDetail:
        detail = queries.project_detail(db(request), project_id)
        if not detail:
            raise HTTPException(404, "Project not found")
        return detail

    @app.get("/api/projects")
    def projects(request: Request, ids: str = "") -> list[models.Project]:
        return queries.projects_by_ids(db(request), [i for i in ids.split(",") if i])

    @app.get("/api/researchers/{researcher_id}")
    def researcher(request: Request, researcher_id: str) -> models.ResearcherProfile:
        profile = queries.researcher(db(request), researcher_id)
        if not profile:
            raise HTTPException(404, "Researcher not found")
        return profile

    @app.post("/api/assistant")
    def assistant_reply(request: Request, body: models.AssistantRequest) -> models.AssistantReply:
        try:
            return assistant.answer(db(request), body.messages)
        except ai.AIUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc

    return app


app = create_app()
