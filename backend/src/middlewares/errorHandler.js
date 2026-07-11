const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request', details = null) { super(message, 400, details); }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401); }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403); }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') { super(`${resource} not found`, 404); }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') { super(message, 409); }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 422, errors);
    this.errors = errors;
  }
}

class RateLimitError extends AppError {
  constructor() { super('Too many requests', 429); }
}

const errorLog = [];
const MAX_ERROR_LOG = 500;

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: statusCode >= 500 ? 'error' : 'warn',
    statusCode,
    message: err.message,
    path: req?.path || req?.originalUrl || 'unknown',
    method: req?.method || 'unknown',
    isOperational,
    requestId: req?.id,
    userId: req?.user?.id,
    ...(err.details && { details: err.details }),
  };

  errorLog.push(logEntry);
  if (errorLog.length > MAX_ERROR_LOG) errorLog.shift();

  if (statusCode >= 500) {
    logger.error({
      err, path: logEntry.path, method: logEntry.method,
      requestId: logEntry.requestId, userId: logEntry.userId,
      statusCode,
    }, `[${statusCode}] ${err.message}`);
  } else if (statusCode >= 400) {
    logger.warn({
      err: { message: err.message, stack: err.stack },
      path: logEntry.path, method: logEntry.method,
      statusCode,
    }, `[${statusCode}] ${err.message}`);
  }

  res.status(statusCode).json({
    error: isOperational ? err.message : 'Internal server error',
    ...(err.details && { details: err.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

function getRecentErrors(limit = 50) {
  return errorLog.slice(-limit).reverse();
}

module.exports = {
  AppError, BadRequestError, UnauthorizedError, ForbiddenError,
  NotFoundError, ConflictError, ValidationError, RateLimitError,
  errorHandler, getRecentErrors,
};