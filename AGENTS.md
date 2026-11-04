# Working on Research Hub (humans, Claude Code and GitHub Copilot)

This file is the single source of rules for every coding agent in this repo. `CLAUDE.md` and
`.github/copilot-instructions.md` only point here, so change the rules in this file and nowhere else.
Project overview, setup commands and data sources are in [README.md](README.md); the API contract is in
[docs/api.md](docs/api.md).

## Branches: one agent, one branch, one folder

Two agents editing the same checkout overwrite each other's work. Each agent gets its own branch **and** its own
working folder (a git worktree), and work comes back together through pull requests.

| Branch | Who | Purpose |
| --- | --- | --- |
| `main` | nobody directly | Released state. Updated only by merging `backend-foundation`. |
| `backend-foundation` | nobody directly | Integration branch. Every feature PR targets it. |
| `copilot/<short-topic>` | GitHub Copilot | One branch per feature or fix. |
| `claude/<short-topic>` | Claude Code | One branch per feature or fix. |
| `<name>/<short-topic>` | a person | Same rules. |

Start a task in its own worktree (folder names are a convention, not a requirement):

```bash
cd ~/Desktop/research-hub
git fetch origin
git worktree add -b claude/my-topic ../research-hub-claude origin/backend-foundation    # Claude Code
git worktree add -b copilot/my-topic ../research-hub-copilot origin/backend-foundation  # Copilot
```

Rules:

- Before starting, run `git fetch` and branch from the latest `origin/backend-foundation`.
- Don't commit to `main` or `backend-foundation` directly, and don't push to another agent's branch.
- Don't switch branches or run `git reset`/`git stash` in a folder another agent is working in.
- Keep PRs small and single-purpose. Rebase on `origin/backend-foundation` before asking for review.
- Before taking on a task, check open PRs (`gh pr list`) so two agents don't build the same thing.
- If your change touches a file another open PR also changes, say so in the PR description.

## Frontend/backend handoff

For the current feature cycle, Claude Code owns frontend work under `frontend/`, while GitHub Copilot owns
backend work under `backend/`, ingestion, API contracts and related tests. Both agents use this repository as
the source of truth: the API contract in `backend/app/models.py`, `frontend/src/lib/types.ts` and `docs/api.md`
must stay synchronized, and neither agent should copy implementation state through chat or untracked files.

The handoff is a pull request into `backend-foundation`. A frontend PR must identify the backend endpoints and
types it consumes; a backend PR must identify the frontend screens and types it enables. After both sides are
merged, validate the integrated checkout, then deploy only the merged `backend-foundation` commit to the MVP
server. The server is a representation of the repository, not a separate source of truth.

## Running two copies at once

The main checkout keeps the usual ports. A second worktree uses different ones so both can run side by side:

| Checkout | Backend | Frontend |
| --- | --- | --- |
| main checkout | `uv run uvicorn app.main:app --reload --port 8000` | `npm run dev` (3000) |
| second worktree | `uv run uvicorn app.main:app --reload --port 8001` | `API_URL=http://localhost:8001 npm run dev -- -p 3001` |

Each worktree needs its own `uv sync` and `npm install`, plus a copy of `backend/.env` and `backend/data/`. Both are
untracked, so copy them from the main checkout.

## Before you open a PR

```bash
cd backend && uv run pytest
cd frontend && npm run lint && npm run build
```

CI runs the same commands on every push and PR (`.github/workflows/ci.yml`). Don't merge a PR with failing CI.

## Code rules

- **Secrets:** never commit `backend/.env` or any API key. Use `backend/.env.example` for documented settings.
- **AI calls** live only in `backend/app/ai.py`. The frontend never calls a model API. The default is
  `AI_PROVIDER=anthropic`, `AI_MODEL=claude-sonnet-5-5`; Gemini works when configured.
- **The browser calls `/api/...` on its own origin.** `frontend/next.config.mjs` forwards it to the backend locally;
  nginx does this in production. Don't hard-code `http://localhost:8000` in browser code.
- **API changes** update three places in the same PR: `backend/app/models.py`, `frontend/src/lib/types.ts` and
  `docs/api.md`. A backend test fails when the models and types drift apart.
- **Data rules:** AI must never invent projects, investigators or citations. Filters, sorting and counts are SQL.
  An award record is funding history, not proof a study is active. See "Data and AI rules" in the README.
- **Tests:** new backend behaviour comes with a test in `backend/tests/`.
- Match the surrounding style. Don't reformat files you aren't otherwise changing, since that causes merge conflicts
  for the other agent.

## Commit messages

Imperative summary line under about 72 characters, e.g. "Add college comparison endpoint", followed by a short
body saying why. Agents add their own attribution trailer.
