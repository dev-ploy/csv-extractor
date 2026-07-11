const { z } = require('zod');
const { AppError } = require('./errorHandler');

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'user'], 'Role must be "admin" or "user"'),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
      return next(new AppError('Validation failed', 400, errors));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate, loginSchema, registerSchema, updateRoleSchema };