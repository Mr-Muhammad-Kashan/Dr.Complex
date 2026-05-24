const path = require('path');
require('dotenv').config();
const { createApp } = require('./app');
const { openDb, countSchools } = require('./db');
const { ingestIfEmpty } = require('./ingest');
const { maybeRefreshDb } = require('./bootstrap');

function start() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const apiKey = process.env.API_KEY;
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  const docsEnabled = String(process.env.DOCS_ENABLED || 'true').toLowerCase() !== 'false';
  const dbPath = process.env.DB_PATH || './data/cds.db';
  const ingestDir = process.env.INGEST_DIR
    || path.resolve(__dirname, '../../College API Design/10 Json files for Universities');

  if (!apiKey) {
    console.error('FATAL: API_KEY env var is required. Copy .env.example to .env and set it.');
    process.exit(1);
  }

  // Build-ID refresh: if the image was rebuilt since the volume's DB was last
  // synced, swap the baked /app/seed.db onto dbPath (wiping any admin edits
  // since the previous build). No-op when running outside the container.
  const refresh = maybeRefreshDb({ dbPath });
  if (refresh.refresh) {
    console.log(
      `[startup] DB refreshed from baked image (${refresh.reason}; `
      + `image=${refresh.imageBuildId}, was=${refresh.dbBuildId || 'none'})`,
    );
  } else {
    console.log(
      `[startup] DB not refreshed (${refresh.reason}; `
      + `image=${refresh.imageBuildId || 'none'}, db=${refresh.dbBuildId || 'none'})`,
    );
  }

  const db = openDb(dbPath);
  // If we have no baked DB and the volume is empty (e.g. local dev), fall back
  // to the per-file ingest from INGEST_DIR. No-op when the DB is already populated.
  if (countSchools(db) === 0) {
    const ingestResult = ingestIfEmpty(db, ingestDir);
    if (ingestResult.reason !== 'db_not_empty') {
      console.log(
        `[startup] Fallback ingest from ${ingestDir}: ${ingestResult.ingested} loaded, ${ingestResult.skipped} skipped`,
      );
      if (ingestResult.errors.length) {
        console.warn('[startup] Ingest errors:');
        for (const e of ingestResult.errors) console.warn('  -', e);
      }
    }
  }

  const app = createApp({ db, dbPath, apiKey, corsOrigin, docsEnabled });

  const server = app.listen(port, () => {
    console.log(`[startup] College CDS API listening on http://localhost:${port}`);
    if (docsEnabled) {
      console.log(`[startup] Docs at  http://localhost:${port}/v1/docs`);
      console.log(`[startup] OpenAPI at http://localhost:${port}/v1/openapi.json`);
    }
  });

  const shutdown = (signal) => {
    console.log(`[shutdown] ${signal} received, closing server`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  start();
}

module.exports = { start };
