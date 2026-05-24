const path = require('path');
const { openDb } = require('../../src/db');
const { ingestDirectory } = require('../../src/ingest');
const { createApp } = require('../../src/app');

const FIXTURE_DIR = path.resolve(
  __dirname,
  '../../../College API Design/10 Json files for Universities',
);

const TEST_API_KEY = 'test-key';

function buildTestApp() {
  const db = openDb(':memory:');
  const ingest = ingestDirectory(db, FIXTURE_DIR);
  const app = createApp({
    db,
    dbPath: ':memory:',
    apiKey: TEST_API_KEY,
    corsOrigin: '*',
    docsEnabled: true,
  });
  return { app, db, ingest };
}

module.exports = { buildTestApp, TEST_API_KEY, FIXTURE_DIR };
