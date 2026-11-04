## What and why

<!-- One or two sentences. -->

## Author

- [ ] Person
- [ ] Claude Code (`claude/*` branch)
- [ ] GitHub Copilot (`copilot/*` branch)

## Checklist

- [ ] Targets `backend-foundation`, rebased on the latest version
- [ ] `uv run pytest` passes (backend)
- [ ] `npm run lint && npm run build` pass (frontend)
- [ ] API changes update `backend/app/models.py`, `frontend/src/lib/types.ts` and `docs/api.md` together
- [ ] No secrets or `backend/.env` committed
- [ ] Overlapping open PRs mentioned below, if any

## Overlap with other open PRs

<!-- e.g. "Also touches frontend/src/lib/api.ts, see #12" -->
