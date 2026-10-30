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

## Not yet specified

`GET /api/projects/:id`, `GET /api/researchers/:id`, collaborator matches, assistant chat.

## Data rules (from the project plan)

- Every record carries its source, verification status and last-updated date.
- An award record is funding history, not proof that a study is active.
