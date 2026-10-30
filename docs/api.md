# API contract

The frontend (`frontend/src/lib/api.ts`) calls these endpoints at `NEXT_PUBLIC_API_URL` (default
`http://localhost:8000`). Response models live in `backend/app/models.py` and are mirrored in
`frontend/src/lib/types.ts`; a backend test fails if the two drift apart.

Counts, lists and funding totals use **parent awards only**: NIH center-grant components ("Core C", "Project 3")
stay in the database but are not counted again, because their money is part of the parent award.

## `GET /api/overview`

Returns `Overview` for the Home and Explore pages:

- `totals`: awards, active, researchers, colleges
- `sources`: per source (NIH RePORTER, NSF Award Search), award count and coverage
- `updatedAt`: date of the last successful import
- `byCollege`: awards, active and funding (obligated FY2022 onward) per college
- `trend`: per fiscal year from FY2022, funding by NIH / NSF / other; the latest year has `mayBeIncomplete: true`
- `topics`: every topic with awards, active and funding
- `recent`: the newest active awards
- `crossCollege`: awards whose investigators come from more than one college

## `GET /api/topics` and `GET /api/topics/:id`

Topics are plain-language groups of funder areas (NIH institutes, NSF divisions), defined in `backend/app/topics.py`.
`/api/topics` returns `TopicSummary[]`. `/api/topics/:id` returns `TopicDetail` (stats, the funder areas that
define it, colleges, trend, top investigators, awards, related topics). 404 if unknown.

## `GET /api/search`

| Param     | Type     | Notes                                   |
| --------- | -------- | --------------------------------------- |
| `q`       | string   | Keywords (full-text search with stemming) |
| `page`    | int      | 1-based, 10 results per page            |
| `college` | repeated | `CollegeId`                             |
| `funder`  | repeated | `NIH`, `NSF`, `CDC`, `AHRQ`             |
| `status`  | repeated | `active` \| `ended`                     |
| `topic`   | repeated | topic id                                |

Returns `SearchResponse`: `{ query, interpretedAs, total, page, pageSize, results: Project[], facets }`.
`facets` gives counts per college, funder, status and topic; each facet ignores its own filter, so the other values
stay selectable. Each result may include `match: { reason, evidence[] }` naming which stored fields matched.

## `GET /api/projects/:id`

Returns `ProjectDetail`: abstract, funding, `fundingByYear`, `topics`, team, `relatedProjectIds`. 404 if unknown.

## `GET /api/projects?ids=a,b,c`

Returns `Project[]` for the given ids, in order. `GET /api/projects/featured` and `GET /api/researchers/:id` also
exist but the current frontend does not use them.

## `POST /api/assistant`

Body: `{ messages: { role: "user" | "assistant", text: string }[] }` (1–20 messages, each up to 4000 characters, last one from the user).
Returns `{ reply: string, sources: { n: number, id: string, title: string, label: string, url: string }[] }`.

- The backend searches stored records first. If nothing matches, it replies "nothing found" without calling the model.
- The model sees only the retrieved records and cites them inline as `[n]`. `sources` lists each cited record; citations that don't point at a retrieved record are dropped, and an answer with no valid citation is replaced with a "couldn't answer" reply.
- `503` with `{ detail }` when the AI service is unavailable or `ANTHROPIC_API_KEY` is not set. The detail is safe to show users.
- Model calls live only in `backend/app/ai.py` (default `claude-opus-5-5`, set `AI_MODEL` / `AI_EFFORT` in `backend/.env`).

## Data rules

- Every record carries its source, verification status and last-updated date.
- An award record is funding history, not proof that a study is active or recruiting.
