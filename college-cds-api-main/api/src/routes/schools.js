const express = require('express');
const { getSchoolById, searchSchools } = require('../db');
const { envelope } = require('../lib/envelope');
const { parseFields, project, leanResult } = require('../lib/projection');

function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function schoolsRouter(getDb) {
  const router = express.Router();

  router.get('/', (req, res, next) => {
    try {
      const db = getDb();
      const name = req.query['school.name'];
      const state = req.query['school.state'];
      const year = req.query.year;
      const perPage = clampInt(req.query.per_page, 1, 100, 20);
      const page = clampInt(req.query.page, 0, 1_000_000, 0);
      const fields = parseFields(req.query.fields);

      const { total, rows } = searchSchools(db, { name, state, year, page, perPage });

      const results = rows.map((row) => {
        if (fields) {
          return project(JSON.parse(row.payload), fields);
        }
        return leanResult(row);
      });

      res.json(envelope({ results, total, page, perPage }));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:ipeds_id', (req, res, next) => {
    try {
      const db = getDb();
      const { ipeds_id: ipedsId } = req.params;
      const year = req.query.year;
      const fields = parseFields(req.query.fields);

      const payload = getSchoolById(db, ipedsId, year);
      if (!payload) {
        const detail = year ? ` for year ${year}` : '';
        return next({ status: 404, message: `School ${ipedsId} not found${detail}` });
      }
      const projected = fields ? project(payload, fields) : payload;
      res.json(envelope({ results: [projected], total: 1, page: 0, perPage: 1 }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { schoolsRouter };
