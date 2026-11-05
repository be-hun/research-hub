# Working on Research Hub (humans, Claude Code and GitHub Copilot)

This file is the single source of rules for every coding agent in this repo. `CLAUDE.md` and
`.github/copilot-instructions.md` only point here, so change the rules in this file and nowhere else.
Project overview, setup commands and data sources are in [README.md](README.md); the API contract is in
[docs/api.md](docs/api.md); deploying is in [docs/deploy.md](docs/deploy.md).

## One source of truth

| What | Source of truth | Derived from it |
| --- | --- | --- |
| Code | `main` on GitHub | every worktree, the MVP server |
| API contract | `backend/app/models.py` + routes in `backend/app/main.py` | `frontend/src/lib/types.ts`, the endpoint table in `docs/api.md` (generated) |
| Agent rules | this file | `CLAUDE.md`, `.github/copilot-instructions.md` (pointers only) |
| Data | the ingest scripts in `backend/ingest/` | the Postgres database at `DATABASE_URL` (Supabase in production; rebuildable) |

Nothing is copied between agents through chat or untracked files, and nothing is edited on the server.

## Branches: one agent, one branch, one folder

Two agents editing the same checkout overwrite each other's work. Each agent gets its own branch **and** its own
working folder (a git worktree), and work comes back together through pull requests.

| Branch | Who | Purpose |
| --- | --- | --- |
| `main` | nobody directly | The only long-lived branch. Every PR targets it; the server deploys from it. |
| `copilot/<short-topic>` | GitHub Copilot | One branch per feature or fix. |
| `claude/<short-topic>` | Claude Code | One branch per feature or fix. |
| `<name>/<short-topic>` | a person | Same rules. |

Start a task in its own worktree (folder names are a convention, not a requirement):

```bash
cd ~/Desktop/research-hub
git fetch origin
git worktree add -b claude/my-topic ../research-hub-claude origin/main    # Claude Code
git worktree add -b copilot/my-topic ../research-hub-copilot origin/main  # Copilot
```

Rules:

- Before starting, run `git fetch` and branch from the latest `origin/main`.
- Don't commit to `main` directly, and don't push to another agent's branch.
- Don't switch branches or run `git reset`/`git stash` in a folder another agent is working in.
- Keep PRs small and single-purpose. Rebase on `origin/main` before asking for review.
- Before taking on a task, check open PRs (`gh pr list`) so two agents don't build the same thing.
- If your change touches a file another open PR also changes, say so in the PR description.

## Frontend/backend handoff

For the current feature cycle, Claude Code owns frontend work under `frontend/`, while GitHub Copilot owns
backend work under `backend/`, ingestion, API contracts and related tests. The API contract is
`backend/app/models.py`: Copilot changes it, regenerates `frontend/src/lib/types.ts`, and Claude Code builds on the
new types once that PR is merged. Claude Code never edits `types.ts` by hand; a frontend need for a new field is a
request to Copilot (an issue or a note in the PR), not a local type.

The handoff is a pull request into `main`. A frontend PR must identify the backend endpoints and
types it consumes; a backend PR must identify the frontend screens and types it enables. After both sides are
merged, validate `main`, then deploy that exact commit to the MVP server ([docs/deploy.md](docs/deploy.md)). The
server is a representation of the repository, not a separate source of truth.

## Running two copies at once

The main checkout keeps the usual ports. A second worktree uses different ones so both can run side by side:

| Checkout | Backend | Frontend |
| --- | --- | --- |
| main checkout | `uv run uvicorn app.main:app --reload --port 8000` | `npm run dev` (3000) |
| second worktree | `uv run uvicorn app.main:app --reload --port 8001` | `API_URL=http://localhost:8001 npm run dev -- -p 3001` |

Each worktree needs its own `uv sync` and `npm install`, plus a copy of `backend/.env` and `backend/data/raw/`. Both
are untracked, so copy them from the main checkout. Point each worktree's `DATABASE_URL` at its own local database
(`createdb research_hub_2`, then `uv run python -m ingest.run --offline`), so an import in one doesn't replace the
other's data. Never point a worktree or a test run at the production Supabase database.

## Before you open a PR

```bash
cd backend && uv run pytest && uv run python -m app.contract --check
cd frontend && npm run lint && npm run build
```

CI runs the same commands on every push and PR (`.github/workflows/ci.yml`). Don't merge a PR with failing CI.

## Code rules

- **Secrets:** never commit `backend/.env` or any API key. Use `backend/.env.example` for documented settings.
- **AI calls** live only in `backend/app/ai.py`. The frontend never calls a model API. The default is
  `AI_PROVIDER=anthropic`, `AI_MODEL=claude-sonnet-5-5`; Gemini works when configured.
- **The browser calls `/api/...` on its own origin.** `frontend/next.config.mjs` forwards it to the backend locally;
  nginx does this in production. Don't hard-code `http://localhost:8000` in browser code.
- **API changes** start in `backend/app/models.py` (and `main.py` for routes). Run `uv run python -m app.contract` in
  `backend/` to regenerate `frontend/src/lib/types.ts` and the `docs/api.md` endpoint table, describe any new
  behaviour in `docs/api.md`, and commit all of it in one PR. CI fails when the generated files are stale.
  Frontend-only request shapes (`SearchParams`, `PeopleParams`) live in `frontend/src/lib/api.ts`.
- **Data rules:** AI must never invent projects, investigators or citations. Filters, sorting and counts are SQL.
  An award record is funding history, not proof a study is active. See "Data and AI rules" in the README.
- **Tests:** new backend behaviour comes with a test in `backend/tests/`.
- Match the surrounding style. Don't reformat files you aren't otherwise changing, since that causes merge conflicts
  for the other agent.

## Commit messages

Imperative summary line under about 72 characters, e.g. "Add college comparison endpoint", followed by a short
body saying why. Agents add their own attribution trailer.
