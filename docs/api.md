# API contract

The frontend (`frontend/src/lib/api.ts`) calls these endpoints when `NEXT_PUBLIC_API_URL` is set. Types live in
`frontend/src/lib/types.ts`. Without the env var the frontend serves mock data.

## `GET /api/search`

| Param          | Type     | Notes                                                    |
| -------------- | -------- | -------------------------------------------------------- |
| `q`            | string   | Natural-language query                                   |
| `page`         | int      | 1-based, default 1                                       |
| `college`      | repeated | `CollegeId`                                              |
| `funder`       | repeated | e.g. `NIH`, `NSF`                                        |
| `verification` | repeated | `faculty-confirmed` \| `public-award-record`             |

Returns `SearchResponse`: `{ query, interpretedAs, total, page, pageSize, results: Project[] }`.
Each result may include `match: { reason, evidence[] }` explaining why the AI matched it.

## `GET /api/projects/featured`

Returns `Project[]`: cross-college projects for the home page.

## `GET /api/projects/:id`

Returns `ProjectDetail` (abstract, methodologies, funding, team, student notice, `relatedProjectIds`). 404 if unknown.

## `GET /api/projects?ids=a,b,c`

Returns `Project[]` for the given ids, in order.

## `GET /api/researchers/:id`

Returns `ResearcherProfile`. 404 if unknown.

## `GET /api/researchers/:id/matches`

Returns `CollaboratorMatch[]`, highest score first. Each match carries `reasons` and `citations`.

## `GET /api/opportunities`

Returns `Opportunity[]`.

## `POST /api/opportunities`

Body is `NewOpportunity`. The backend sets `id` and `verifiedByPI` (from the authenticated faculty member).

## `POST /api/assistant`

Body: `{ messages: { role: "user" | "assistant", text: string }[] }` (1–20 messages, each up to 4000 characters, last one from the user).
Returns `{ reply: string, sources: { n: number, id: string, title: string, url: string }[] }`.

- The backend searches stored records first. If nothing matches, it replies "nothing found" without calling the model.
- The model sees only the retrieved records and cites them inline as `[n]`. `sources` lists each cited record; citations that don't point at a retrieved record are dropped, and an answer with no valid citation is replaced with a "couldn't answer" reply.
- `503` with `{ detail }` when the AI service is unavailable or `ANTHROPIC_API_KEY` is not set. The detail is safe to show users.
- Model calls live only in `backend/app/ai.py` (default `claude-opus-5-5`, set `AI_MODEL` / `AI_EFFORT` in `backend/.env`).

## Not yet specified

Auth, student profiles (the Pathways page uses hard-coded sample interests, areas, mentors and readiness items).

## Data rules (from the project plan)

- Every record carries its source, verification status and last-updated date.
- An award record is funding history, not proof that a study is active.
