# API contract

The frontend (`frontend/src/lib/api.ts`) calls these endpoints at `NEXT_PUBLIC_API_URL` (default
`http://localhost:8000`). Response models live in `backend/app/models.py` and are mirrored in
`frontend/src/lib/types.ts`; a backend test fails if the two drift apart.

Every record has a `kind`: `award` (grant), `trial` (clinical trial) or `publication`, a `statusLabel` in the
source's own words, and `fundingTypes` (federal, industry, foundations & nonprofits, Temple, other universities &
hospitals, state & international government, other), inferred from funder names.

Counts, lists and funding totals use **parent awards only**: NIH center-grant components ("Core C", "Project 3")
stay in the database but are not counted again, because their money is part of the parent award.

## `GET /api/overview`

Returns `Overview` for the Home and Explore pages:

- `totals`: grants (awards, active), trials (and recruiting), publications, researchers, colleges
- `fundingTypes`: records per funding type, split by kind; `federalByAgency`: grant money per agency
- `sources`: per source (NIH RePORTER, NSF Award Search, USAspending.gov, ClinicalTrials.gov, OpenAlex), record count, kind and coverage
- `updatedAt`: date of the last successful import
- `byCollege`: awards, active and funding (obligated FY2022 onward) per college
- `trend`: per fiscal year from FY2022, funding by NIH / NSF / other; the latest year has `mayBeIncomplete: true`
- `topics`: every topic with awards, active and funding
- `recent`: the newest active grants; `recruiting`: trials recruiting now; `publications`: newest papers
- `crossCollege`: awards whose investigators come from more than one college

## `GET /api/topics` and `GET /api/topics/:id`

Topics are plain-language groups of funder areas (NIH institutes, NSF divisions), defined in `backend/app/topics.py`.
Grants join a topic through their funding institute; trials, papers and other federal grants through title keywords.
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
| `kind`    | repeated | `award` \| `trial` \| `publication`     |
| `funding` | repeated | funding type key, e.g. `industry`, `foundation` |

Returns `SearchResponse`: `{ query, interpretedAs, total, page, pageSize, results: Project[], facets }`.
`facets` gives counts per college, funder, status and topic; each facet ignores its own filter, so the other values
stay selectable. Each result may include `match: { reason, evidence[] }` naming which stored fields matched.

## `GET /api/projects/:id`

Returns `ProjectDetail`: abstract, `facts` (the key facts for its kind, in display order), `funders` with funding
types, `fundingByYear` (grants), `topics`, team, `relatedProjectIds`. 404 if unknown.

## `GET /api/projects?ids=a,b,c`

Returns `Project[]` for the given ids, in order. `GET /api/projects/featured` and `GET /api/researchers/:id` also
exist but the current frontend does not use them.

## `GET /api/researchers/:id`

Returns `ResearcherProfile`, or `404` when the id is unknown **or no stored record lists the person**.

- `counts`: grants, trials and publications the person is listed on (SQL `COUNT(DISTINCT)`). Unlike site-wide
  totals these include NIH center-grant components the person is on, since those are their own records.
- `projects`: every record, newest start year first, each with the person's `role` and a source link
- `collaborators`: people named on the same records, with the shared `projectIds` behind each link and a
  `crossCollege` flag
- `identityConfidence` and `identityNote`: `high` = one source identity with that source's person ID; `medium` =
  matched by name within one source; `low` = identities from several sources combined by name alone
- `aliases`: every source identity folded into the profile, with its evidence (`researcher_aliases` table)
- `roles` are the roles sources list (Contact PI, Author...). There is no job title: nothing says "faculty".
- `summary` is a template over the counts; no model is involved.

`GET /api/researchers/:id/projects` and `GET /api/researchers/:id/collaborators` return just those lists.

## `GET /api/colleges` and `GET /api/colleges/:id`

`/api/colleges` lists every college (including ones with no records) as `CollegeSummary`, in a fixed order, never
ranked by money. Totals use the same rules as `Overview.byCollege`, and a test keeps them equal.

`/api/colleges/:id` returns `CollegeDashboard` (`404` for an unknown college id; a known college with no records
returns zeros): `fundingYears` (the fiscal-year range behind `funding` and `trend`), `trend`, `topics`,
`researchers` (most records first), `partners` and `crossCollege` (grants with investigators from this college and
another), `recent`, per-source `sources` with coverage, and `unassignedRecords` (records Temple-wide with no
college, which appear on no college page). Every figure is a SQL aggregate.

`GET /api/colleges/:id/projects?page=&kind=` is `/api/search` filtered to the college.

## `GET /api/health`

Returns `{"ok": true}` after the API can query its database. Reverse proxies should use this endpoint
for readiness checks.

## `POST /api/assistant`

Body: `{ messages: { role: "user" | "assistant", text: string }[] }` (1–8 messages, each up to 4000 characters, last one from the user).
Returns `{ reply: string, sources: { n: number, id: string, title: string, label: string, url: string }[] }`.

- The backend searches stored records first. If nothing matches, it replies "nothing found" without calling the model.
- The model sees only the retrieved records and cites them inline as `[n]`. `sources` lists each cited record; citations that don't point at a retrieved record are dropped, and an answer with no valid citation is replaced with a "couldn't answer" reply.
- `503` with `{ detail }` when the AI service is unavailable or the API key is missing or rejected. The detail is safe to show users.
- `429` when the per-client limit is exceeded (five requests per minute).
- Model calls live only in `backend/app/ai.py`. `AI_PROVIDER=anthropic` is the documented default; Gemini remains supported when explicitly configured. Set `AI_TIMEOUT_SECONDS` to control the provider timeout.

The assistant limiter is intentionally in-process for the small Demo Day deployment. A multi-instance or
public launch must move rate limiting and budget accounting to shared infrastructure.

## Data rules

- Every record carries its source, verification status and last-updated date.
- An award record is funding history, not proof that a study is active or recruiting.
- Researchers are still combined across sources by exact first and last name (pre-existing behavior). Every
  such merge is stored in `researcher_aliases` with `same-name-across-sources` evidence and the profile is
  labeled low confidence. Within one source, people with different person IDs are never merged.
