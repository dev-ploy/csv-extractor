const config = require('../config');

let redisClient;

async function getRedis() {
  if (!redisClient) {
    const { createClient } = require('redis');
    redisClient = createClient({ url: config.REDIS_URL });
    redisClient.on('error', (err) => console.error('[Redis] Error:', err.message));
    redisClient.on('connect', () => console.log('[Redis] Connected'));
  }
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

async function disconnectRedis() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log('[Redis] Disconnected');
  }
}

module.exports = { getRedis, disconnectRedis };