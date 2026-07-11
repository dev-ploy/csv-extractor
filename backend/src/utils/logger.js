const pino = require('pino');
const config = require('../config');

const LEVELS = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10 };

const logger = pino({
  level: config.isDev ? 'debug' : 'info',
  transport: config.isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  base: { env: config.NODE_ENV },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'secret'],
    censor: '[REDACTED]',
  },
});

function childLogger(component) {
  return logger.child({ component });
}

module.exports = logger;
module.exports.childLogger = childLogger;
module.exports.LEVELS = LEVELS;