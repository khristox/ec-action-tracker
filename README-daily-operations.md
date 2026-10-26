## Daily operations

Everyday commands for running and maintaining the Action Tracker locally (WSL).
All paths are relative to the project root, `~/ec-action-tracker`. Database
credentials and other secrets live in `.env` (see `.env.example`); they are not
repeated here.

### At a glance

| What | Where | How it runs |
|------|-------|-------------|
| Backend API (FastAPI) | http://localhost:8001 (docs at `/docs`) | uvicorn, inside `venv` |
| Frontend (Vite dev server) | http://localhost:3000 | `npm run dev` in `frontend/` |
| PostgreSQL | `localhost:5433` (container `ec_postgres`) | `docker compose` |
| Redis | `docker compose` service `redis` | `docker compose` |
| MinIO (file storage) | http://localhost:9000 (container `ec_minio`) | `docker compose` |
| Production app | https://tracker.ec.or.ug/ec/ | FastAPI serves the built frontend from `static/` |

---

### 1. Start and stop

Start the infrastructure first, then the backend, then the frontend. Use one
terminal for each.

```bash
# Terminal 1: database, cache, file storage
cd ~/ec-action-tracker
docker compose up -d postgres redis minio

# Terminal 2: backend
cd ~/ec-action-tracker
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --reload-dir app

# Terminal 3: frontend
cd ~/ec-action-tracker/frontend
npm run dev -- --host 0.0.0.0
```

Stop: press `Ctrl+C` in the backend and frontend terminals, then `deactivate`
to leave the virtualenv.

```bash
docker compose stop      # stop the containers, keep all data
docker compose down      # remove the containers, still keeps the data volumes
# never add -v unless you want to delete the database and stored files
```

Check that everything is up:

```bash
docker compose ps
curl http://localhost:8001/health
curl -s http://localhost:8001/health/detailed | python -m json.tool
curl -v --max-time 10 http://localhost:9000/minio/health/live
```

A healthy backend start prints these lines: database connected, Redis
initialized, MinIO bucket ensured, then one "started in background" line for
each scheduler (meeting reminders, meeting status, action due-date reminders)
and "Starting recurring occurrence scheduler".

---

### 2. Accessing the database

Connection details: host `localhost`, port `5433`, database
`ec_action_tracker`, user `ec_user`, password from `.env`.

**Option A: from inside the container (no client install, no password prompt)**

```bash
docker exec -it ec_postgres psql -U ec_user -d ec_action_tracker
```

**Option B: from WSL with `psql`** (one-time install: `sudo apt install postgresql-client`)

```bash
psql -h localhost -p 5433 -U ec_user -d ec_action_tracker
```

**Option C: a single query, then exit**

```bash
docker exec -it ec_postgres psql -U ec_user -d ec_action_tracker -c "SELECT id, title FROM meetings LIMIT 5;"
```

A GUI client such as DBeaver or the VS Code PostgreSQL extension can use the
same details (`localhost`, `5433`).

**Handy `psql` commands**

| Command | Does |
|---------|------|
| `\dt` | list tables |
| `\d meetings` | show a table's columns, indexes and constraints |
| `\x` | switch expanded (one field per line) output on or off |
| `\l` | list databases |
| `\q` | quit |

**Useful queries**

```sql
-- one meeting
SELECT id, title, status FROM meetings WHERE id = '<meeting id>';

-- recurring series and what has been generated
SELECT id, title, last_occurrence_date, next_occurrence_date, total_occurrences_generated
FROM recurring_meetings WHERE is_deleted = false;

-- departments
SELECT * FROM departments;
```

**Changing data safely.** Wrap every `UPDATE` or `DELETE` in a transaction so
you can check the result before it is permanent:

```sql
BEGIN;
UPDATE meetings SET title = 'New title' WHERE id = '<meeting id>';
SELECT id, title FROM meetings WHERE id = '<meeting id>';   -- looks right?
COMMIT;      -- or ROLLBACK; to undo
```

Dates in the database are stored in UTC. Uganda time (EAT) is UTC+3.

---

### 3. Backups

```bash
# backup (creates backup_YYYY-MM-DD.sql in the current folder)
docker exec ec_postgres pg_dump -U ec_user ec_action_tracker > backup_$(date +%F).sql

# restore into an EMPTY database
docker exec -i ec_postgres psql -U ec_user -d ec_action_tracker < backup_2026-10-26.sql
```

Take a backup before every migration on a database that holds real data.
Do not commit backup files to git.

---

### 4. Database migrations (Alembic)

```bash
source venv/bin/activate
alembic current                                        # which revision the database is on
alembic revision --autogenerate -m "describe change"   # create a migration from the models
alembic upgrade head                                   # apply it
alembic check                                          # fails if models and database differ
```

Always open the generated file in `alembic/versions/` and read it before
running `upgrade`. Commit the migration together with the model change.
If Alembic reports that `alembic/versions` does not exist, create it with
`mkdir -p alembic/versions`.

---

### 5. Frontend: check, build, deploy

```bash
cd frontend
npm run build                    # production build (served under /ec/)
npm run preview -- --host 0.0.0.0   # try the production build locally
npm run doctor -- --verbose      # React Doctor code-health report
```

Cached dev-server problems (odd import errors after installing packages):

```bash
rm -rf node_modules/.vite && npm run dev
```

**Publish a new version.** The built frontend is copied into `static/`, which
FastAPI serves in production, and the app is shipped as a Docker image.

```bash
cd docker
./installer.sh                   # builds the frontend and refreshes static/
cd ..
docker build -t wagambula/ec-action-tracker:YYYY-MM-DD -t wagambula/ec-action-tracker:latest .
docker login
docker push wagambula/ec-action-tracker:YYYY-MM-DD
docker push wagambula/ec-action-tracker:latest
```

`docker/dockerpush.sh` wraps the push step. If `installer.sh` complains about a
missing folder, create it: `mkdir -p static frontend/dist`.

Check that the build is served correctly (every line should say HTTP 200 and a
JavaScript content type):

```bash
curl -I http://localhost:8001/ec/
for f in $(grep -oE '/ec/assets/[^"]+\.js' static/index.html | sed 's#^/ec/##'); do
  curl -s -o /dev/null -w "HTTP=%{http_code} TYPE=%{content_type} $f\n" "http://localhost:8001/ec/$f"
done
```

**Run the backend image locally** (instead of uvicorn):

```bash
docker build -t ec-action-tracker-api:latest .
docker run --rm -p 8001:8001 --env-file .env \
  --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL=postgresql+asyncpg://<user>:<password>@host.docker.internal:5433/ec_action_tracker \
  ec-action-tracker-api:latest
```

---

### 6. Logs and troubleshooting

```bash
docker compose logs -f postgres        # or redis, minio
docker logs --tail 50 ec_minio
docker logs app --tail=50              # the application container, where it runs as "app"
```

| Problem | Check |
|---------|-------|
| `address already in use` on port 8001 | `sudo ss -ltnp \| grep :8001` shows what holds it |
| Browser reports a CORS error | `curl -s http://localhost:8001/debug/cors \| python -m json.tool` |
| Preflight test | `curl -i -X OPTIONS http://localhost:8001/api/v1/auth/register -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"` |
| Emails do not send | `nslookup mail.ec.or.ug`, then `nc -vz -w 10 mail.ec.or.ug 587` (and `465`) |
| MinIO uploads fail | `curl -v --max-time 10 http://localhost:9000/minio/health/live` |
| Database refused connection | `docker compose ps`, then `docker compose up -d postgres` |
| Frontend shows a blank page after a deploy | the asset check in section 5; make sure `static/` matches the latest build |

Interactive API documentation is at http://localhost:8001/docs.

---

### 7. Git routine

```bash
git status
git add -A
git commit -m "Short description of the change"
git push
```

The working branch is `ec-action-tracker-updates`. Check which branch you are
on with `git branch --show-current` before committing.

---

### 8. Housekeeping

- Re-run `history` or clear your terminal history after pasting commands that
  contain a password. Never commit `.env`.
- Keep the `docker compose` volumes; they hold the database and uploaded files.