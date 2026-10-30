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

Body: `{ messages: { role: "user" | "assistant", text: string }[] }`. Returns `{ reply: string }`.
The reply must only use indexed records and cite sources.

## Not yet specified

Auth, student profiles (the Pathways page uses hard-coded sample interests, areas, mentors and readiness items).

## Data rules (from the project plan)

- Every record carries its source, verification status and last-updated date.
- An award record is funding history, not proof that a study is active.
