# API contract

The browser calls these endpoints at `/api/...` on the site's own origin; a rewrite in `frontend/next.config.mjs`
forwards them to the backend (`API_URL`, default `http://localhost:8000`), so CORS doesn't apply. Set
`NEXT_PUBLIC_API_URL` at build time only to call a different API host directly. In production the droplet's nginx
serves `/api/` itself, so the rewrite isn't reached; server-side rendering always uses `API_URL`.

**Single source of truth.** Response models live in `backend/app/models.py` and routes in `backend/app/main.py`.
`frontend/src/lib/types.ts` and the endpoint table below are generated from them, so don't edit either by hand.
After changing a model or route, run `uv run python -m app.contract` in `backend/` and commit the result. CI fails
when the generated files are stale. This page adds what code can't say: behaviour, rules and limits.

## Endpoints

<!-- BEGIN GENERATED: endpoints (uv run python -m app.contract) -->

| Method | Path | Parameters | Returns |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | `object` |
| `GET` | `/api/search` | `q`, `page`, `college` (repeatable), `funder` (repeatable), `verification` (repeatable), `status` (repeatable), `topic` (repeatable), `kind` (repeatable), `funding` (repeatable) | `SearchResponse` |
| `GET` | `/api/overview` | — | `Overview` |
| `GET` | `/api/topics` | — | `TopicSummary[]` |
| `GET` | `/api/topics/{topic_id}` | — | `TopicDetail` |
| `GET` | `/api/projects/featured` | — | `Project[]` |
| `GET` | `/api/projects/{project_id}` | — | `ProjectDetail` |
| `GET` | `/api/projects` | `ids` | `Project[]` |
| `GET` | `/api/researchers` | `q`, `page`, `college` (repeatable), `kind`, `sort` | `PeopleResponse` |
| `GET` | `/api/researchers/{researcher_id}` | — | `ResearcherProfile` |
| `GET` | `/api/researchers/{researcher_id}/projects` | — | `ResearcherProject[]` |
| `GET` | `/api/researchers/{researcher_id}/collaborators` | — | `ResearcherCollaborator[]` |
| `GET` | `/api/researchers/{researcher_id}/compatibility` | — | `ResearcherCompatibility` |
| `GET` | `/api/demo-profile` | — | `DemoResearcherProfile` |
| `POST` | `/api/for-you` | body: `ProfileInput` | `ForYou` |
| `POST` | `/api/match/researcher/{researcher_id}` | body: `ProfileInput` | `ResearcherMatch` |
| `POST` | `/api/match/projects` | body: `ProjectMatchRequest` | `ProjectMatches` |
| `GET` | `/api/colleges` | — | `CollegeSummary[]` |
| `GET` | `/api/colleges/{college_id}` | — | `CollegeDashboard` |
| `GET` | `/api/colleges/{college_id}/projects` | `page`, `kind` (repeatable) | `SearchResponse` |
| `POST` | `/api/assistant` | body: `AssistantRequest` | `AssistantReply` |

<!-- END GENERATED: endpoints -->

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
With `q`, results containing the words as an exact phrase come first, then those containing all of the words,
then the rest by relevance (title weighs most).

## `GET /api/projects/:id`

Returns `ProjectDetail`: abstract, `facts` (the key facts for its kind, in display order), `funders` with funding
types, `fundingByYear` (grants), `topics`, team, `relatedProjectIds`. 404 if unknown.

## `GET /api/projects?ids=a,b,c`

Returns `Project[]` for the given ids, in order. `GET /api/projects/featured` also exists, but the current frontend
doesn't use it.

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

## `GET /api/researchers`

The People directory. Returns `PeopleResponse`: researchers matching `q` (up to 200 characters), filtered by
`college` (unknown ids are ignored) and `kind`, sorted by `records` (default) or `name`, one page at a time.
`colleges` gives people per college for the current query, ignoring the college filter.

## `GET /api/researchers/:id/compatibility`

Returns active compatibility matches for a researcher. Matches include only active grants and active clinical
trials, exclude records already on the profile, and are scored deterministically from shared stored topics,
subject terms, and college links. Funder-defined topics and rarer subject-term overlap are weighted more heavily;
a college link cannot produce a match without domain evidence. The score is a discovery aid, not a recommendation;
no model call is made.
Each match includes the complete source-backed `Project` and the reasons used for its score.

## `GET /api/demo-profile`

Returns the synthetic `Maya Patel` demo profile. Her interests are fictional, but compatible records are
calculated from the current database. The response is explicitly marked `isSynthetic: true` and must not be
presented as a real Temple researcher.

## `POST /api/for-you` and matching endpoints

`ProfileInput` contains an optional college, up to 8 known topic ids and up to 12 terms (each 1–40 characters).
`/api/for-you` returns up to six recruiting trials, active grants and deterministic collaborator matches. Scores,
reasons and citations come from stored project topics, colleges, terms and team records; no model is called.
These endpoints, `/api/demo-profile` and the assistant's profile-based retrieval use one scoring function
(`_score` in `backend/app/compatibility.py`):

- Topics: up to 24 each (60 total), less when the record's topic comes only from keywords.
- Interests (`terms`) match as whole phrases ("machine learning" never matches "machine … learning"), 2 to 8 points
  each by rarity across the whole database, 1.5× for a multi-word phrase (32 total). Generic words (disease, therapy,
  learning, …) and words in more than 8% of records don't count on their own.
- A record needs a shared topic, a shared multi-word phrase or two shared interests; a college link alone never
  matches. Same college +8; for people, a different college +5. Scores under 12 are not returned.
- A person's score is their best-matching record's score, the same in `collaborators` and in
  `/api/match/researcher/:id`, and their college reason is their own college compared with the profile's.

Reasons use fixed wording that `frontend/src/lib/matchReasons.ts` parses: `Shares <topics>`, `Supported by
funder-defined topic data` / `Supported by stored keyword topic data`, `Shares stored terms: <phrases>`, `Linked to
the same college`, `Expands beyond your college`.

`POST /api/match/researcher/:id` returns that researcher's score and up to six of their records that share profile
topics or terms, or 404 for an unknown researcher. `POST /api/match/projects` accepts up to 50 project ids and returns
only positive matches; unknown ids are ignored.

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

Body: `AssistantRequest`, i.e. `{ messages: { role: "user" | "assistant", text: string }[], profile?: ProfileInput }`
(1–8 messages, each up to 4000 characters, last one from the user). Returns `AssistantReply`:
`{ mode, summary, records, people, followUps }`.

- The backend searches stored records first, including the optional profile's topics and terms. If nothing matches,
  it returns `mode: "none"` without calling the model.
- The model sees only the retrieved records. It answers in `mode: "research"` (`records`: the cited records, each a
  full `Project` from the database plus a one-line `takeaway`) or `mode: "people"` (`people`: researchers on those
  records, with their records and totals read from the database plus a short `focus`). The list for the other mode
  is empty.
- The `summary` cites records inline as `[n]`. Citations that don't point at a record or person shown are dropped,
  people who aren't on a retrieved record's team are dropped, and a summary left with no valid citation becomes a
  `mode: "none"` "couldn't answer" reply. `followUps` suggests next questions.
- `503` with `{ detail }` when the AI service is unavailable or the API key is missing or rejected. The detail is safe to show users.
- Model calls live only in `backend/app/ai.py`. `AI_PROVIDER=anthropic` is the documented default; Gemini remains supported when explicitly configured. Set `AI_TIMEOUT_SECONDS` to control the provider timeout.

The assistant has no rate limit. A public launch should add rate limiting and budget accounting
(ideally at the reverse proxy or other shared infrastructure) so the API key can't be run up.

## Data rules

- Every record carries its source, verification status and last-updated date.
- An award record is funding history, not proof that a study is active or recruiting.
- Researchers are still combined across sources by exact first and last name (pre-existing behavior). Every
  such merge is stored in `researcher_aliases` with `same-name-across-sources` evidence and the profile is
  labeled low confidence. Within one source, people with different person IDs are never merged.
