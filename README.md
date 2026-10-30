# Research Hub

Temple ResearchConnect: a research discovery site that shows the research happening across Temple University colleges, built from public records of grants (NIH, NSF, other federal agencies), clinical trials and funded publications. Built for the Temple AI Build Challenge (<https://ibit.temple.edu/aibuild/>; confirm current deadlines and requirements in the official guidelines).

## Status

| Area | State |
| --- | --- |
| Frontend (`frontend/`) | v4 redesign: Home, Explore, Search, Topics, Award, Ask, About. All real data. |
| Backend (`backend/`) | Five sources (NIH, NSF, USAspending, ClinicalTrials.gov, OpenAlex), overview, topics, search with facets, grounded assistant (Gemini). |
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
uv run python -m ingest.run            # fetch every source into data/hub.db (about 2 minutes)
uv run python -m ingest.run --offline  # reload from the cached raw JSON, no API calls
uv run uvicorn app.main:app --reload            # http://localhost:8000/health
uv run pytest
```

| Source | What | Notes |
| --- | --- | --- |
| NIH RePORTER | Grants, FY2022 onward | Department gives the college |
| NSF Award Search | Grants active since 2022 | College inferred from the directorate |
| USAspending.gov | Other federal agencies' grants (DOD, DOE, ED, NASA, ...) | Research programs only; NIH/NSF skipped as duplicates |
| ClinicalTrials.gov | Trials sponsored by Temple or run at a Temple site | Status ("Recruiting") from the registry |
| OpenAlex | Articles since 2024 with a Temple author and a reported funder | Affiliation gives the college; optional `OPENALEX_API_KEY` in `.env` |

Mapping rules live in `backend/app/colleges.py` (colleges), `backend/ingest/funders.py` (funding types, inferred from names) and `backend/app/topics.py` (topics: funder institute for grants, title keywords otherwise). People are matched across sources by first and last name.

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
- The assistant needs `GEMINI_API_KEY` in `backend/.env` (copy `backend/.env.example`).
- About 30 awards have no college (mostly NSF social-science awards whose PIs have no other awards).
- The "Cancer" and several smaller topics have no photo and use a plain tile.

## Open questions

- Which AI provider and data-handling rules will the competition organizers approve?
- What exact gap remains after testing Temple's Dimensions and other existing research tools?
- Can faculty volunteers be recruited for a short usability test or sample profile review?
- Who owns UI, data ingestion, AI integration, user research, testing and the presentation?
