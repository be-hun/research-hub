# Claude Code

Follow the shared rules for every agent in this repo:

@AGENTS.md

Claude Code specifics:

- Work on a `claude/<topic>` branch in its own worktree (see "Branches" in AGENTS.md), never in the folder Copilot is using.
- Open PRs into `main` with `gh pr create --base main`.
- Never edit `frontend/src/lib/types.ts` by hand: it is generated from `backend/app/models.py`.
