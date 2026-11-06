# Deploying the MVP server

The server is a copy of a commit on `main`, nothing more. Code reaches it only through `git`, and it is never edited
in place. If the server needs a fix, the fix goes through a PR into `main` and is deployed from there.

What lives only on the server, and is never committed:

| Item | Where | Rebuilt by |
| --- | --- | --- |
| Secrets (`ANTHROPIC_API_KEY`, etc.) | `backend/.env` or the service environment | set by hand from `backend/.env.example` |
| Database connection | `DATABASE_URL` in `backend/.env` (Supabase session pooler URI) | set by hand |
| Data in Supabase | Supabase project | `uv run python -m ingest.run` |
| Backups | Supabase daily backups, plus `pg_dump` files outside the deploy folder | `uv run python -m app.backup` |

## The server

| Item | Value |
| --- | --- |
| Checkout | `/opt/research-hub` (clone of `be-hun/research-hub`) |
| Backend | `research-hub-api.service` (FastAPI) |
| Frontend | `research-hub-web.service` (Next.js) |
| Funding-call refresh | `research-hub-opportunities.timer` (daily, 05:30 Eastern; units in `deploy/`) |
| Reverse proxy | nginx, site `/etc/nginx/sites-enabled/research-hub` (serves `/api/` and the web app) |
| Verified | 4 Nov 2026: HEAD `108125a` = `origin/main`, no local edits |

## Deploy a commit

Run on the server as root:

```bash
cd /opt/research-hub
git fetch origin
git status --porcelain            # must print nothing: the server has no local edits
git checkout --detach origin/main # or a specific commit on main

cd backend
uv sync --locked
uv run python -m app.backup       # pg_dump of the current data, kept until the new deploy is verified
cd ../frontend
npm ci && npm run build

systemctl restart research-hub-api research-hub-web
```

## Verify

```bash
curl -fsS http://localhost/api/health                  # {"ok":true} through nginx
git -C /opt/research-hub rev-parse --short HEAD        # equals the commit you meant to deploy
git -C /opt/research-hub merge-base --is-ancestor HEAD origin/main && echo "on main"
systemctl is-active research-hub-api research-hub-web  # active, active
```

Then open the Home page, a project page, and `/profile` (the synthetic demo profile).

## Import and AI summaries

After deploying a code change, import the data before generating summaries. The summary cache is keyed by record IDs
and update dates, so generating it before the import produces stale results:

```bash
cd /opt/research-hub/backend
uv run python -m ingest.run --offline --no-backup
uv run python -m app.summaries --kinds topic,college,researcher --min-records 2 --workers 4
```

Set `AI_SUMMARIES=cached` in the service environment after the CLI completes. Requests then use current cached
summaries and return unavailable rather than calling the model for anything still missing.

## Daily funding-call refresh

Grants.gov deadlines and calls change daily, so a systemd timer re-fetches only the funding calls
(`uv run python -m ingest.grants_gov`, about 5 minutes). Award data is untouched. The unit files are committed in
`deploy/`; the server links to them, so a deploy that changes them takes effect after `daemon-reload`.

Install once, after the first deploy that contains `deploy/` and after one full online import
(`uv run python -m ingest.run --no-backup` without `--offline`, which also caches `data/raw/grants_gov.json`):

```bash
ln -sf /opt/research-hub/deploy/research-hub-opportunities.service /etc/systemd/system/
ln -sf /opt/research-hub/deploy/research-hub-opportunities.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now research-hub-opportunities.timer
systemctl start research-hub-opportunities.service   # one run now, to check it works
```

Check it:

```bash
systemctl list-timers research-hub-opportunities.timer   # next and last run
journalctl -u research-hub-opportunities.service -n 30    # the last run's counts, or why it stopped
```

If Grants.gov returns fewer than half as many calls as are stored, the run exits with an error and keeps the stored
calls (`journalctl` says so). Run `uv run python -m ingest.grants_gov --force` by hand if the drop is real. The
services run as the same user as `research-hub-api.service`; if that isn't root, add the same `User=` line to the
`.service` file in a PR.

After a deploy that changes the units: `systemctl daemon-reload`.

## Saved conversations

Saved Ask conversations live in two tables, `conversations` and `conversation_messages`, defined in
`backend/app/conversations.sql`. The backend creates them automatically at startup if they're missing (on Supabase
too), so a deploy needs no manual step. They're kept out of `schema.sql`, so imports (`ingest.run`) and schema
rebuilds after a `SCHEMA_VERSION` bump never touch them. To remove them, and every saved conversation, run:

```sql
DROP TABLE IF EXISTS conversation_messages, conversations;
```

## Roll back

Check out the previous commit on `main`, repeat the deploy steps, and restore the backup taken before the deploy if
the database changed:

```bash
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" data/backups/hub-<stamp>.dump
```

The server needs the PostgreSQL 17 client tools (`pg_dump`, `pg_restore`) for this; Supabase's own daily backups
(Dashboard > Database > Backups) are the fallback.

## Bringing a drifted server back in line

If `git status` on the server shows edits, or HEAD isn't on `main`, the server has become a second source of truth.

1. Save what's there: `git diff > ~/server-drift.patch` and `git log origin/main..HEAD`.
2. Open a PR with anything worth keeping. Don't push from the server.
3. Once it's merged, deploy `main` as above.
