const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const createCsvRouter = require('./csv');
const createAuthRouter = require('./auth');
const { checkDatabaseHealth } = require('../infra/prisma');
const { authenticate, checkPermission } = require('../services/authService');
const { getRecentErrors } = require('../middlewares/errorHandler');
const cache = require('../services/cacheService');

function createApiRouter() {
  const router = Router();

  // Request ID + timing for every request
  router.use((req, res, next) => {
    req.id = uuidv4();
    req.startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      if (res.statusCode >= 400) {
        logger.warn({ requestId: req.id, method: req.method, path: req.path, status: res.statusCode, duration, userId: req.user?.id }, 'request');
      }
    });
    next();
  });

  router.get('/health', async (req, res) => {
    const dbHealth = await checkDatabaseHealth();
    const cacheHealth = cache.enabled ? 'healthy' : 'unavailable';
    res.json({
      status: dbHealth.status === 'healthy' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth.status,
      cache: cacheHealth,
    });
  });

  router.get('/errors', authenticate, checkPermission('manage_users'), (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ data: getRecentErrors(limit) });
  });

  router.use('/auth', createAuthRouter());
  router.use('/csv', createCsvRouter());

  return router;
}

module.exports = createApiRouter;