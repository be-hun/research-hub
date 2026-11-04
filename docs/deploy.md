# Deploying the MVP server

The server is a copy of a commit on `main`, nothing more. Code reaches it only through `git`, and it is never edited
in place. If the server needs a fix, the fix goes through a PR into `main` and is deployed from there.

What lives only on the server, and is never committed:

| Item | Where | Rebuilt by |
| --- | --- | --- |
| Secrets (`ANTHROPIC_API_KEY`, etc.) | `backend/.env` or the service environment | set by hand from `backend/.env.example` |
| Database | `backend/data/hub.db` | `uv run python -m ingest.run` |
| Backups | outside the deploy folder | `uv run python -m app.backup` |

## Deploy a commit

Run on the server, in the checkout. `<service>` names stand for whatever the server uses; record the real ones
here once they're confirmed.

```bash
git fetch origin
git status --porcelain            # must print nothing: the server has no local edits
git checkout --detach origin/main # or a specific commit on main

cd backend
uv sync --locked
uv run python -m app.backup       # keep the previous database until the new deploy is verified
cd ../frontend
npm ci && npm run build

sudo systemctl restart <backend-service> <frontend-service>
```

## Verify

```bash
curl -fsS https://<host>/api/health        # {"ok":true}
git -C <checkout> rev-parse HEAD           # equals the commit you meant to deploy
git -C <checkout> merge-base --is-ancestor HEAD origin/main && echo "on main"
```

Then open the Home page, a project page, and `/profile` (the synthetic demo profile).

## Roll back

Check out the previous commit on `main`, repeat the deploy steps, and restore the backup taken before the deploy if
the database changed.

## Bringing a drifted server back in line

If `git status` on the server shows edits, or HEAD isn't on `main`, the server has become a second source of truth.

1. Save what's there: `git diff > ~/server-drift.patch` and `git log origin/main..HEAD`.
2. Open a PR with anything worth keeping. Don't push from the server.
3. Once it's merged, deploy `main` as above.
