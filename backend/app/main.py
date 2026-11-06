import logging
import threading
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app import (ai, assistant, compatibility, config, conversations, dashboards, explore, intro, models, queries,
                 researchers, summaries)
from app.colleges import COLLEGE_NAMES
from app.db import Connection, Pool, connect, ensure_conversation_tables, ensure_search_extensions, init_schema

log = logging.getLogger(__name__)

def create_app(database_url: str | None = None, *, connect_db: bool = True) -> FastAPI:
    """connect_db=False builds the routes without touching a database (the contract generator only reads them)."""
    app = FastAPI(title="Research Hub API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_origin_regex=config.CORS_ORIGIN_REGEX or None,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["*"],
    )

    url = database_url or config.DATABASE_URL
    if connect_db:
        conn = connect(url)
        init_schema(conn)
        ensure_search_extensions(conn)
        ensure_conversation_tables(conn)
        summaries.ensure_table(conn)
        app.state.db = conn  # for setup and tests; requests use the pool
    # Sync endpoints run on a thread pool. Each request borrows one connection and returns it when done, so a
    # process never holds more than DB_POOL_SIZE connections to Supabase however many threads are busy.
    app.state.pool = pool = Pool(url, config.DB_POOL_SIZE)

    def db():
        with pool.connection() as c:
            yield c

    DB = Annotated[Connection, Depends(db)]

    def maybe_owner(x_client_id: Annotated[str | None, Header()] = None) -> str | None:
        """The X-Client-Id header that owns saved conversations: 8-64 letters, digits or hyphens."""
        if x_client_id is not None and not conversations.valid_client_id(x_client_id):
            raise HTTPException(400, "X-Client-Id must be 8-64 letters, digits or hyphens")
        return x_client_id

    def owner(client_id: Annotated[str | None, Depends(maybe_owner)]) -> str:
        if client_id is None:
            raise HTTPException(400, "X-Client-Id header is required")
        return client_id

    Owner = Annotated[str, Depends(owner)]

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    @app.get("/api/health")
    def api_health(conn: DB) -> dict:
        conn.execute("SELECT 1").fetchone()
        return {"ok": True}

    @app.get("/api/search")
    def search(
        conn: DB,
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
        return queries.search(conn, q, page, college, funder, verification, status, topic, kind, funding)

    @app.get("/api/overview")
    def overview(conn: DB) -> models.Overview:
        return explore.overview(conn)

    @app.get("/api/topics")
    def topics(conn: DB) -> list[models.TopicSummary]:
        return explore.overview(conn).topics

    @app.get("/api/topics/{topic_id}")
    def topic(conn: DB, topic_id: str) -> models.TopicDetail:
        detail = explore.topic_detail(conn, topic_id)
        if not detail:
            raise HTTPException(404, "Topic not found")
        return detail

    @app.get("/api/projects/featured")
    def featured(conn: DB) -> list[models.Project]:
        return queries.featured(conn)

    @app.get("/api/projects/{project_id}")
    def project(conn: DB, project_id: str) -> models.ProjectDetail:
        detail = queries.project_detail(conn, project_id)
        if not detail:
            raise HTTPException(404, "Project not found")
        return detail

    @app.get("/api/projects")
    def projects(conn: DB, ids: str = "") -> list[models.Project]:
        return queries.projects_by_ids(conn, [i for i in ids.split(",") if i])

    @app.get("/api/researchers")
    def people(
        conn: DB,
        q: str = Query("", max_length=200),
        page: int = Query(1, ge=1),
        college: list[str] = Query(default=[]),
        kind: str | None = None,
        sort: str = "records",
    ) -> models.PeopleResponse:
        return researchers.directory(conn, q, [c for c in college if c in COLLEGE_NAMES], kind, sort, page)

    @app.get("/api/researchers/{researcher_id}")
    def researcher(conn: DB, researcher_id: str) -> models.ResearcherProfile:
        profile = researchers.profile(conn, researcher_id)
        if not profile:
            raise HTTPException(404, "Researcher not found")
        return profile

    @app.get("/api/researchers/{researcher_id}/projects")
    def researcher_projects(conn: DB, researcher_id: str) -> list[models.ResearcherProject]:
        rows = researchers.projects(conn, researcher_id)
        if rows is None:
            raise HTTPException(404, "Researcher not found")
        return rows

    @app.get("/api/researchers/{researcher_id}/collaborators")
    def researcher_collaborators(conn: DB, researcher_id: str) -> list[models.ResearcherCollaborator]:
        if researchers.projects(conn, researcher_id) is None:
            raise HTTPException(404, "Researcher not found")
        return researchers.collaborators(conn, researcher_id)

    @app.get("/api/researchers/{researcher_id}/compatibility")
    def researcher_compatibility(conn: DB, researcher_id: str) -> models.ResearcherCompatibility:
        result = compatibility.for_researcher(conn, researcher_id)
        if not result:
            raise HTTPException(404, "Researcher not found")
        return result

    @app.get("/api/demo-profile")
    def demo_profile(conn: DB) -> models.DemoResearcherProfile:
        return compatibility.demo_profile(conn)

    @app.post("/api/for-you")
    def for_you(conn: DB, profile: models.ProfileInput) -> models.ForYou:
        return compatibility.for_you(conn, profile)

    @app.post("/api/for-you/people")
    def for_you_people(
        conn: DB, profile: models.ProfileInput, page: int = Query(1, ge=1)
    ) -> models.PeopleMatches:
        return compatibility.people_matches(conn, profile, page)

    @app.post("/api/match/researcher/{researcher_id}")
    def match_researcher(
        conn: DB, researcher_id: str, profile: models.ProfileInput
    ) -> models.ResearcherMatch:
        result = compatibility.match_researcher(conn, researcher_id, profile)
        if result is None:
            raise HTTPException(404, "Researcher not found")
        return result

    @app.post("/api/match/projects")
    def match_projects(conn: DB, body: models.ProjectMatchRequest) -> models.ProjectMatches:
        return compatibility.match_projects(conn, body.profile, body.ids)

    @app.get("/api/colleges")
    def college_list(conn: DB) -> list[models.CollegeSummary]:
        return dashboards.colleges(conn)

    @app.get("/api/colleges/{college_id}")
    def college(conn: DB, college_id: str) -> models.CollegeDashboard:
        detail = dashboards.dashboard(conn, college_id)
        if not detail:
            raise HTTPException(404, "College not found")
        return detail

    @app.get("/api/colleges/{college_id}/projects")
    def college_projects(
        conn: DB,
        college_id: str,
        page: int = Query(1, ge=1),
        kind: list[str] = Query(default=[]),
    ) -> models.SearchResponse:
        if college_id not in COLLEGE_NAMES:
            raise HTTPException(404, "College not found")
        return queries.search(conn, "", page, [college_id], kinds=kind)

    @app.get("/api/summaries/{kind}/{ref_id}")
    def summary(kind: models.SummaryKind, ref_id: str) -> models.AISummary:
        # The model call must not occupy one of the small request-pool connections.
        result = summaries.summarize_pooled(app.state.pool, kind, ref_id)
        if result is None:
            raise HTTPException(404, "Nothing to summarize with that id")
        return result

    def answer(body: models.AssistantRequest) -> models.AssistantReply:
        try:
            with app.state.pool.connection() as conn:
                prepared = assistant.prepare(conn, body.messages, body.profile)
            if not prepared.records:
                return assistant._none(assistant.NOTHING_FOUND, assistant.TRY_INSTEAD)
            result = ai.grounded_answer(assistant.SYSTEM, prepared.api_messages)
            with app.state.pool.connection() as conn:
                return assistant.finish(conn, prepared, result, body.profile)
        except ai.AIUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc

    @app.post("/api/assistant")
    def assistant_reply(
        body: models.AssistantRequest, client_id: Annotated[str | None, Depends(maybe_owner)]
    ) -> models.AssistantReply:
        if client_id and body.conversationId:
            with app.state.pool.connection() as conn:
                if not conversations.exists(conn, client_id, body.conversationId):
                    raise HTTPException(404, "Conversation not found")
        reply = answer(body)
        if client_id:
            # Saving must never cost the user the answer: on failure, log it and return the answer unsaved.
            question = body.messages[-1].text
            try:
                with app.state.pool.connection() as conn:
                    reply.conversationId = conversations.save_turn(conn, client_id, body.conversationId, question,
                                                                   reply)
            except Exception:  # noqa: BLE001
                log.exception("could not save the Ask conversation")
                reply.conversationId = None
        return reply

    @app.get("/api/conversations")
    def conversation_list(conn: DB, client_id: Owner) -> models.ConversationList:
        return conversations.list_for(conn, client_id)

    @app.get("/api/conversations/{conversation_id}")
    def conversation(conn: DB, client_id: Owner, conversation_id: str) -> models.Conversation:
        found = conversations.get(conn, client_id, conversation_id)
        if found is None:
            raise HTTPException(404, "Conversation not found")
        return found

    @app.patch("/api/conversations/{conversation_id}")
    def conversation_rename(
        conn: DB, client_id: Owner, conversation_id: str, body: models.ConversationRename
    ) -> models.ConversationSummary:
        renamed = conversations.rename(conn, client_id, conversation_id, body.title)
        if renamed is None:
            raise HTTPException(404, "Conversation not found")
        return renamed

    @app.delete("/api/conversations/{conversation_id}", status_code=204)
    def conversation_delete(conn: DB, client_id: Owner, conversation_id: str) -> None:
        if not conversations.delete(conn, client_id, conversation_id):
            raise HTTPException(404, "Conversation not found")

    @app.post("/api/intro-draft")
    def intro_draft(body: models.IntroDraftRequest) -> models.IntroDraft:
        # Like the assistant: read the records, release the connection, then call the model.
        with app.state.pool.connection() as conn:
            prepared = intro.prepare(conn, body)
        if prepared is None:
            raise HTTPException(404, "Researcher not found")
        if isinstance(prepared, models.IntroDraft):
            return prepared  # not enough overlap: no model call
        try:
            return intro.finish(prepared, ai.grounded_intro(intro.SYSTEM, prepared.content))
        except ai.AIUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc

    return app


def _warm(app: FastAPI) -> None:
    """Build the matching corpus in the background so the first visitor after a deploy doesn't wait for it."""
    try:
        with app.state.pool.connection() as conn:
            compatibility.corpus(conn)
    except Exception:  # noqa: BLE001  the first request builds it instead
        pass


def __getattr__(name: str):
    """`uvicorn app.main:app` builds the app on first access, so importing create_app never opens a connection."""
    if name == "app":
        globals()["app"] = created = create_app()
        threading.Thread(target=_warm, args=(created,), daemon=True).start()
        return created
    raise AttributeError(name)
