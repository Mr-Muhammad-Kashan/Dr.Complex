# College CDS API

A Scorecard-inspired REST API serving Common Data Set (CDS) data for US colleges. Lookup-by-IPEDS and search-by-name/state, returning the same `{metadata, results[]}` envelope as the real [College Scorecard API](https://collegescorecard.ed.gov/data/api-documentation/).

The dataset is seeded from a folder of per-school CDS JSON files (`College API Design/10 Json files for Universities/`) into an embedded SQLite database. Containerized for easy local runs and future cloud deployment.

---

## Stack

- **Node.js 22+** with Express (plain JavaScript)
- **`node:sqlite`** — Node's built-in SQLite module (no native build, no `better-sqlite3` dependency)
- **swagger-ui-express** + a hand-written `openapi.yaml` for interactive API docs
- **Vitest + supertest** for unit and integration tests against a real isolated SQLite DB
- **Docker + docker-compose** with a named volume so the DB survives image rebuilds

---

## Quick start

### Option A — Docker (recommended)

Requires Docker Desktop running.

```bash
cd api
cp .env.example .env          # then edit API_KEY if you like
npm run docker:start          # builds image, starts container, waits for /v1/health
```

You should see:

```
API:      http://localhost:8080
Docs:     http://localhost:8080/v1/docs
OpenAPI:  http://localhost:8080/v1/openapi.json
Health:   http://localhost:8080/v1/health
```

Open **http://localhost:8080/v1/docs** in your browser — click **Authorize**, paste the `API_KEY` value, and try any endpoint.

### Refreshing data via rebuild

The image bakes a fresh SQLite DB at build time from `../data/input/*.json`. Every `npm run docker:start` generates a new `BUILD_ID` timestamp and re-bakes — so updating the JSONs in `data/input/` and re-running is all that's needed to refresh the running API. See the [Refreshing the dataset](#refreshing-the-dataset-rebuild-driven) section below for the full mechanism.

### Option B — local Node

Requires Node 22 or 24.

```bash
cd api
npm install
cp .env.example .env
npm start                     # http://localhost:8080
```

---

## API endpoints

All `/v1/schools*` endpoints require `api_key` (query param or `x-api-key` header).
`/v1/health`, `/v1/docs`, `/v1/openapi.json` are public.

### `GET /v1/schools/:ipeds_id` — lookup by IPEDS ID

Returns the latest CDS year by default. Override with `?year=YYYY-YYYY`.

```bash
KEY=dev-key-change-me

# Harvard (IPEDS 166027), full payload
curl "http://localhost:8080/v1/schools/166027?api_key=$KEY"

# Specific year
curl "http://localhost:8080/v1/schools/166027?api_key=$KEY&year=2024-2025"

# Projected fields only
curl "http://localhost:8080/v1/schools/166027?api_key=$KEY&fields=cds_meta.school_name,cds_admissions.test_scores"
```

### `GET /v1/schools` — search

```bash
# Case-insensitive substring match on name
curl "http://localhost:8080/v1/schools?api_key=$KEY&school.name=harv"

# 2-letter state
curl "http://localhost:8080/v1/schools?api_key=$KEY&school.state=MA"

# Pagination
curl "http://localhost:8080/v1/schools?api_key=$KEY&page=0&per_page=20"

# Projected payloads (default returns lean {ipeds_id, name, state, city, cds_year})
curl "http://localhost:8080/v1/schools?api_key=$KEY&fields=cds_meta.school_name,cds_meta.state"
```

### `GET /v1/health`

```bash
curl http://localhost:8080/v1/health
# {"status":"ok","schools_loaded":9,"db_path":"/data/cds.db","uptime_seconds":42}
```

### Response envelope

Every response (including single-school lookup) uses:

```json
{
  "metadata": { "total": 1, "page": 0, "per_page": 20 },
  "results": [ ... ]
}
```

### Error shape

```json
{ "error": { "code": 404, "message": "School 999999 not found" } }
```

Codes: `400` bad params, `401` missing/invalid `api_key`, `404` not found, `500` server error.

---

## Configuration

All config via env vars (see `.env.example`):

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `API_KEY` | _(required)_ | Single shared key required on every `/v1/schools*` request |
| `CORS_ORIGIN` | `*` | Comma-separated allowlist. Use a real list in prod. |
| `DB_PATH` | `./data/cds.db` | SQLite file location (auto-created) |
| `INGEST_DIR` | `../College API Design/10 Json files for Universities` | Folder of CDS JSON files to seed from on first run. **Quote values containing spaces.** In the Docker container this is set to `/app/seed/` (staged at build time). |
| `DOCS_ENABLED` | `true` | Set `false` to hide `/v1/docs` and `/v1/openapi.json` in prod |
| `NODE_ENV` | `development` | |

---

## Convenience scripts

All wrap `docker compose` so you don't need to remember flags. Each has an `npm run` alias.

| Script | npm alias | What it does |
|---|---|---|
| `scripts/start.sh` | `npm run docker:start` | Stages seed JSONs into `api/seed/`, builds image, starts container, waits for `/v1/health` |
| `scripts/stop.sh` | `npm run docker:stop` | Stops the container. **Keeps the SQLite volume** so data survives. |
| `scripts/restart.sh` | `npm run docker:restart` | stop + start |
| `scripts/logs.sh` | `npm run docker:logs` | Tail container logs |
| `scripts/status.sh` | `npm run docker:status` | Container state + `/v1/health` output |
| `scripts/reset.sh` | `npm run docker:reset` | **Destructive.** Stops, deletes the SQLite volume, restarts (re-ingests fixtures). Prompts unless `FORCE=1`. |
| `scripts/admin.sh` | `npm run admin` | DB admin utility — add/update/delete school records. See below. |

---

## Refreshing the dataset (rebuild-driven)

The standard workflow for adding/updating school data is: **edit files in `../data/input/` and rebuild**. The pipeline is fully automatic:

1. `scripts/start.sh` stages every `*.json` from `../data/input/` into `api/seed/`, generates a fresh `BUILD_ID` timestamp, and passes it as a Docker build arg.
2. The Dockerfile bakes `/app/seed.db` from those JSONs using `admin.js bulk --reset` (the same upsert code path that powers ad-hoc admin edits).
3. The image is stamped with the `BUILD_ID` at `/app/build_id`.
4. On container start, the server compares `/app/build_id` against `/data/build_id`:
   - **Different** (or volume DB missing) → copy `/app/seed.db` onto `/data/cds.db`, write the new build id. Any admin edits since the last build are wiped.
   - **Same** → preserve the current DB. Ad-hoc admin edits survive plain `docker compose restart`.

Mental model: `data/input/` is the source of truth for the deployment. The admin utility is for short-lived ad-hoc edits between deployments.

Fallback: if `data/input/` is empty, `start.sh` falls back to staging from `College API Design/10 Json files for Universities/` for backwards compatibility with the original layout.

---

## Admin utility — managing school records

Use the admin CLI to insert, update, delete, list, or print individual school records. By default it operates against the live containerized DB; if no container is running it falls back to the local `./data/cds.db`.

```bash
bash scripts/admin.sh <command> [args...]
# or:
npm run admin -- <command> [args...]
```

### Commands

| Command | Purpose |
|---|---|
| `add <file\|->` | Insert one CDS JSON. Errors if `(ipeds_id, cds_year)` already exists. |
| `upsert <file\|->` (alias `update`) | Insert or overwrite. |
| `delete <ipeds_id> [--year YYYY-YYYY]` | Delete one record. All years for that school if `--year` omitted. |
| `list [--name N] [--state ST]` | Print a filterable table of schools. |
| `show <ipeds_id> [--year YYYY-YYYY]` | Print full CDS JSON for one record. Latest year by default. |
| `bulk <dir> [--reset]` | Upsert every `*.json` in a directory. `--reset` wipes existing rows first. (Used internally by the Docker build to bake the seed DB.) |
| `help` | Print usage. |

### Examples

```bash
# Insert a new school from a JSON file
bash scripts/admin.sh add ./new-school.json

# Overwrite an existing record (or insert if absent)
bash scripts/admin.sh upsert ./new-school.json

# From a pipeline / stdin
cat ./new-school.json | bash scripts/admin.sh upsert -

# Inspect what's loaded
bash scripts/admin.sh list
bash scripts/admin.sh list --state MA
bash scripts/admin.sh list --name harv

# Print one record
bash scripts/admin.sh show 166027
bash scripts/admin.sh show 166027 --year 2024-2025

# Delete
bash scripts/admin.sh delete 166027 --year 2024-2025   # one year
bash scripts/admin.sh delete 999001                    # all years for that IPEDS
```

### Input format

Input JSON must match the canonical CDS template structure (top-level `cds_meta` with at least `ipeds_id`, `cds_year`, `school_name`). See [`College API Design/DreamCollege_CDS_Template V1.0.json`](../College%20API%20Design/DreamCollege_CDS_Template%20V1.0.json) for the full schema. The existing per-school fixtures under `College API Design/10 Json files for Universities/` are working examples.

### How the wrapper routes commands

- **Container running:** the wrapper runs `docker compose exec api node src/admin.js ...` so edits hit the live SQLite volume. For `add`/`upsert`, the input file is streamed via stdin — no bind mount needed.
- **Container not running:** the wrapper runs the CLI locally against `${DB_PATH:-./data/cds.db}`. Be aware: the local DB and the container's volume are separate files.

### Exit codes

`0` ok &nbsp; `1` usage &nbsp; `2` conflict &nbsp; `3` not found &nbsp; `4` validation

---

## Tests

```bash
npm test                 # all tests
npm run test:unit        # unit tests only
npm run test:integration # integration tests only
npm run test:watch       # vitest watch mode
```

- **Unit tests** (`test/unit/`) — db query builders, ingest validator, projection helper, middleware, admin flag parser. Pure functions, no I/O beyond an in-memory SQLite for the DB tests.
- **Integration tests** (`test/integration/`) — supertest against the real Express app backed by an isolated in-memory SQLite seeded with the 10 fixture JSONs. Covers both endpoints, auth, error shapes, `/v1/health`, `/v1/openapi.json`, `/v1/docs`, all admin subcommands, and ingest idempotency.

---

## Project structure

```
api/
├── src/
│   ├── server.js              # entry: opens DB, auto-ingests if empty, starts Express
│   ├── app.js                 # express setup (importable by tests; no .listen)
│   ├── db.js                  # node:sqlite schema + query helpers
│   ├── ingest.js              # JSON validator + upsert loader
│   ├── admin.js               # CLI for add/upsert/delete/list/show/bulk
│   ├── bootstrap.js           # BUILD_ID-driven DB refresh logic (rebuild → fresh data)
│   ├── openapi.yaml           # OpenAPI 3.0 spec (served at /v1/openapi.json)
│   ├── routes/
│   │   ├── schools.js         # GET /v1/schools and /v1/schools/:ipeds_id
│   │   ├── health.js          # GET /v1/health
│   │   └── docs.js            # Swagger UI at /v1/docs, raw spec at /v1/openapi.json
│   ├── middleware/
│   │   ├── auth.js            # api_key check; bypasses health/docs/openapi
│   │   ├── cors.js            # CORS_ORIGIN allowlist
│   │   └── error.js           # uniform {error: {code, message}} responses
│   └── lib/
│       ├── envelope.js        # {metadata, results} response shape
│       └── projection.js      # ?fields=a.b,c partial projection
├── test/
│   ├── unit/                  # 4 files, 43 tests
│   └── integration/           # 4 files, 20 tests (supertest)
├── scripts/                   # docker-compose convenience wrappers
├── Dockerfile                 # node:22-alpine, single-stage runtime
├── docker-compose.yml         # 1 service + cds_data volume mounted at /data
├── vitest.config.js
├── package.json
└── .env.example
```

---

## Data model

Hybrid SQLite schema — indexed columns for fast lookup + JSON blob for the full CDS payload:

```sql
CREATE TABLE schools (
  ipeds_id     TEXT NOT NULL,
  cds_year     TEXT NOT NULL,
  name         TEXT NOT NULL,
  state        TEXT,
  city         TEXT,
  payload      TEXT NOT NULL,         -- full CDS JSON
  ingested_at  TEXT NOT NULL,
  PRIMARY KEY (ipeds_id, cds_year)
);
CREATE INDEX idx_schools_name  ON schools (name COLLATE NOCASE);
CREATE INDEX idx_schools_state ON schools (state);
```

The primary key `(ipeds_id, cds_year)` means each school can hold many CDS years; the default `GET /v1/schools/:ipeds_id` returns the latest. As the dataset grows beyond the current 10 fixtures, additional columns (e.g. `acceptance_rate`) can be indexed without breaking the JSON contract.

---

## Notes & gotchas

- **Why `node:sqlite` and not `better-sqlite3`?** Native build of `better-sqlite3` failed against Node 24 on macOS (missing Xcode header). Node's built-in `node:sqlite` is the same SQLite engine, no compiler needed, works identically in Docker. It emits an experimental warning, which is suppressed via `NODE_OPTIONS=--no-warnings=ExperimentalWarning`.
- **Why is SQLite "in the same container" instead of a separate one?** SQLite isn't a server — it's an embedded library that reads a file. There is no daemon to containerize. The `.db` file lives on a named Docker volume (`cds_data`) mounted at `/data`, so it survives image rebuilds.
- **`.env` values containing spaces must be quoted.** `INGEST_DIR="../College API Design/10 Json files for Universities"` — without quotes, bash misparses the assignment.
- **Docker build context names must be lowercase** if you ever use `additional_contexts`.
- **Seed staging:** `start.sh` copies the JSON fixtures into `api/seed/` (gitignored) before building so the Docker `COPY` line stays simple. The container's `INGEST_DIR` env var points at `/app/seed/`.
- **First-run ingest:** `server.js` auto-ingests the seed folder only if the DB is empty. Re-running is a no-op. To force a re-ingest, use `npm run docker:reset` or delete the DB volume manually.

---

## Cloud deployment (later)

The image is self-contained and listens on `$PORT`. For most platforms (Fly.io, Render, Cloud Run, Fargate):

1. Build and push the image.
2. Attach a persistent volume mounted at `/data` (the SQLite file lives there).
3. Set `API_KEY`, `CORS_ORIGIN`, and optionally `DOCS_ENABLED=false`.
4. Health-check path: `/v1/health`.

If the dataset grows to the point that you need horizontal scaling, swap `node:sqlite` for Postgres — the schema translates 1:1 (`TEXT` → `text`, `payload TEXT` → `jsonb`).
