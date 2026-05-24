const request = require('supertest');
const { buildTestApp } = require('./helpers');

let app;
let db;

beforeAll(() => {
  ({ app, db } = buildTestApp());
});

afterAll(() => {
  if (db) db.close();
});

describe('Public endpoints (no api_key)', () => {
  it('GET /v1/health returns ok and school count', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.schools_loaded).toBeGreaterThan(0);
    expect(typeof res.body.uptime_seconds).toBe('number');
  });

  it('GET /v1/openapi.json returns the spec', async () => {
    const res = await request(app).get('/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toMatch(/college/i);
    expect(res.body.paths['/v1/schools']).toBeDefined();
    expect(res.body.paths['/v1/schools/{ipeds_id}']).toBeDefined();
  });

  it('GET /v1/docs serves Swagger UI HTML', async () => {
    const res = await request(app).get('/v1/docs/').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger/i);
  });
});
