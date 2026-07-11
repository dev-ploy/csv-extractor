const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const config = require('./config');
const { errorHandler } = require('./middlewares/errorHandler');
const { createRateLimiter } = require('./middlewares/rateLimiter');
const createApiRouter = require('./routes');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(morgan(config.isDev ? 'dev' : 'combined'));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/', createRateLimiter(config));
  app.use('/api', createApiRouter());
  app.use(errorHandler);

  return app;
}

module.exports = createApp;