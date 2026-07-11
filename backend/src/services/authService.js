const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getPrisma } = require('../infra/prisma');
const { AppError } = require('../middlewares/errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'csv-extractor-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const ROLES = { ADMIN: 'admin', USER: 'user' };

const PERMISSIONS = {
  upload_csv: { admin: true, user: true },
  view_sessions: { admin: true, user: true },
  view_session: { admin: true, user: true },
  map_headers: { admin: true, user: true },
  preview_mapping: { admin: true, user: true },
  import_leads: { admin: true, user: true },
  view_summary: { admin: true, user: true },
  view_leads: { admin: true, user: true },
  delete_session: { admin: true, user: false },
  reprocess: { admin: true, user: false },
  manage_users: { admin: true, user: false },
  view_users: { admin: true, user: false },
};

function checkPermission(permission) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    const allowed = PERMISSIONS[permission];
    if (!allowed) return next(new AppError(`Unknown permission: ${permission}`, 500));
    if (!allowed[req.user.role]) {
      return next(new AppError(`Insufficient permissions. Required: ${permission}`, 403));
    }
    next();
  };
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Missing or invalid authorization header. Format: Bearer <token>', 401));
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch (err) {
    return next(new AppError(err.name === 'TokenExpiredError' ? 'Token expired. Please login again.' : 'Invalid token', 401));
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try { req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET); } catch (e) { /* ignore */ }
  }
  next();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function register(email, password, name) {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Email already registered', 409);
  const user = await prisma.user.create({
    data: { email, password: bcrypt.hashSync(password, 12), name: name || email.split('@')[0], role: 'user' },
  });
  return { token: generateToken(user), user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

async function loginUser(email, password) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !bcrypt.compareSync(password, user.password)) throw new AppError('Invalid credentials', 401);
  return { token: generateToken(user), user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

async function getUserProfile(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

async function listAllUsers() {
  const prisma = getPrisma();
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function updateUserRoleById(userId, role) {
  const prisma = getPrisma();
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
}

module.exports = {
  authenticate, checkPermission, generateToken, register, loginUser,
  getUserProfile, listAllUsers, updateUserRoleById, ROLES, PERMISSIONS,
};