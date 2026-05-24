const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schools (
  ipeds_id     TEXT NOT NULL,
  cds_year     TEXT NOT NULL,
  name         TEXT NOT NULL,
  state        TEXT,
  city         TEXT,
  payload      TEXT NOT NULL,
  ingested_at  TEXT NOT NULL,
  PRIMARY KEY (ipeds_id, cds_year)
);
CREATE INDEX IF NOT EXISTS idx_schools_name  ON schools (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_schools_state ON schools (state);
`;

function openDb(dbPath) {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

function upsertSchool(db, row) {
  const stmt = db.prepare(`
    INSERT INTO schools (ipeds_id, cds_year, name, state, city, payload, ingested_at)
    VALUES (@ipeds_id, @cds_year, @name, @state, @city, @payload, @ingested_at)
    ON CONFLICT(ipeds_id, cds_year) DO UPDATE SET
      name        = excluded.name,
      state       = excluded.state,
      city        = excluded.city,
      payload     = excluded.payload,
      ingested_at = excluded.ingested_at
  `);
  return stmt.run(row);
}

function countSchools(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM schools').get().n;
}

function wipeSchools(db) {
  const info = db.prepare('DELETE FROM schools').run();
  return info.changes;
}

function getSchoolById(db, ipedsId, year) {
  if (year) {
    const row = db.prepare(
      'SELECT payload FROM schools WHERE ipeds_id = ? AND cds_year = ?'
    ).get(ipedsId, year);
    return row ? JSON.parse(row.payload) : null;
  }
  const row = db.prepare(
    'SELECT payload FROM schools WHERE ipeds_id = ? ORDER BY cds_year DESC LIMIT 1'
  ).get(ipedsId);
  return row ? JSON.parse(row.payload) : null;
}

function buildSearchQuery({ name, state, year }) {
  const where = [];
  const params = [];
  if (name) {
    where.push('name LIKE ? COLLATE NOCASE');
    params.push(`%${name}%`);
  }
  if (state) {
    where.push('state = ?');
    params.push(state.toUpperCase());
  }
  if (year) {
    where.push('cds_year = ?');
    params.push(year);
  } else {
    where.push(`cds_year = (
      SELECT MAX(s2.cds_year) FROM schools s2 WHERE s2.ipeds_id = schools.ipeds_id
    )`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { whereSql, params };
}

function searchSchools(db, { name, state, year, page = 0, perPage = 20 }) {
  const { whereSql, params } = buildSearchQuery({ name, state, year });
  const total = db.prepare(
    `SELECT COUNT(*) AS n FROM schools ${whereSql}`
  ).get(...params).n;

  const rows = db.prepare(
    `SELECT ipeds_id, cds_year, name, state, city, payload
       FROM schools
       ${whereSql}
       ORDER BY name COLLATE NOCASE ASC
       LIMIT ? OFFSET ?`
  ).all(...params, perPage, page * perPage);

  return { total, rows };
}

module.exports = {
  SCHEMA,
  openDb,
  upsertSchool,
  countSchools,
  wipeSchools,
  getSchoolById,
  buildSearchQuery,
  searchSchools,
};
