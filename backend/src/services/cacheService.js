const logger = require('../utils/logger');

const log = logger.childLogger({ component: 'cache' });

let client = null;
let enabled = false;

const DEFAULT_TTL = {
  session: 3600,
  sessions: 300,
  sessionPreview: 600,
  leads: 300,
  summary: 300,
  user: 600,
  users: 300,
  mapping: 1800,
};

function makeKey(prefix, ...parts) {
  return `csvxt:${prefix}:${parts.filter(Boolean).join(':')}`;
}

async function getRedis() {
  if (!client) {
    try {
      const { createClient } = require('redis');
      const config = require('../config');
      client = createClient({ url: config.REDIS_URL });
      client.on('error', (err) => {
        enabled = false;
        log.warn({ err: err.message }, 'Redis client error, disabling cache');
      });
      client.on('connect', () => {
        enabled = true;
        log.info('Redis connected');
      });
      client.on('end', () => { enabled = false; });
      await client.connect();
      enabled = true;
    } catch (err) {
      enabled = false;
      log.warn({ err: err.message }, 'Redis unavailable, running without cache');
      return null;
    }
  } else if (!client.isOpen) {
    try {
      await client.connect();
      enabled = true;
    } catch {
      enabled = false;
      return null;
    }
  }
  return client;
}

async function get(prefix, ...parts) {
  if (!enabled) return null;
  try {
    const r = await getRedis();
    if (!r) return null;
    const key = makeKey(prefix, ...parts);
    const val = await r.get(key);
    if (val) return JSON.parse(val);
    return null;
  } catch {
    return null;
  }
}

async function set(prefix, value, ttl = 300, ...parts) {
  if (!enabled || value === null || value === undefined) return false;
  try {
    const r = await getRedis();
    if (!r) return false;
    const key = makeKey(prefix, ...parts);
    await r.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

async function del(prefix, ...parts) {
  if (!enabled) return;
  try {
    const r = await getRedis();
    if (!r) return;
    await r.del(makeKey(prefix, ...parts));
  } catch { /* ignore */ }
}

async function invalidatePattern(pattern) {
  if (!enabled) return;
  try {
    const r = await getRedis();
    if (!r) return;
    const keys = await r.keys(`csvxt:${pattern}*`);
    if (keys.length > 0) await r.del(keys);
  } catch { /* ignore */ }
}

async function cacheWrap(prefix, ttl, fn, ...parts) {
  const cached = await get(prefix, ...parts);
  if (cached !== null) return cached;
  const result = await fn();
  await set(prefix, result, ttl, ...parts);
  return result;
}

async function getConnectedClients() {
  if (!enabled) return [];
  try {
    const r = await getRedis();
    if (!r) return [];
    const info = await r.info('clients');
    return info.split('\n').filter(l => l.includes('connected_clients'));
  } catch {
    return [];
  }
}

module.exports = {
  get, set, del, invalidatePattern, cacheWrap,
  getRedis, getConnectedClients, enabled,
  makeKey, DEFAULT_TTL,
};