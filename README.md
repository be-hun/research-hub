# Research Hub

Temple ResearchConnect AI: a research discovery platform for finding projects, researchers and student opportunities across Temple University colleges. Built for the Temple AI Build Challenge (<https://ibit.temple.edu/aibuild/>; confirm current deadlines and requirements in the official guidelines).

## Status

| Area | State |
| --- | --- |
| Frontend (`frontend/`) | Built. 10 routes, runs on mock data. |
| Backend (`backend/`) | Not started. This is the next piece of work. |
| API contract | Written: [docs/api.md](docs/api.md). Types: `frontend/src/lib/types.ts`. |

## Run the frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

With `NEXT_PUBLIC_API_URL` unset, the frontend serves mock data from `frontend/src/lib/mock.ts`. Set it (e.g. `http://localhost:8000`) and every call in `frontend/src/lib/api.ts` goes to the backend instead, with no other frontend change.

## Pages

| Route | Page | Backed by |
| --- | --- | --- |
| `/` | Home, featured projects | `GET /api/projects/featured` |
| `/search?q=` | Search results with "why this matched" | `GET /api/search` |
| `/projects/[id]` | Project detail | `GET /api/projects/:id`, `/api/projects?ids=` |
| `/researchers/[id]` | Researcher profile | `GET /api/researchers/:id` |
| `/matches` | Collaborator matches | `GET /api/researchers/:id/matches` |
| `/opportunities` | Student opportunities board | `GET /api/opportunities` |
| `/opportunities/new` | Faculty post form | `POST /api/opportunities` |
| `/pathways` | Student pathways | Inline sample data (no endpoint yet) |
| `/assistant` | Grounded chat | `POST /api/assistant` |
| `/responsible-ai` | Policy page | Static |

Designs come from the Stitch project "ResearchConnect AI – Concept v3" (core flow) plus "Post a Student Opportunity" from "Concept v2". CV upload is out of scope for the MVP.

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

## Known gaps in the frontend

- Only Dr. Rivera has a profile (`r-rivera`). Team and match cards link to a profile only when one exists.
- `/matches` and "My Profile" are hard-wired to `r-rivera` until there is auth.
- `/pathways` uses sample student data written into the page.
- The search page has no filter sidebar yet; it needs the backend filters first.
- Not pulled from the Stitch v2 designs: Faculty Profile Editor and Student Dashboard.
- `/opportunities/new` is not scoped to the signed-in faculty member's projects.

## Open questions

- Which AI provider and data-handling rules will the competition organizers approve?
- What exact gap remains after testing Temple's Dimensions and other existing research tools?
- Can faculty volunteers be recruited for a short usability test or sample profile review?
- Who owns UI, data ingestion, AI integration, user research, testing and the presentation?
