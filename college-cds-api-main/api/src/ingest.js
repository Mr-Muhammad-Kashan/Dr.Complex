const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { openDb, upsertSchool, countSchools } = require('./db');

function validateCdsPayload(parsed, filename) {
  const errors = [];
  if (!parsed || typeof parsed !== 'object') {
    return [`${filename}: not a JSON object`];
  }
  const meta = parsed.cds_meta;
  if (!meta || typeof meta !== 'object') {
    errors.push(`${filename}: missing cds_meta`);
    return errors;
  }
  if (!meta.ipeds_id || typeof meta.ipeds_id !== 'string') {
    errors.push(`${filename}: cds_meta.ipeds_id must be a non-empty string`);
  }
  if (!meta.cds_year || typeof meta.cds_year !== 'string') {
    errors.push(`${filename}: cds_meta.cds_year must be a non-empty string`);
  }
  if (!meta.school_name || typeof meta.school_name !== 'string') {
    errors.push(`${filename}: cds_meta.school_name must be a non-empty string`);
  }
  return errors;
}

function rowFromPayload(parsed) {
  const meta = parsed.cds_meta;
  return {
    ipeds_id: meta.ipeds_id,
    cds_year: meta.cds_year,
    name: meta.school_name,
    state: meta.state || null,
    city: meta.city || null,
    payload: JSON.stringify(parsed),
    ingested_at: new Date().toISOString(),
  };
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .map((f) => path.join(dir, f));
}

function ingestDirectory(db, dir) {
  const files = listJsonFiles(dir);
  const result = { ingested: 0, skipped: 0, errors: [] };
  for (const filePath of files) {
    const filename = path.basename(filePath);
    let parsed;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      parsed = JSON.parse(raw);
    } catch (err) {
      result.errors.push(`${filename}: invalid JSON — ${err.message}`);
      result.skipped += 1;
      continue;
    }
    const errors = validateCdsPayload(parsed, filename);
    if (errors.length) {
      result.errors.push(...errors);
      result.skipped += 1;
      continue;
    }
    upsertSchool(db, rowFromPayload(parsed));
    result.ingested += 1;
  }
  return result;
}

function ingestIfEmpty(db, dir) {
  if (countSchools(db) > 0) {
    return { ingested: 0, skipped: 0, errors: [], reason: 'db_not_empty' };
  }
  return ingestDirectory(db, dir);
}

if (require.main === module) {
  const dbPath = process.env.DB_PATH || './data/cds.db';
  const ingestDir = process.env.INGEST_DIR
    || path.resolve(__dirname, '../../College API Design/10 Json files for Universities');
  const db = openDb(dbPath);
  const result = ingestDirectory(db, ingestDir);
  console.log(`Ingest complete: ${result.ingested} ingested, ${result.skipped} skipped`);
  if (result.errors.length) {
    console.error('Errors:');
    for (const e of result.errors) console.error('  -', e);
  }
  db.close();
  process.exit(result.errors.length ? 1 : 0);
}

module.exports = {
  validateCdsPayload,
  rowFromPayload,
  listJsonFiles,
  ingestDirectory,
  ingestIfEmpty,
};
