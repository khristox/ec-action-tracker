# EC Action Tracker – Local Development Setup

This guide runs the project in **development mode** on Windows with WSL (Ubuntu) and Docker Desktop:

| Component | Where it runs | Port |
|-----------|---------------|------|
| PostgreSQL | Docker container | 5433 (host) → 5432 (container) |
| Redis | Docker container | 6379 |
| MinIO (file storage) | Docker container | 9000 (API), 9001 (console) |
| Backend (FastAPI / uvicorn) | WSL, directly | 8001 |
| Frontend (Vite / React) | WSL, directly | 3000 |

Running the backend and frontend directly (not in Docker) gives instant reload on code changes and avoids container networking problems.

---

## 1. Prerequisites

- Windows with **WSL 2** and an Ubuntu distro
- **Docker Desktop** with WSL integration enabled for your distro
  (Docker Desktop → Settings → Resources → WSL Integration)
- Inside WSL: **Python 3.12**, **Node.js 18+** and npm, git

Check from a WSL terminal:

```bash
docker --version
docker compose version
python3 --version
node --version
```

> Keep the project inside the WSL filesystem (e.g. `/home/<user>/ec-action-tracker`), **not** under `/mnt/c/...`. It is much faster and avoids file-watching problems.

---

## 2. One-time setup

### 2.1 Clone and enter the project

```bash
cd ~
git clone https://github.com/khristox/ec-action-tracker.git
cd ec-action-tracker
```

### 2.2 Python environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2.3 Configure `.env`

Create `.env` in the project root. Minimal development configuration:

```dotenv
# --- Mode ---------------------------------------------------------
# IMPORTANT: must be false when running the backend directly in WSL.
# When true, the app rewrites "localhost" to Docker service names
# (mysql / redis), which do not exist outside a compose network.
# Make sure this key appears ONLY ONCE in the file (last one wins).
IN_DOCKER=false
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO

# --- Database (PostgreSQL in Docker, published on 5433) -----------
DATABASE_URL=postgresql+asyncpg://ec_user:ec_password@localhost:5433/ec_action_tracker

# --- Redis --------------------------------------------------------
REDIS_URL=redis://localhost:6379/0

# --- MinIO --------------------------------------------------------
MINIO_ENDPOINT=localhost:9000

# --- Security (generate your own, see below) ----------------------
SECRET_KEY=<generated value, 32+ characters>
REFRESH_TOKEN_SECRET_KEY=<another generated value>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
REFRESH_TOKEN_EXPIRE_DAYS=7

# --- Admin user created by the seeder -----------------------------
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<choose a password>

# --- URLs ---------------------------------------------------------
BACKEND_URL=http://localhost:8001
API_BASE_URL=http://localhost:8001
FRONTEND_URL=http://localhost:3000

# --- CORS: the frontend origin MUST be listed ---------------------
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8001","http://localhost:8006"]

# --- Email (leave unset or use a test mailbox in development) -----
# The reminder scheduler sends real email if this points at a live
# mail server. Do not use production mail credentials locally.
```

Generate secrets:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Run it once for `SECRET_KEY` and once for `REFRESH_TOKEN_SECRET_KEY`.

> **Never commit `.env` or real credentials.** Make sure `.env` is in `.gitignore`.

### 2.4 Frontend dependencies

```bash
cd frontend
npm install
npm run dev
```

The frontend reads its API address from `frontend/.env.development` (`VITE_API_URL`, default `http://localhost:8001/api/v1`). Leave it at that unless you change the backend port.

---

## 3. Start the infrastructure (Docker)

From the project root:

```bash
# Make sure the app container is not holding port 8001
docker compose stop app 2>/dev/null

# Start only the supporting services
docker compose up -d postgres redis minio

# Verify: all three should show "Up" (postgres "healthy")
docker compose ps
```

Check that PostgreSQL accepts connections:

```bash
docker compose exec postgres psql -U ec_user -d ec_action_tracker -c "select 1;"
```

> The service names `postgres`, `redis` and `minio` are the ones defined in this project's `docker-compose.yml`. If yours differ, use your names.

---

## 4. Start the backend

In **Terminal 1** (project root):

```bash
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --reload-dir app
```

`--reload-dir app` restricts file watching to the `app` folder (otherwise uvicorn also watches `venv/` and gets slow).

A healthy start shows lines like:

```
✅ Redis connected
✅ MinIO bucket ensured
✅ Meeting reminder scheduler started in background
Uvicorn running on http://0.0.0.0:8001
```

Verify from another terminal:

```bash
curl http://localhost:8001/health
```

Leave this terminal running.

---

## 5. Seed the database (first run only) and location

In **Terminal 2** (project root, backend running):

```bash
source venv/bin/activate
python app/db/seed/seed_data.py
```

At the prompts enter:

```
Enter API base URL [...]: http://localhost:8001
Enter admin username [admin]:        (press Enter)
Enter admin password [...]:          (press Enter, or type your ADMIN_PASSWORD)
```

What it does:

1. Creates all tables.
2. Seeds permissions, roles and users (including `admin`).
3. Seeds chart configurations.
4. Runs the shell scripts in `app/db/seed/scripts/` (menus, permissions, attributes, countries, currencies, etc.). **These call the backend API**, which is why the backend must already be running on the URL you enter.

Notes:

- It is safe to run again. If users already exist it skips the database seeding and only re-runs the shell scripts.
- **Do not pass `--drop`** unless you intend to wipe and recreate all data.
- To run one script by hand:
  ```bash
  bash app/db/seed/scripts/01_seed_menus.sh http://localhost:8001 admin '<password>'
  ```

---

## 6. Start the frontend

In **Terminal 3**:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Open **http://localhost:3000** in your Windows browser and log in as `admin` with the password you configured.

---

## 7. Daily workflow

```bash
# Terminal 1
cd ~/ec-action-tracker
docker compose up -d postgres redis minio
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --reload-dir app

# Terminal 2
cd ~/ec-action-tracker/frontend
npm run dev -- --host 0.0.0.0
```

No re-seeding needed. To stop: press Ctrl+C in both terminals, then `docker compose stop`. Data is kept in the `postgres_data` Docker volume.

To wipe everything and start over:

```bash
docker compose down -v      # deletes database and MinIO volumes
```

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `[Errno -2] Name or service not known` (database or Redis) | `IN_DOCKER` is `true` (check for a duplicate line at the bottom of `.env`; also run `echo $IN_DOCKER` in WSL). Set it to `false`. |
| `address already in use ... 8001` | The `app` container (or another process) holds the port. `docker compose stop app`, or find it with `ss -ltnp \| grep 8001`. |
| `NameError: name 'scheduler_task' is not defined` | In `app/main.py` the startup code must define `scheduler_task = asyncio.create_task(reminder_scheduler.start())` before `app.state.scheduler_task = scheduler_task`. |
| Seed scripts print `Server not running at ...` | Backend isn't running, or the URL you entered doesn't match its port. Check `curl http://localhost:8001/health`. |
| `http://localhost:3000` doesn't open from Windows | Start Vite with `--host 0.0.0.0`; or use VS Code's **Ports** tab to forward 3000; or open `http://<WSL-IP>:3000` (`hostname -I`). |
| Browser shows CORS errors | Add `http://localhost:3000` to `BACKEND_CORS_ORIGINS` in `.env` and restart the backend. |
| Login works but pages are empty | The seed shell scripts did not complete. Re-run step 5 with the backend running. |
| MinIO connection refused (backend crashes on import) | MinIO container isn't up, or `MINIO_ENDPOINT` points at the wrong host. Locally it must be `localhost:9000`. |
| Backend serves no web pages at `/` | `frontend/dist` doesn't exist. In dev you use the Vite server on port 3000; for a production-style build run `npm run build` in `frontend/`. |

---

## 9. Running everything in Docker (alternative)

If you prefer full containers, the `app` service must use Docker service names, not `localhost`:

```yaml
  app:
    build: .
    ports:
      - "8001:8001"
    environment:
      IN_DOCKER: "true"
      DATABASE_URL: "postgresql+asyncpg://ec_user:ec_password@postgres:5432/ec_action_tracker"
      REDIS_URL: "redis://redis:6379/0"
      MINIO_ENDPOINT: "minio:9000"
      BACKEND_CORS_ORIGINS: '["http://localhost:3000","http://localhost:8001"]'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      minio:
        condition: service_started
```

```bash
docker compose up -d --build
docker compose logs -f app
```

Do not run this and the local uvicorn at the same time: both want port 8001 and both would run the reminder scheduler against the same database.

---

# Menus

After creating a new role, make sure that you go to menu and select the options you want displayed.

## 10. Security notes

- Generate your own `SECRET_KEY` and `REFRESH_TOKEN_SECRET_KEY`; never reuse values committed to a repository.
- Use test mail settings in development so the reminder scheduler cannot email real people.
- Change the default passwords of the seeded users (see `app/db/seed/users.txt`) before exposing the app beyond your own machine.
- The database and MinIO credentials in this guide (`ec_user` / `ec_password`, `minioadmin`) are for local development only.

