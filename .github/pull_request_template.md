## What and why

<!-- One or two sentences. -->

## Author

- [ ] Person
- [ ] Claude Code (`claude/*` branch)
- [ ] GitHub Copilot (`copilot/*` branch)

## Checklist

- [ ] Targets `main`, rebased on the latest version
- [ ] `uv run pytest` passes (backend)
- [ ] `npm run lint && npm run build` pass (frontend)
- [ ] API changes start in `backend/app/models.py`; `uv run python -m app.contract` was run and its output committed
- [ ] No secrets or `backend/.env` committed
- [ ] Overlapping open PRs mentioned below, if any

## Overlap with other open PRs

<!-- e.g. "Also touches frontend/src/lib/api.ts, see #12" -->
