const express = require('express');
const { countSchools } = require('../db');

function healthRouter(getDb, getDbPath) {
  const router = express.Router();
  router.get('/', (req, res, next) => {
    try {
      const db = getDb();
      res.json({
        status: 'ok',
        schools_loaded: countSchools(db),
        db_path: getDbPath ? getDbPath() : null,
        uptime_seconds: Math.round(process.uptime()),
      });
    } catch (err) {
      next(err);
    }
  });
  return router;
}

module.exports = { healthRouter };
