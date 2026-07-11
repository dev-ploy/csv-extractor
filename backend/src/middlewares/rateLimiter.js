const rateLimit = require('express-rate-limit');

function createRateLimiter(config) {
  return rateLimit({
    windowMs: 60 * 1000,
    max: config.isDev ? 1000 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
}

module.exports = { createRateLimiter };