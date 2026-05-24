const express = require('express');
const { buildCors } = require('./middleware/cors');
const { apiKeyAuth } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const { schoolsRouter } = require('./routes/schools');
const { healthRouter } = require('./routes/health');
const { docsRouter } = require('./routes/docs');

function createApp({ db, dbPath, apiKey, corsOrigin, docsEnabled = true }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(buildCors(corsOrigin));
  app.use(express.json());

  app.use(apiKeyAuth(() => apiKey));

  app.use('/v1/health', healthRouter(() => db, () => dbPath));
  if (docsEnabled) {
    app.use('/v1', docsRouter());
  }
  app.use('/v1/schools', schoolsRouter(() => db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
