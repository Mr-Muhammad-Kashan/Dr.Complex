const cors = require('cors');

function buildCors(originEnv) {
  const raw = (originEnv || '*').trim();
  if (raw === '*') {
    return cors({ origin: true });
  }
  const allowList = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowList.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  });
}

module.exports = { buildCors };
