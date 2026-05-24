const fs = require('fs');
const os = require('os');
const path = require('path');
const { decideRefresh, maybeRefreshDb, dbBuildIdPath } = require('../../src/bootstrap');
const { openDb, upsertSchool, countSchools } = require('../../src/db');
const { rowFromPayload } = require('../../src/ingest');

describe('decideRefresh', () => {
  it('skips when image has no BUILD_ID', () => {
    const d = decideRefresh({ imageBuildId: null, dbBuildId: 'x', bakedDbExists: true, dbExists: true });
    expect(d.refresh).toBe(false);
    expect(d.reason).toBe('no_image_build_id');
  });
  it('skips when no baked DB exists (local dev)', () => {
    const d = decideRefresh({ imageBuildId: 'a', dbBuildId: 'a', bakedDbExists: false, dbExists: true });
    expect(d.refresh).toBe(false);
    expect(d.reason).toBe('no_baked_db');
  });
  it('refreshes on first-ever start (no DB yet)', () => {
    const d = decideRefresh({ imageBuildId: 'a', dbBuildId: null, bakedDbExists: true, dbExists: false });
    expect(d.refresh).toBe(true);
    expect(d.reason).toBe('fresh_volume');
  });
  it('refreshes when build ids differ (rebuild)', () => {
    const d = decideRefresh({ imageBuildId: 'b', dbBuildId: 'a', bakedDbExists: true, dbExists: true });
    expect(d.refresh).toBe(true);
    expect(d.reason).toBe('build_id_mismatch');
  });
  it('preserves DB when build ids match (restart)', () => {
    const d = decideRefresh({ imageBuildId: 'a', dbBuildId: 'a', bakedDbExists: true, dbExists: true });
    expect(d.refresh).toBe(false);
    expect(d.reason).toBe('build_id_matches');
  });
});

describe('maybeRefreshDb (filesystem)', () => {
  let workDir;
  let dbPath;
  let bakedDbPath;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-'));
    dbPath = path.join(workDir, 'data', 'cds.db');
    bakedDbPath = path.join(workDir, 'baked.db');
    // Build a non-trivial baked DB so we can verify it gets copied.
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const seed = openDb(bakedDbPath);
    upsertSchool(seed, rowFromPayload({
      cds_meta: { ipeds_id: '111', cds_year: '2025-2026', school_name: 'Baked U' },
    }));
    seed.close();
  });
  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('does nothing when image BUILD_ID is missing', () => {
    const r = maybeRefreshDb({ dbPath, bakedDbPath, imageBuildId: '' });
    expect(r.refresh).toBe(false);
    expect(fs.existsSync(dbPath)).toBe(false);
  });

  it('copies baked DB to dbPath on first run and writes build_id', () => {
    const r = maybeRefreshDb({ dbPath, bakedDbPath, imageBuildId: 'build-1' });
    expect(r.refresh).toBe(true);
    expect(r.reason).toBe('fresh_volume');
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(fs.readFileSync(dbBuildIdPath(dbPath), 'utf8').trim()).toBe('build-1');
    const live = openDb(dbPath);
    expect(countSchools(live)).toBe(1);
    live.close();
  });

  it('preserves dbPath when build ids match', () => {
    maybeRefreshDb({ dbPath, bakedDbPath, imageBuildId: 'build-1' });
    // Pretend the user made an admin edit:
    const live = openDb(dbPath);
    upsertSchool(live, rowFromPayload({
      cds_meta: { ipeds_id: '222', cds_year: '2024-2025', school_name: 'Edited U' },
    }));
    live.close();

    const r = maybeRefreshDb({ dbPath, bakedDbPath, imageBuildId: 'build-1' });
    expect(r.refresh).toBe(false);
    expect(r.reason).toBe('build_id_matches');
    const live2 = openDb(dbPath);
    expect(countSchools(live2)).toBe(2);
    live2.close();
  });

  it('wipes the volume when image build_id changes (rebuild scenario)', () => {
    maybeRefreshDb({ dbPath, bakedDbPath, imageBuildId: 'build-1' });
    const live = openDb(dbPath);
    upsertSchool(live, rowFromPayload({
      cds_meta: { ipeds_id: '222', cds_year: '2024-2025', school_name: 'Edited U' },
    }));
    live.close();

    const r = maybeRefreshDb({ dbPath, bakedDbPath, imageBuildId: 'build-2' });
    expect(r.refresh).toBe(true);
    expect(r.reason).toBe('build_id_mismatch');
    const live2 = openDb(dbPath);
    expect(countSchools(live2)).toBe(1);
    live2.close();
    expect(fs.readFileSync(dbBuildIdPath(dbPath), 'utf8').trim()).toBe('build-2');
  });
});
