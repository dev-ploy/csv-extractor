const { PrismaClient } = require('@prisma/client');
const config = require('../config');

let prisma;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: config.isDev
        ? [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }]
        : [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }],
    });

    if (config.isDev) {
      prisma.$on('query', (e) => {
        if (e.duration > 500) {
          console.warn(`[SLOW QUERY] ${e.duration}ms: ${e.query}`);
        }
      });
    }
  }
  return prisma;
}

async function connectDatabase() {
  const client = getPrisma();
  try {
    await client.$connect();
    await client.$queryRaw`SELECT 1`;
    console.log('[DB] PostgreSQL connected via Prisma');
  } catch (error) {
    console.error('[DB] Failed to connect:', error.message);
    throw error;
  }
}

async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect();
    console.log('[DB] Prisma disconnected');
  }
}

async function checkDatabaseHealth() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

module.exports = { getPrisma, connectDatabase, disconnectDatabase, checkDatabaseHealth };