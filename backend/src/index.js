const createApp = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { initMinio } = require('./infra/minio');
const { connectDatabase, disconnectDatabase } = require('./infra/prisma');
const cache = require('./services/cacheService');

process.on('uncaughtException', (err) => {
  logger.fatal({ err, type: 'uncaughtException' }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason, type: 'unhandledRejection' }, 'Unhandled rejection');
});

async function main() {
  logger.info({ node: process.version, platform: process.platform }, 'Starting server');

  await connectDatabase();
  await initMinio();
  cache.getRedis();
  logger.info({ cache: cache.enabled ? 'connected' : 'unavailable' }, 'All infrastructure initialized');

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDatabase();
      try {
        const r = await cache.getRedis();
        if (r) await r.quit();
      } catch { /* ignore */ }
      logger.info('Database disconnected');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});