const request = require('supertest');
const { buildTestApp, TEST_API_KEY } = require('./helpers');

let app;
let db;

beforeAll(() => {
  ({ app, db } = buildTestApp());
});

afterAll(() => {
  if (db) db.close();
});

describe('Auth', () => {
  it('rejects request with no api_key', async () => {
    const res = await request(app).get('/v1/schools');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/missing/i);
  });

  it('rejects request with wrong api_key', async () => {
    const res = await request(app).get('/v1/schools').query({ api_key: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid/i);
  });

  it('accepts api_key via x-api-key header', async () => {
    const res = await request(app)
      .get('/v1/schools')
      .set('x-api-key', TEST_API_KEY);
    expect(res.status).toBe(200);
  });

  it('rejects unknown route with 404 (after auth passes)', async () => {
    const res = await request(app)
      .get('/v1/nonsense')
      .query({ api_key: TEST_API_KEY });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(404);
  });
});
