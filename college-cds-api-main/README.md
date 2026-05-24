# college-cds-api

A small REST API that serves per-college **Common Data Set (CDS)** records — admissions, test scores, financials, outcomes — to a front-end web UI. The API mirrors the conventions of the [College Scorecard API](https://collegescorecard.ed.gov/data/api-documentation/) so it feels familiar to anyone who's worked with federal college data.

This repo holds two things side by side:

1. **`api/`** — the Node.js + Express + SQLite service, fully tested and Dockerized.
2. **`College API Design/`** — the design assets that drive it: the canonical CDS JSON schema, per-school source data (PDFs and the JSON extractions), the field catalog, and the original API-style reference doc.

---

## Repo layout

```
college-cds-api/
├── api/                                 # the runnable service (see api/README.md)
│   ├── src/                             # express app, routes, db, ingest, openapi
│   ├── test/                            # vitest unit + integration tests
│   ├── scripts/                         # docker-compose convenience wrappers
│   ├── Dockerfile, docker-compose.yml
│   └── README.md                        # full technical docs
│
├── College API Design/                  # design + source assets (read-only)
│   ├── DreamCollege_CDS_Template V1.0.json    # canonical CDS schema
│   ├── DreamCollege_CDS_Field_Catalog Final V1.0.xlsx
│   ├── Refer to the Collegescoard API_*.docx  # API conventions reference
│   ├── cds-catalog-parser V1.0.skill
│   └── 10 Json files for Universities/        # per-school CDS data (JSON + PDF)
│
├── data/                                # gitignored; SQLite DB lives here for local non-docker runs
└── README.md                            # this file
```

---

## What the API does

- **Lookup by IPEDS ID** — `GET /v1/schools/166027` returns Harvard's full CDS (latest year by default; pass `?year=2024-2025` for a specific one).
- **Search** — `GET /v1/schools?school.name=harv&school.state=MA` returns a paginated, lean list of `{ipeds_id, name, state, city, cds_year}` for autocomplete-style discovery.
- **Field projection** — `?fields=cds_meta.school_name,cds_admissions.test_scores` trims the response to just the paths you want.
- **Scorecard-style envelope** — every response is `{metadata: {total, page, per_page}, results: [...]}`.
- **Auth** — single shared `api_key` (query param or `x-api-key` header) on all data endpoints.
- **Interactive docs** — Swagger UI at `/v1/docs`, raw OpenAPI 3.0 at `/v1/openapi.json`.

Full endpoint reference, request/response examples, and config in [`api/README.md`](api/README.md).

---

## Quick start (Docker)

Requires Docker Desktop running.

```bash
cd api
cp .env.example .env          # default API_KEY = dev-key-change-me
npm run docker:start          # builds image, starts container, waits for health
```

Then open **http://localhost:8080/v1/docs** — click **Authorize**, paste the `API_KEY`, and try any endpoint.

Quick smoke test:

```bash
KEY=dev-key-change-me
curl "http://localhost:8080/v1/health"
curl "http://localhost:8080/v1/schools/166027?api_key=$KEY"           # Harvard
curl "http://localhost:8080/v1/schools?school.state=MA&api_key=$KEY"  # search
```

When done: `npm run docker:stop` (keeps DB volume) or `npm run docker:reset` (wipes and reseeds).

---

## Refreshing the dataset (rebuild-driven)

For routine refreshes, **edit JSON files in `data/input/` and rebuild the image** — the API will reflect the new data with no manual DB commands needed:

```bash
# 1. Drop or update CDS JSON files (one per school) in data/input/
ls data/input/                          # 9 starter universities are already there

# 2. Rebuild and restart
cd api
npm run docker:start                    # rebuilds image, wipes volume DB, reloads from data/input/
```

How it works:

- `scripts/start.sh` stages every `*.json` from `data/input/` into `api/seed/`, generates a fresh `BUILD_ID` timestamp, and passes it as a Docker build arg.
- The Dockerfile bakes a fresh SQLite DB into the image at build time using `admin.js bulk --reset` — the same code path as ad-hoc admin edits.
- On container start, the server compares the image's `BUILD_ID` to the one stored on the volume. **Different → swap baked DB onto the volume (wipes prior admin edits). Same → preserve current state.**
- Plain `docker compose restart` (no rebuild) keeps your in-flight admin edits.
- Rebuild = always fresh from `data/input/`.

See [`data/input/README.md`](data/input/README.md) for file format and details.

---

## Ad-hoc edits without rebuilding

Use the admin utility for one-off insert/update/delete that you don't want to commit to `data/input/`. Edits live on the SQLite volume until the next rebuild:

```bash
cd api
bash scripts/admin.sh add ./new-school.json                   # insert (errors if exists)
bash scripts/admin.sh upsert ./new-school.json                # insert-or-overwrite
bash scripts/admin.sh delete 166027 --year 2024-2025          # delete one year
bash scripts/admin.sh list --state MA                         # filterable table
bash scripts/admin.sh show 166027                             # full CDS JSON
```

Input JSON must match the [CDS template schema](College%20API%20Design/DreamCollege%20_CDS_Template%20V1.0.json) (top-level `cds_meta` with `ipeds_id`, `cds_year`, `school_name`). Full reference in [`api/README.md`](api/README.md#admin-utility--managing-school-records).

---

## How data flows

```
┌────────────────────────────────┐
│ College API Design/            │
│   10 Json files for ...        │   per-school CDS JSON files (extracted from PDFs)
└──────────────┬─────────────────┘
               │  scripts/start.sh stages into api/seed/ at build time
               ▼
┌────────────────────────────────┐
│ Docker container               │
│  Express + node:sqlite         │   first-run ingest: JSON → SQLite (idempotent)
│   /data/cds.db (volume)        │
└──────────────┬─────────────────┘
               │  GET /v1/schools/:id  /  GET /v1/schools?q=…
               ▼
       front-end web UI
```

- The CDS JSON files in `College API Design/10 Json files for Universities/` are the **source of truth**.
- On first container start, `server.js` auto-ingests them into SQLite (`/data/cds.db`, persisted on a named volume). Re-running is a no-op.
- All reads go through SQLite — the API never touches the source JSONs at request time.
- To refresh the DB after editing source JSONs: `npm run docker:reset` (prompts) or `FORCE=1 npm run docker:reset`.

---

## Design decisions

A few choices that shape the codebase, kept brief:

- **SQLite, not Postgres.** Embedded, zero-ops, fits the current dataset (10 schools, scaling to a few thousand). The schema (`(ipeds_id, cds_year)` PK + indexed `name`/`state` + `payload TEXT` JSON blob) is hybrid: cheap field-level lookups today, easy to add indexed columns later, and the JSON contract stays loose while the CDS template evolves. If horizontal scale becomes necessary, the schema translates 1:1 to Postgres (`TEXT` → `text`, `payload TEXT` → `jsonb`).
- **One container, not two.** SQLite is a library, not a server, so "containerize the DB separately" doesn't apply — there is no daemon. The `.db` file lives on a Docker named volume mounted at `/data`, surviving image rebuilds.
- **IPEDS ID as the primary key.** Already present in every CDS JSON, globally unique, real-world meaningful — no synthetic ID layer needed.
- **Scorecard-inspired, not Scorecard-mirrored.** Same envelope shape, same `api_key` query-param auth, same dot-notation filter style (`school.name`, `school.state`) — but tailored to the CDS schema rather than a literal clone of Scorecard's field paths.
- **Plain JS, no TypeScript.** Per project preference.
- **`node:sqlite` instead of `better-sqlite3`.** Same SQLite engine, no native compile step (which was failing on Node 24 + macOS Xcode toolchain locally).

---

## Tests

From `api/`:

```bash
npm test                  # 63 tests across 8 files
npm run test:unit         # unit tests only
npm run test:integration  # supertest against real SQLite + Express
```

CI-friendly exit codes; integration tests use isolated in-memory SQLite seeded with the fixtures.

---

## Roadmap notes

- Add more schools by dropping new CDS JSONs into `College API Design/10 Json files for Universities/` matching the [`DreamCollege_CDS_Template V1.0.json`](College%20API%20Design/DreamCollege_CDS_Template%20V1.0.json) shape, then `npm run docker:reset`.
- Per-client API keys (currently one shared key in `API_KEY`) can be added without breaking the contract — wire a small `keys.json` allowlist into `src/middleware/auth.js`.
- Cloud deployment: any platform that can run a Docker image with a persistent volume at `/data` (Fly.io, Render, Cloud Run with a mounted GCS bucket, Fargate + EFS). Health-check path is `/v1/health`.

For full technical detail (env vars, project structure, error shapes, gotchas), see [**api/README.md**](api/README.md).
