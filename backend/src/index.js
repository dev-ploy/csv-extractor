const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { initMinio } = require('./storage/minioClient');
const { connectDatabase, disconnectDatabase } = require('./db/connection');

async function main() {
  // 1. Initialize infrastructure
  await connectDatabase();
  await initMinio(config);
  logger.info('All infrastructure initialized');

  // 2. Start HTTP server
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
  });

  // 3. Graceful shutdown — close DB, drain connections
  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => { logger.error('Forced shutdown'); process.exit(1); }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});