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
| `GET` | `/api/projects/{project_id}/opportunities` | — | `Opportunity[]` |
| `GET` | `/api/projects` | `ids` | `Project[]` |
| `GET` | `/api/researchers` | `q`, `page`, `college` (repeatable), `kind`, `sort` | `PeopleResponse` |
| `GET` | `/api/researchers/{researcher_id}` | — | `ResearcherProfile` |
| `GET` | `/api/researchers/{researcher_id}/projects` | — | `ResearcherProject[]` |
| `GET` | `/api/researchers/{researcher_id}/collaborators` | — | `ResearcherCollaborator[]` |
| `GET` | `/api/researchers/{researcher_id}/compatibility` | — | `ResearcherCompatibility` |
| `GET` | `/api/researchers/{researcher_id}/opportunities` | — | `ResearcherOpportunity[]` |
| `GET` | `/api/opportunities` | `q`, `page`, `agency` (repeatable), `status` (repeatable), `category` (repeatable), `universities`, `closes_within`, `sort` | `OpportunitySearchResponse` |
| `GET` | `/api/opportunities/{opportunity_id}` | — | `OpportunityDetail` |
| `GET` | `/api/opportunities/{opportunity_id}/researchers` | — | `OpportunityResearchers` |
| `GET` | `/api/demo-profile` | — | `DemoResearcherProfile` |
| `POST` | `/api/for-you` | body: `ProfileInput` | `ForYou` |
| `POST` | `/api/for-you/people` | `page`, body: `ProfileInput` | `PeopleMatches` |
| `POST` | `/api/match/researcher/{researcher_id}` | body: `ProfileInput` | `ResearcherMatch` |
| `POST` | `/api/match/projects` | body: `ProjectMatchRequest` | `ProjectMatches` |
| `GET` | `/api/colleges` | — | `CollegeSummary[]` |
| `GET` | `/api/colleges/{college_id}` | — | `CollegeDashboard` |
| `GET` | `/api/colleges/{college_id}/projects` | `page`, `kind` (repeatable) | `SearchResponse` |
| `GET` | `/api/summaries/{kind}/{ref_id}` | — | `AISummary` |
| `POST` | `/api/assistant` | header `X-Client-Id`, body: `AssistantRequest` | `AssistantReply` |
| `GET` | `/api/conversations` | header `X-Client-Id` | `ConversationList` |
| `GET` | `/api/conversations/{conversation_id}` | header `X-Client-Id` | `Conversation` |
| `PATCH` | `/api/conversations/{conversation_id}` | header `X-Client-Id`, body: `ConversationRename` | `ConversationSummary` |
| `DELETE` | `/api/conversations/{conversation_id}` | header `X-Client-Id` | `—` |
| `POST` | `/api/intro-draft` | body: `IntroDraftRequest` | `IntroDraft` |

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
| `status`  | repeated | `active` \| `ended` \| `recruiting` (trials: Recruiting, Not yet recruiting, Enrolling by invitation) |
| `topic`   | repeated | topic id                                |
| `kind`    | repeated | `award` \| `trial` \| `publication`     |
| `funding` | repeated | funding type key, e.g. `industry`, `foundation` |

Returns `SearchResponse`: `{ query, interpretedAs, matchMode, total, page, pageSize, results: Project[], facets }`.
`facets` gives counts per college, funder, status and topic for the same records as the list; each facet ignores
its own filter, so the other values stay selectable. `facets.status` adds a `recruiting` value when any result is a
trial taking participants.

With `q`, a result must contain the words as a phrase or all of the words (stemmed, in the title, abstract, people
or subject terms). Exact-phrase records come first, then the rest by relevance (title weighs most). Only when no
record has every word does the search fall back to records with any of them. `matchMode` says which happened:

- `phrase`: the top results contain the exact phrase (two or more words);
- `all`: the results contain every word (always the case for a one-word query);
- `any`: no record had all the words together, so the results have any of them;
- `browse`: no query; results are ordered grants first, active first, newest first.

A query with `"quoted phrases"` or `-excluded` words is read with Postgres `websearch_to_tsquery` (same fallback,
which ignores the exclusions).

Each result may include `match: { reason, evidence[], snippet }`. `reason` and `evidence` name which stored fields
matched. `snippet` is about 30 words of the abstract around the matched words, each matched word wrapped in `⟦` and
`⟧` (prefixed or followed by `…` when cut), or null when the abstract has no query word or the record's only text
is its title.

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

Each word of `q` must start a word of the person's name or department, in any order: "Grace Ma" and "ma grace" find
"Grace X. Ma", and "ma" doesn't find "Thomas". With `q` and the default sort, the exact name comes first, then the
most similar name, then most records. When the backend's Postgres has `pg_trgm` (installed at startup when allowed)
and no name matches every word, names similar to `q` match instead, so a typo like "Grace Mah" still finds her.

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
- `band` puts a score in words: `Strong overlap` (40 or more), `Good overlap` (24 or more), `Some overlap` (12 or
  more). The number is a capped sum of evidence, not a percentage, so show the band rather than "N/100". The cutoffs
  are `STRONG_OVERLAP` and `GOOD_OVERLAP` in `compatibility.py`, with the score spread they came from.

**One people ranking.** `rank_people` ranks everyone once per profile and data version, and every surface reads it:
`ForYou.collaborators` is its first six, `ForYou.collaboratorTotal` its length, `POST /api/for-you/people?page=N`
returns it 20 at a time (`PeopleMatches`), and `POST /api/match/researcher/:id` returns the person's `score`,
`band` and `rank` from it, with `total` = the ranking's length. So a person shows the same score, band and rank
everywhere.

- Eligible records: an active grant or trial, any publication (imported from 2024 on), or a grant that ended in the
  last two calendar years (parent records only). A person is ranked when at least one eligible record scores 12 or
  more; their score is their best eligible record's score, and their college reason compares their own college with
  the profile's.
- Order: score, then how many of their records match, then their latest year, then researcher id. A name never
  breaks a tie.
- `ResearcherMatch.eligible` is `false` when none of the person's records is eligible; then `score` is 0, `band` and
  `rank` are `null` and `records` is empty, and the page says they aren't in your matches rather than showing a
  number. An eligible person whose records don't match gets the same zeros with `eligible: true`.

Reasons use fixed wording that `frontend/src/lib/matchReasons.ts` parses: `Shares <topics>`, `Supported by
funder-defined topic data` / `Supported by stored keyword topic data`, `Shares stored terms: <phrases>`, `Linked to
the same college`, `Expands beyond your college`.

`POST /api/match/researcher/:id` returns that researcher's place in the ranking and up to six of their eligible
records that share profile topics or terms, best first, or 404 for an unknown researcher. `POST /api/match/projects` accepts up to 50 project ids and returns
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

## `GET /api/summaries/:kind/:id`

`kind` is `project`, `researcher`, `topic` or `college`. Returns `AISummary`: two or three sentences and up to three
key points written by the configured model (`AI_PROVIDER` / `AI_MODEL`) from the stored records behind that page.
The backend picks the records with SQL (the record itself; a researcher's or a topic's or college's twelve most
recent, active first), numbers them, and keeps only `[n]` citations that point at them; a reply without a valid
citation comes back as `available: false`. `citations` lists every record sent, numbered as in the text. Summaries
are cached in the `ai_summaries` table until the summarized records, the prompt or the model change. A model error
returns `available: false` with a `message` (not cached). 404 for an unknown id, 422 for an unknown kind.

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
- Team mode. A question that asks for a team or collaborators ("build me a team for...", "who should I team up
  with on...", "collaborate", "co-investigator", "partner") is searched more broadly: the whole topic, each part of
  it split on words like "in", "and" and "with" ("AI in cardiology" also searches "ai" and "cardiology"), and the
  top records from colleges those searches found but the mix doesn't cover yet, up to 14 records. The model also
  gets the people on those records grouped by their college (from the database). It answers in `mode: "team"`
  (the model may also choose it): `people` holds 2–5 `AssistantPerson`s, where `focus` is the model's line on what
  that person brings to the team and everything else is read from the database, as in people mode. The backend
  spreads the model's picks across colleges, taking one person per college in turn (best first) before a second
  person from the same college, and shows them in the model's order. If fewer than two named people are on the
  retrieved records, the answer falls back to people or research mode. `records` is empty.
- The `summary` cites records inline as `[n]`. Citations that don't point at a record or person shown are dropped,
  people who aren't on a retrieved record's team are dropped, and a summary left with no valid citation becomes a
  `mode: "none"` "couldn't answer" reply. `followUps` suggests next questions.
- `503` with `{ detail }` when the AI service is unavailable or the API key is missing or rejected. The detail is safe to show users.
- Model calls live only in `backend/app/ai.py`. `AI_PROVIDER=anthropic` is the documented default; Gemini remains supported when explicitly configured. Set `AI_TIMEOUT_SECONDS` to control the provider timeout.

The assistant has no rate limit. A public launch should add rate limiting and budget accounting
(ideally at the reverse proxy or other shared infrastructure) so the API key can't be run up.

## Saved conversations

Ask keeps a history like a normal chatbot: a list of past conversations that can be reopened, renamed and deleted.

- **Owner.** Every conversation endpoint requires an `X-Client-Id` header of 8–64 characters from `[A-Za-z0-9-]`;
  a missing or malformed one is `400`. The frontend sends `demo-maya` when signed in to the demo, otherwise a random
  UUID it keeps in `localStorage`. This is demo-grade identity, not authentication: anyone who knows an id can read
  its conversations. Every query filters by it, and another owner's conversation is `404`.
- **Saving happens in `POST /api/assistant`.** With an `X-Client-Id` header, each answer (including `mode: "none"`
  "nothing found" answers, but not `4xx`/`5xx` errors) is saved as two messages: the request's last user message and
  the reply. Without `conversationId` a new conversation is started, titled with that question cut to 80 characters
  at a word boundary; with one, the turn is appended (another owner's id is `404`, checked before the model is
  called) and `updatedAt` moves. The reply's `conversationId` is the conversation it went into. Without the header
  nothing is saved and `conversationId` is `null`; a malformed header is `400`. A failed save is logged and the answer
  is still returned, with `conversationId: null`.
- The assistant message's `text` is the reply's `summary`, and `reply` is the full `AssistantReply` as returned, so a
  reopened conversation shows the same cards. A stored reply that no longer fits the current contract comes back as
  `reply: null` (the text still shows).
- `GET /api/conversations` returns `ConversationList`: the owner's newest 50 by `updatedAt`, each with its
  `messageCount`.
- `GET /api/conversations/:id` returns `Conversation` with its `messages` in order.
- `PATCH /api/conversations/:id` with `ConversationRename { title }` (trimmed, 1–120 characters, else `422`) returns
  the `ConversationSummary`. Renaming doesn't change `updatedAt`.
- `DELETE /api/conversations/:id` returns `204` and deletes its messages too.
- The tables (`backend/app/conversations.sql`) are created at startup and are not part of `schema.sql`, so a schema
  rebuild or an import doesn't erase them.

## `POST /api/intro-draft`

Body: `IntroDraftRequest`, i.e. `{ researcherId: string, profile: ProfileInput, senderName?: string }`. Returns
`IntroDraft`: a short intro email (`subject` plus a plain-text `body` of about 120 words) from the profile's owner to
that researcher, used by the "Draft an intro" button on Ask's person cards and the researcher page (demo account).

- The records are the researcher's best eligible records that match the profile (up to four), taken from the same
  people ranking as `POST /api/match/researcher/:id`. `sharedTopics` and `band` come from that ranking too.
- If the researcher isn't in the ranking (no active or recent record shares the profile's topics or keywords), the
  model isn't called: `available: false` with a `message` saying there isn't enough overlap.
- The model sees only those numbered records and the profile, which it is told are interests, not the sender's own
  work. It may also answer that the overlap is too thin (`available: false`). A draft that cites no record it was
  given is rejected the same way. `[n]` markers are stripped from the body.
- `citations` lists the records the email mentions (all records considered when `available` is false), with ids and
  titles read from the database. Each call writes a fresh draft; nothing is cached or stored.
- 404 for an unknown researcher, 422 for an invalid profile, 503 with `{ detail }` when the AI service is unavailable.

## Funding opportunities (`/api/opportunities`)

Federal funding calls (RFPs, notices of funding opportunity) from the Grants.gov API, refreshed by
`ingest.run`. A call is an invitation to apply, not an award, and its dates can change: every call links to its
Grants.gov page and carries `updatedAt`, the time it was fetched.

- `GET /api/opportunities` returns `OpportunitySearchResponse`. `q` matches title, description, call number and
  agency. Filters: `agency`, `status` (`posted`, `forecasted`, `closed`; none given means posted and forecasted),
  `category`, `universities=true` (calls listing applicant type 06 or 20, higher education) and `closes_within`
  (days). `sort` is `deadline` (default: soonest first, calls without a date last), `relevance` or `newest`.
  `facets` count the current query and other filters, ignoring each facet's own filter.
  - `q` is read by Postgres `websearch_to_tsquery` ("quoted phrases", `-excluded` words). A `q` equal to a call
    number (`RFA-CA-27-019`) or an agency label (`NSF`), ignoring case, also matches; under `relevance` an exact
    call number ranks first, then `ts_rank` (title above description above number, agency and categories).
    `relevance` without `q` is deadline order. `newest` is `postedDate` descending, ties by title.
  - A posted call whose `closeDate` is before today, or a forecasted call whose estimated `closeDate` is, is treated
    as `closed` everywhere: it is hidden unless
    `status=closed` is asked for, counted under `closed` in `facets.status`, and returned with `status: "closed"`.
    `daysLeft` and every comparison with today use the database's `current_date`.
  - `category` keeps calls listing any of the given categories; `closes_within=N` keeps calls whose `closeDate` is
    today through N days from today (calls without a date drop out).
  - Status facet labels: `posted` "Open", `forecasted` "Forecasted", `closed` "Closed". Agency and category facets
    are labelled with their value.
- `GET /api/opportunities/:id` returns `OpportunityDetail`: the synopsis and eligibility text verbatim, applicant
  types, award range, contact, and `pastAwards`, Temple awards under the same assistance listing (ALN) numbers.
  `description` is the stored synopsis split at blank lines. `pastAwardCount` and `pastAwards` count parent awards
  only (an NIH center-grant component is part of its parent), newest fiscal year first, at most 10. 404 if unknown.
- `GET /api/opportunities/:id/researchers` returns `OpportunityResearchers`: Temple researchers whose stored records
  overlap the call, scored deterministically (no model call) and shown with `notice`. Overlap is a discovery aid,
  not a recommendation or an eligibility check.
- `GET /api/researchers/:id/opportunities` returns open calls that overlap a researcher's records, at most 8.
- `GET /api/projects/:id/opportunities` returns open calls sharing an assistance listing with that award: posted
  or forecasted with no passed deadline, soonest first, at most 6. A center-grant component also uses its parent
  award's listings. 404 if the project is unknown.

`universitiesEligible` comes from Grants.gov's applicant-type codes. The site never decides eligibility; the
agency's own `eligibilityText` is shown as written.

## Data rules

- Every record carries its source, verification status and last-updated date.
- An award record is funding history, not proof that a study is active or recruiting.
- Researchers are still combined across sources by exact first and last name (pre-existing behavior). Every
  such merge is stored in `researcher_aliases` with `same-name-across-sources` evidence and the profile is
  labeled low confidence. Within one source, people with different person IDs are never merged.
