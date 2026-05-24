#!/usr/bin/env node
const fs = require('fs');
require('dotenv').config();
const { openDb, upsertSchool, getSchoolById, wipeSchools, countSchools } = require('./db');
const { validateCdsPayload, rowFromPayload, ingestDirectory } = require('./ingest');

const EXIT = {
  OK: 0,
  USAGE: 1,
  CONFLICT: 2,
  NOT_FOUND: 3,
  VALIDATION: 4,
};

function readJsonSource(source) {
  let raw;
  if (!source || source === '-') {
    raw = fs.readFileSync(0, 'utf8');
  } else {
    if (!fs.existsSync(source)) {
      throw new Error(`file not found: ${source}`);
    }
    raw = fs.readFileSync(source, 'utf8');
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid JSON: ${err.message}`);
  }
}

function cmdAdd(db, source) {
  let data;
  try { data = readJsonSource(source); } catch (err) {
    console.error(`[error] ${err.message}`);
    return EXIT.USAGE;
  }
  const errors = validateCdsPayload(data, source || '<stdin>');
  if (errors.length) {
    for (const e of errors) console.error(`[error] ${e}`);
    return EXIT.VALIDATION;
  }
  const row = rowFromPayload(data);
  const exists = db.prepare(
    'SELECT 1 AS x FROM schools WHERE ipeds_id = ? AND cds_year = ?',
  ).get(row.ipeds_id, row.cds_year);
  if (exists) {
    console.error(
      `[error] record already exists for (ipeds_id=${row.ipeds_id}, cds_year=${row.cds_year}). `
      + `Use 'upsert' to overwrite.`,
    );
    return EXIT.CONFLICT;
  }
  db.prepare(`
    INSERT INTO schools (ipeds_id, cds_year, name, state, city, payload, ingested_at)
    VALUES (@ipeds_id, @cds_year, @name, @state, @city, @payload, @ingested_at)
  `).run(row);
  console.log(`[ok] added ${row.name} (ipeds_id=${row.ipeds_id}, cds_year=${row.cds_year})`);
  return EXIT.OK;
}

function cmdUpsert(db, source) {
  let data;
  try { data = readJsonSource(source); } catch (err) {
    console.error(`[error] ${err.message}`);
    return EXIT.USAGE;
  }
  const errors = validateCdsPayload(data, source || '<stdin>');
  if (errors.length) {
    for (const e of errors) console.error(`[error] ${e}`);
    return EXIT.VALIDATION;
  }
  const row = rowFromPayload(data);
  const before = db.prepare(
    'SELECT 1 AS x FROM schools WHERE ipeds_id = ? AND cds_year = ?',
  ).get(row.ipeds_id, row.cds_year);
  upsertSchool(db, row);
  const verb = before ? 'updated' : 'inserted';
  console.log(`[ok] ${verb} ${row.name} (ipeds_id=${row.ipeds_id}, cds_year=${row.cds_year})`);
  return EXIT.OK;
}

function cmdDelete(db, ipedsId, { year } = {}) {
  if (!ipedsId) {
    console.error('[error] delete requires an IPEDS ID');
    return EXIT.USAGE;
  }
  let info;
  if (year) {
    info = db.prepare(
      'DELETE FROM schools WHERE ipeds_id = ? AND cds_year = ?',
    ).run(ipedsId, year);
  } else {
    info = db.prepare('DELETE FROM schools WHERE ipeds_id = ?').run(ipedsId);
  }
  if (info.changes === 0) {
    console.error(
      `[error] no record matched ipeds_id=${ipedsId}${year ? ` year=${year}` : ''}`,
    );
    return EXIT.NOT_FOUND;
  }
  console.log(`[ok] deleted ${info.changes} record(s)`);
  return EXIT.OK;
}

function cmdList(db, { name, state } = {}) {
  const where = [];
  const params = [];
  if (name) { where.push('name LIKE ? COLLATE NOCASE'); params.push(`%${name}%`); }
  if (state) { where.push('state = ?'); params.push(state.toUpperCase()); }
  const sql = `
    SELECT ipeds_id, name, state, city, cds_year
      FROM schools
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY name COLLATE NOCASE ASC, cds_year DESC
  `;
  const rows = db.prepare(sql).all(...params);
  if (rows.length === 0) {
    console.log('(no records)');
    return EXIT.OK;
  }
  const COLS = [
    { key: 'ipeds_id', label: 'IPEDS', w: 8 },
    { key: 'name',     label: 'NAME',  w: 42 },
    { key: 'state',    label: 'ST',    w: 4 },
    { key: 'city',     label: 'CITY',  w: 22 },
    { key: 'cds_year', label: 'YEAR',  w: 10 },
  ];
  const fmt = (r) => COLS.map((c) => String(r[c.key] ?? '').slice(0, c.w).padEnd(c.w)).join(' ');
  console.log(fmt(Object.fromEntries(COLS.map((c) => [c.key, c.label]))));
  console.log('-'.repeat(COLS.reduce((s, c) => s + c.w + 1, 0)));
  for (const r of rows) console.log(fmt(r));
  console.log(`\n${rows.length} record(s)`);
  return EXIT.OK;
}

function cmdBulk(db, dir, { reset = false } = {}) {
  if (!dir) {
    console.error('[error] bulk requires a directory path');
    return EXIT.USAGE;
  }
  if (!fs.existsSync(dir)) {
    console.error(`[error] directory not found: ${dir}`);
    return EXIT.USAGE;
  }
  if (reset) {
    const removed = wipeSchools(db);
    console.log(`[ok] reset: removed ${removed} existing record(s)`);
  }
  const result = ingestDirectory(db, dir);
  for (const e of result.errors) console.error(`[error] ${e}`);
  console.log(
    `[ok] bulk ${reset ? 'reload' : 'upsert'} from ${dir}: `
    + `${result.ingested} loaded, ${result.skipped} skipped, ${countSchools(db)} total`,
  );
  return result.errors.length ? EXIT.VALIDATION : EXIT.OK;
}

function cmdShow(db, ipedsId, { year } = {}) {
  if (!ipedsId) {
    console.error('[error] show requires an IPEDS ID');
    return EXIT.USAGE;
  }
  const data = getSchoolById(db, ipedsId, year);
  if (!data) {
    console.error(
      `[error] no record for ipeds_id=${ipedsId}${year ? ` year=${year}` : ''}`,
    );
    return EXIT.NOT_FOUND;
  }
  console.log(JSON.stringify(data, null, 2));
  return EXIT.OK;
}

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function usage() {
  process.stdout.write(`College CDS API admin utility

Usage:
  admin.js add <file|->                          insert one CDS JSON; errors if (ipeds_id, year) exists
  admin.js upsert <file|->                       insert or overwrite (alias: update)
  admin.js delete <ipeds_id> [--year YYYY-YYYY]  delete record(s); all years if --year omitted
  admin.js list [--name N] [--state ST]          list schools (filterable)
  admin.js show <ipeds_id> [--year YYYY-YYYY]    print full CDS JSON for one record
  admin.js bulk <dir> [--reset]                  upsert every *.json in dir; --reset wipes first

Input:
  Provide a file path, or '-' (or omit) to read JSON from stdin.

Env:
  DB_PATH    path to SQLite file (default: ./data/cds.db)

Exit codes:
  0 ok   1 usage   2 conflict   3 not found   4 validation
`);
}

function runCli(argv = process.argv.slice(2), opts = {}) {
  const [cmd, ...rest] = argv;
  if (!cmd || ['help', '-h', '--help'].includes(cmd)) {
    usage();
    return EXIT.OK;
  }
  const dbPath = opts.dbPath || process.env.DB_PATH || './data/cds.db';
  const db = opts.db || openDb(dbPath);
  const ownsDb = !opts.db;
  let code = EXIT.OK;
  try {
    switch (cmd) {
      case 'add': {
        const { positional } = parseFlags(rest);
        code = cmdAdd(db, positional[0]);
        break;
      }
      case 'upsert':
      case 'update': {
        const { positional } = parseFlags(rest);
        code = cmdUpsert(db, positional[0]);
        break;
      }
      case 'delete': {
        const { flags, positional } = parseFlags(rest);
        code = cmdDelete(db, positional[0], { year: flags.year });
        break;
      }
      case 'list': {
        const { flags } = parseFlags(rest);
        code = cmdList(db, { name: flags.name, state: flags.state });
        break;
      }
      case 'show': {
        const { flags, positional } = parseFlags(rest);
        code = cmdShow(db, positional[0], { year: flags.year });
        break;
      }
      case 'bulk': {
        const { flags, positional } = parseFlags(rest);
        code = cmdBulk(db, positional[0], { reset: !!flags.reset });
        break;
      }
      default:
        console.error(`[error] unknown command: ${cmd}`);
        usage();
        code = EXIT.USAGE;
    }
  } finally {
    if (ownsDb) db.close();
  }
  return code;
}

if (require.main === module) {
  process.exit(runCli());
}

module.exports = {
  EXIT,
  cmdAdd,
  cmdUpsert,
  cmdDelete,
  cmdList,
  cmdShow,
  cmdBulk,
  parseFlags,
  runCli,
};
