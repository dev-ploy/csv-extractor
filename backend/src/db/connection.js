const { PrismaClient } = require('@prisma/client');
const config = require('../config');

// Singleton PrismaClient — reuse across the entire app
const prisma = new PrismaClient({
  log: config.isDev
    ? [{ level: 'query', emit: 'event' }, { level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }]
    : [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }],
});

// Log slow queries in dev (queries > 500ms)
if (config.isDev) {
  prisma.$on('query', (e) => {
    if (e.duration > 500) {
      console.warn(`[SLOW QUERY] ${e.duration}ms: ${e.query}`);
    }
  });
}

// Connect and verify the database connection
async function connectDatabase() {
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT 1 AS connected`;
    console.log('[DB] PostgreSQL connected via Prisma');
    return true;
  } catch (error) {
    console.error('[DB] Failed to connect to PostgreSQL:', error.message);
    throw error;
  }
}

// Graceful disconnect
async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log('[DB] PostgreSQL disconnected');
}

// Health check
async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

module.exports = { prisma, connectDatabase, disconnectDatabase, checkDatabaseHealth };