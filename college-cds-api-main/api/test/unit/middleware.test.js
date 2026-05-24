const { apiKeyAuth, isPublic } = require('../../src/middleware/auth');
const { errorHandler, notFoundHandler } = require('../../src/middleware/error');

function makeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('isPublic', () => {
  it('whitelists health, docs, openapi.json', () => {
    expect(isPublic('/v1/health')).toBe(true);
    expect(isPublic('/v1/docs')).toBe(true);
    expect(isPublic('/v1/docs/swagger-ui.css')).toBe(true);
    expect(isPublic('/v1/openapi.json')).toBe(true);
  });
  it('treats protected routes as not public', () => {
    expect(isPublic('/v1/schools')).toBe(false);
    expect(isPublic('/v1/schools/166027')).toBe(false);
  });
});

describe('apiKeyAuth', () => {
  const mw = apiKeyAuth(() => 'secret-key');

  it('passes through on public paths', () => {
    const next = vi.fn();
    mw({ path: '/v1/health', query: {}, get: () => undefined }, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects missing key', () => {
    const next = vi.fn();
    mw({ path: '/v1/schools', query: {}, get: () => undefined }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('rejects wrong key', () => {
    const next = vi.fn();
    mw({ path: '/v1/schools', query: { api_key: 'wrong' }, get: () => undefined }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('accepts correct key in query', () => {
    const next = vi.fn();
    mw({ path: '/v1/schools', query: { api_key: 'secret-key' }, get: () => undefined }, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('accepts correct key in x-api-key header', () => {
    const next = vi.fn();
    mw({ path: '/v1/schools', query: {}, get: (h) => (h === 'x-api-key' ? 'secret-key' : undefined) }, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('500s if server misconfigured', () => {
    const bad = apiKeyAuth(() => undefined);
    const next = vi.fn();
    bad({ path: '/v1/schools', query: {}, get: () => undefined }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
  });
});

describe('errorHandler', () => {
  it('formats errors with code and message', () => {
    const res = makeRes();
    errorHandler({ status: 404, message: 'not found' }, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 404, message: 'not found' } });
  });
  it('defaults to 500 / generic message', () => {
    const res = makeRes();
    const origErr = console.error;
    console.error = () => {};
    try {
      errorHandler(new Error('boom'), {}, res, () => {});
    } finally {
      console.error = origErr;
    }
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('notFoundHandler', () => {
  it('forwards a 404 with route info', () => {
    const next = vi.fn();
    notFoundHandler({ method: 'GET', path: '/v1/nope' }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      message: expect.stringContaining('/v1/nope'),
    }));
  });
});
