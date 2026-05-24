const request = require('supertest');
const { buildTestApp, TEST_API_KEY } = require('./helpers');

let app;
let db;
let ingest;

beforeAll(() => {
  ({ app, db, ingest } = buildTestApp());
});

afterAll(() => {
  if (db) db.close();
});

describe('Ingest sanity', () => {
  it('loads the 10 fixture JSON files', () => {
    expect(ingest.ingested).toBeGreaterThanOrEqual(8);
    expect(ingest.errors).toEqual([]);
  });
});

describe('GET /v1/schools/:ipeds_id', () => {
  it('returns Harvard by IPEDS 166027 with full payload in envelope', async () => {
    const res = await request(app)
      .get('/v1/schools/166027')
      .query({ api_key: TEST_API_KEY });
    expect(res.status).toBe(200);
    expect(res.body.metadata).toEqual({ total: 1, page: 0, per_page: 1 });
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].cds_meta.school_name).toMatch(/harvard/i);
    expect(res.body.results[0].cds_admissions).toBeDefined();
  });

  it('honors ?year= for specific year', async () => {
    const res = await request(app)
      .get('/v1/schools/166027')
      .query({ api_key: TEST_API_KEY, year: '2024-2025' });
    expect(res.status).toBe(200);
    expect(res.body.results[0].cds_meta.cds_year).toBe('2024-2025');
  });

  it('returns 404 for unknown IPEDS', async () => {
    const res = await request(app)
      .get('/v1/schools/999999')
      .query({ api_key: TEST_API_KEY });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 404, message: expect.stringContaining('999999') } });
  });

  it('returns 404 when year does not exist for that school', async () => {
    const res = await request(app)
      .get('/v1/schools/166027')
      .query({ api_key: TEST_API_KEY, year: '1999-2000' });
    expect(res.status).toBe(404);
  });

  it('projects fields when ?fields= is supplied', async () => {
    const res = await request(app)
      .get('/v1/schools/166027')
      .query({ api_key: TEST_API_KEY, fields: 'cds_meta.school_name,cds_meta.ipeds_id' });
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toEqual({
      cds_meta: { school_name: expect.any(String), ipeds_id: '166027' },
    });
  });
});

describe('GET /v1/schools (search)', () => {
  it('returns lean results by default', async () => {
    const res = await request(app)
      .get('/v1/schools')
      .query({ api_key: TEST_API_KEY });
    expect(res.status).toBe(200);
    expect(res.body.metadata.total).toBeGreaterThan(0);
    const first = res.body.results[0];
    expect(first).toHaveProperty('ipeds_id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('cds_year');
    expect(first).not.toHaveProperty('cds_admissions');
  });

  it('filters by school.name (case-insensitive substring)', async () => {
    const res = await request(app)
      .get('/v1/schools')
      .query({ api_key: TEST_API_KEY, 'school.name': 'harv' });
    expect(res.status).toBe(200);
    expect(res.body.metadata.total).toBe(1);
    expect(res.body.results[0].name).toMatch(/harvard/i);
  });

  it('filters by school.state', async () => {
    const res = await request(app)
      .get('/v1/schools')
      .query({ api_key: TEST_API_KEY, 'school.state': 'MA' });
    expect(res.status).toBe(200);
    expect(res.body.results.every((r) => r.state === 'MA')).toBe(true);
  });

  it('respects per_page pagination', async () => {
    const res = await request(app)
      .get('/v1/schools')
      .query({ api_key: TEST_API_KEY, per_page: 2, page: 0 });
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeLessThanOrEqual(2);
    expect(res.body.metadata.per_page).toBe(2);
  });

  it('clamps per_page to 100', async () => {
    const res = await request(app)
      .get('/v1/schools')
      .query({ api_key: TEST_API_KEY, per_page: 9999 });
    expect(res.body.metadata.per_page).toBe(100);
  });

  it('returns projected payloads when ?fields= is set', async () => {
    const res = await request(app)
      .get('/v1/schools')
      .query({ api_key: TEST_API_KEY, 'school.name': 'harv', fields: 'cds_meta.school_name' });
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toEqual({
      cds_meta: { school_name: expect.any(String) },
    });
  });
});
