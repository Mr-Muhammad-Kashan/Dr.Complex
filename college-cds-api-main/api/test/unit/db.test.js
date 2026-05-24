const {
  openDb, upsertSchool, countSchools, getSchoolById, buildSearchQuery, searchSchools,
} = require('../../src/db');

function makeRow(ipeds, year, name, state = 'MA', city = 'Cambridge') {
  return {
    ipeds_id: ipeds,
    cds_year: year,
    name,
    state,
    city,
    payload: JSON.stringify({ cds_meta: { ipeds_id: ipeds, cds_year: year, school_name: name } }),
    ingested_at: new Date().toISOString(),
  };
}

describe('buildSearchQuery', () => {
  it('defaults to latest-year subquery when no year provided', () => {
    const { whereSql, params } = buildSearchQuery({});
    expect(whereSql).toContain('MAX(s2.cds_year)');
    expect(params).toEqual([]);
  });
  it('filters by name with LIKE and case-insensitive collation', () => {
    const { whereSql, params } = buildSearchQuery({ name: 'harv' });
    expect(whereSql).toContain('name LIKE ? COLLATE NOCASE');
    expect(params).toContain('%harv%');
  });
  it('uppercases state', () => {
    const { params } = buildSearchQuery({ state: 'ma' });
    expect(params).toContain('MA');
  });
  it('exact-matches year and skips latest subquery', () => {
    const { whereSql, params } = buildSearchQuery({ year: '2024-2025' });
    expect(whereSql).toContain('cds_year = ?');
    expect(whereSql).not.toContain('MAX(s2.cds_year)');
    expect(params).toContain('2024-2025');
  });
});

describe('DB integration (in-memory)', () => {
  let db;
  beforeEach(() => {
    db = openDb(':memory:');
    upsertSchool(db, makeRow('166027', '2024-2025', 'Harvard University', 'MA'));
    upsertSchool(db, makeRow('166027', '2023-2024', 'Harvard University', 'MA'));
    upsertSchool(db, makeRow('243744', '2025-2026', 'Stanford University', 'CA', 'Stanford'));
  });

  it('countSchools sees all rows', () => {
    expect(countSchools(db)).toBe(3);
  });

  it('getSchoolById returns latest year by default', () => {
    const r = getSchoolById(db, '166027');
    expect(r.cds_meta.cds_year).toBe('2024-2025');
  });

  it('getSchoolById honors explicit year', () => {
    const r = getSchoolById(db, '166027', '2023-2024');
    expect(r.cds_meta.cds_year).toBe('2023-2024');
  });

  it('getSchoolById returns null for missing school', () => {
    expect(getSchoolById(db, '999999')).toBeNull();
  });

  it('searchSchools returns latest-year row per school by default', () => {
    const { total, rows } = searchSchools(db, {});
    expect(total).toBe(2);
    const harvard = rows.find((r) => r.ipeds_id === '166027');
    expect(harvard.cds_year).toBe('2024-2025');
  });

  it('searchSchools filters by name (case-insensitive)', () => {
    const { total, rows } = searchSchools(db, { name: 'HARV' });
    expect(total).toBe(1);
    expect(rows[0].name).toBe('Harvard University');
  });

  it('searchSchools filters by state (case-insensitive)', () => {
    const { total } = searchSchools(db, { state: 'ca' });
    expect(total).toBe(1);
  });

  it('searchSchools paginates', () => {
    const { rows } = searchSchools(db, { perPage: 1, page: 0 });
    expect(rows).toHaveLength(1);
  });

  it('upsertSchool is idempotent on (ipeds_id, cds_year)', () => {
    upsertSchool(db, makeRow('166027', '2024-2025', 'Harvard University v2'));
    expect(countSchools(db)).toBe(3);
    const r = getSchoolById(db, '166027', '2024-2025');
    expect(r.cds_meta.school_name).toBe('Harvard University v2');
  });
});
