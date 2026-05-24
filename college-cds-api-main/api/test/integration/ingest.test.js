const { openDb, countSchools } = require('../../src/db');
const { ingestDirectory } = require('../../src/ingest');
const { FIXTURE_DIR } = require('./helpers');

describe('Ingest idempotency', () => {
  it('running ingest twice yields the same row count', () => {
    const db = openDb(':memory:');
    const first = ingestDirectory(db, FIXTURE_DIR);
    const countAfterFirst = countSchools(db);
    const second = ingestDirectory(db, FIXTURE_DIR);
    const countAfterSecond = countSchools(db);
    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(countAfterFirst).toBe(countAfterSecond);
    expect(first.ingested).toBe(second.ingested);
    db.close();
  });
});
