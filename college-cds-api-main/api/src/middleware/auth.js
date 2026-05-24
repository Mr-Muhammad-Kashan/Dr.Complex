const PUBLIC_PREFIXES = ['/v1/health', '/v1/docs', '/v1/openapi.json'];

function isPublic(reqPath) {
  return PUBLIC_PREFIXES.some((p) => reqPath === p || reqPath.startsWith(`${p}/`));
}

function apiKeyAuth(getExpectedKey) {
  return (req, res, next) => {
    if (isPublic(req.path)) return next();
    const expected = getExpectedKey();
    if (!expected) {
      return next({ status: 500, message: 'Server misconfigured: API_KEY not set' });
    }
    const provided = req.query.api_key || req.get('x-api-key');
    if (!provided) {
      return next({ status: 401, message: 'Missing api_key' });
    }
    if (provided !== expected) {
      return next({ status: 401, message: 'Invalid api_key' });
    }
    return next();
  };
}

module.exports = { apiKeyAuth, isPublic, PUBLIC_PREFIXES };
