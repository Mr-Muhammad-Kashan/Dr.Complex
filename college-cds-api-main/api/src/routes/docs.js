const fs = require('fs');
const path = require('path');
const express = require('express');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');

function loadOpenApi() {
  const specPath = path.resolve(__dirname, '../openapi.yaml');
  const raw = fs.readFileSync(specPath, 'utf8');
  return YAML.parse(raw);
}

function docsRouter() {
  const spec = loadOpenApi();
  const router = express.Router();

  router.get('/openapi.json', (req, res) => res.json(spec));

  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'College CDS API — Docs',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  return router;
}

module.exports = { docsRouter, loadOpenApi };
