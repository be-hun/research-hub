# GitHub Copilot

Read and follow [AGENTS.md](../AGENTS.md) at the repo root. It holds the shared rules for every agent here,
including Claude Code, which works in the same repo at the same time.

Copilot specifics:

- Work on a `copilot/<topic>` branch in its own worktree (see "Branches" in AGENTS.md), never in a folder Claude Code is using.
- Open pull requests against `main`.
- After changing `backend/app/models.py` or a route, run `uv run python -m app.contract` in `backend/` and commit
  the regenerated `frontend/src/lib/types.ts` and `docs/api.md`.
- Before you finish, run `uv run pytest` in `backend/` and `npm run lint && npm run build` in `frontend/`.
