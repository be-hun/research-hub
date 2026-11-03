from pathlib import Path
from collections import defaultdict, deque
from time import monotonic

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from app import ai, assistant, config, dashboards, explore, models, queries, researchers
from app.colleges import COLLEGE_NAMES
from app.db import connect, init_schema


def create_app(db_path: Path | str | None = None) -> FastAPI:
    app = FastAPI(title="Research Hub API")
    assistant_requests: dict[str, deque[float]] = defaultdict(deque)
    assistant_window = 60.0
    assistant_limit = 5
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

    @app.get("/api/health")
    def api_health(request: Request) -> dict:
        request.app.state.db.execute("SELECT 1").fetchone()
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
        kind: list[str] = Query(default=[]),
        funding: list[str] = Query(default=[]),
    ) -> models.SearchResponse:
        return queries.search(db(request), q, page, college, funder, verification, status, topic, kind, funding)

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
        profile = researchers.profile(db(request), researcher_id)
        if not profile:
            raise HTTPException(404, "Researcher not found")
        return profile

    @app.get("/api/researchers/{researcher_id}/projects")
    def researcher_projects(request: Request, researcher_id: str) -> list[models.ResearcherProject]:
        rows = researchers.projects(db(request), researcher_id)
        if rows is None:
            raise HTTPException(404, "Researcher not found")
        return rows

    @app.get("/api/researchers/{researcher_id}/collaborators")
    def researcher_collaborators(request: Request, researcher_id: str) -> list[models.ResearcherCollaborator]:
        if researchers.projects(db(request), researcher_id) is None:
            raise HTTPException(404, "Researcher not found")
        return researchers.collaborators(db(request), researcher_id)

    @app.get("/api/colleges")
    def college_list(request: Request) -> list[models.CollegeSummary]:
        return dashboards.colleges(db(request))

    @app.get("/api/colleges/{college_id}")
    def college(request: Request, college_id: str) -> models.CollegeDashboard:
        detail = dashboards.dashboard(db(request), college_id)
        if not detail:
            raise HTTPException(404, "College not found")
        return detail

    @app.get("/api/colleges/{college_id}/projects")
    def college_projects(
        request: Request,
        college_id: str,
        page: int = Query(1, ge=1),
        kind: list[str] = Query(default=[]),
    ) -> models.SearchResponse:
        if college_id not in COLLEGE_NAMES:
            raise HTTPException(404, "College not found")
        return queries.search(db(request), "", page, [college_id], kinds=kind)

    @app.post("/api/assistant")
    def assistant_reply(request: Request, body: models.AssistantRequest) -> models.AssistantReply:
        client = request.client.host if request.client else "unknown"
        now = monotonic()
        recent = assistant_requests[client]
        while recent and now - recent[0] >= assistant_window:
            recent.popleft()
        if len(recent) >= assistant_limit:
            raise HTTPException(429, "The assistant is being used heavily. Try again in a minute.")
        recent.append(now)
        try:
            return assistant.answer(db(request), body.messages)
        except ai.AIUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc

    return app


app = create_app()
