# Research Hub

Temple ResearchConnect: a research discovery site that shows the federally funded research happening across Temple University colleges, built from public NIH and NSF award records. Built for the Temple AI Build Challenge (<https://ibit.temple.edu/aibuild/>; confirm current deadlines and requirements in the official guidelines).

## Status

| Area | State |
| --- | --- |
| Frontend (`frontend/`) | v4 redesign: Home, Explore, Search, Topics, Award, Ask, About. All real data. |
| Backend (`backend/`) | NIH and NSF ingestion, overview, topics, search with facets, grounded assistant. |
| API contract | [docs/api.md](docs/api.md). Types: `frontend/src/lib/types.ts`. |

## Run the frontend

Start the backend first (below), then:

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000, talks to http://localhost:8000 (override with NEXT_PUBLIC_API_URL)
```

## Run the backend

```bash
cd backend
uv sync
uv run python -m ingest.run            # fetch Temple NIH (FY2022-2026) and NSF (active since 2022) awards into data/hub.db
uv run python -m ingest.run --offline  # reload from the cached raw JSON, no API calls
uv run uvicorn app.main:app --reload            # http://localhost:8000/health
uv run pytest
```

College mapping lives in `backend/app/colleges.py`. Entries marked `APPROX` have no matching `CollegeId` yet. NIH names a department; NSF names only the funding directorate, so NSF colleges are approximate. A researcher found in both sources (same first and last name) is merged into one profile.

## Pages

| Route | Page | Backed by |
| --- | --- | --- |
| `/` | Home: search, headline numbers, funding by college, top topics, newest awards | `GET /api/overview` |
| `/explore` | Overview: colleges, funding by year, topics, cross-college teams, sources | `GET /api/overview` |
| `/search` | Results with filters (status, college, funder, topic) and paging | `GET /api/search` |
| `/topics`, `/topics/[id]` | Topic index and detail | `GET /api/topics`, `/api/topics/:id` |
| `/projects/[id]` | Award: facts, funding by year, team, abstract, related awards | `GET /api/projects/:id`, `/api/projects?ids=` |
| `/ask` | Grounded assistant with numbered sources | `POST /api/assistant` |
| `/about` | Problem, audiences, sources, how it works, limits, responsible AI | `GET /api/overview` |

Retired routes (`/opportunities`, `/pathways`, `/matches`, `/researchers`, `/responsible-ai`, `/assistant`) redirect to
their replacements. Design system and images come from the Stitch project "ResearchConnect – v4 Data Redesign"; chart
colors were checked with a palette validator (lightness, chroma, colorblind separation, contrast). Photos are
AI-generated illustrations and say so in the footer.

## Backend plan

### Stack (proposed in the project planning notes, not yet decided)

| Layer | Choice | Why |
| --- | --- | --- |
| API + ingestion | Python, FastAPI | Pagination, normalization and dedup scripts live next to the API |
| Database | PostgreSQL (Supabase) | Managed, has auth options |
| Search v1 | Postgres full-text search | No separate search engine yet |
| Search v2 | pgvector | Semantic matching of differently worded research descriptions, only if v1 is not enough |
| AI | Approved model API behind one internal wrapper | Provider can be swapped without touching the app |
| Hosting | DigitalOcean App Platform | Deploys from GitHub, no server to run |

Check the Temple AI Build Challenge rules on approved AI providers and data handling before choosing the model API.

### Build order

1. **Schema and seed data.** Tables for projects, researchers, project-team links, colleges, publications, opportunities, plus a `source` and `verification` field on every record. Seed from `frontend/src/lib/mock.ts` so the existing pages work immediately.
2. **Read endpoints.** `projects/featured`, `projects/:id`, `projects?ids=`, `researchers/:id`, `opportunities`. Match the shapes in `frontend/src/lib/types.ts`.
3. **Search.** `GET /api/search` with Postgres full-text search and the college, funder and verification filters. Return `interpretedAs` and a per-result `match` (reason and evidence).
4. **One public data source.** NIH RePORTER first. Filter to Temple, normalize investigator, college and dates, dedupe, and store as `public-award-record`. Do not label imported awards as active or verified.
5. **Opportunities write path.** `POST /api/opportunities`. The server sets `id` and `verifiedByPI`.
6. **Collaborator matches.** `GET /api/researchers/:id/matches` with a score, `reasons` and `citations`. Every reason must trace to a stored record.
7. **Assistant.** `POST /api/assistant`, retrieval over stored records only. Cite sources and say so when nothing is found.
8. **Auth, then student profiles.** Replaces the hard-coded `r-rivera` in `/matches` and the "My Profile" nav link, and the inline sample data on `/pathways`.

### Data and AI rules (from the project plan)

- Every record carries its source, verification status and last-updated date. The two verification values are `faculty-confirmed` and `public-award-record`.
- An award record is funding history, not proof that a study is active or recruiting.
- AI must not invent projects, investigators or citations. Use ordinary SQL for filters, sorting and exact matching, and AI for natural-language search and comparing research interests.
- Keep the AI behind an internal wrapper, never called from the frontend.
- Use public data and synthetic profiles for the demo unless a faculty member has explicitly approved using theirs. Keep API keys and private data out of GitHub.
- Include Lewis Katz School of Medicine research when it has a documented connection to another Temple unit.

## Known gaps

- Search is keyword-based; AI interpretation of natural-language questions is not built yet.
- The assistant needs `ANTHROPIC_API_KEY` in `backend/.env`.
- About 30 awards have no college (mostly NSF social-science awards whose PIs have no other awards).
- The "Cancer" and several smaller topics have no photo and use a plain tile.

## Open questions

- Which AI provider and data-handling rules will the competition organizers approve?
- What exact gap remains after testing Temple's Dimensions and other existing research tools?
- Can faculty volunteers be recruited for a short usability test or sample profile review?
- Who owns UI, data ingestion, AI integration, user research, testing and the presentation?
