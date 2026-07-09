const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { errorHandler } = require('./middlewares/errorHandler');
const { createRateLimiter } = require('./middlewares/rateLimiter');
const { buildContainer } = require('./container');
const createCsvRouter = require('./controllers/csvController');
const { checkDatabaseHealth } = require('./db/connection');

function createApp() {
  const app = express();
  const container = buildContainer();

  // Security & performance
  app.use(helmet());
  app.use(cors({ origin: container.config.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(morgan(container.config.isDev ? 'dev' : 'combined'));
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting
  app.use('/api/', createRateLimiter(container.config));

  // Health check — includes DB status
  app.get('/api/health', async (req, res) => {
    const dbHealth = await checkDatabaseHealth();
    res.json({
      status: dbHealth.status === 'healthy' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth.status,
    });
  });

  // Routes
  app.use('/api/csv', createCsvRouter(container));

  // Global error handler
  app.use(errorHandler);

  return app;
}

module.exports = createApp;