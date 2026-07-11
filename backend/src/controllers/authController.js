const authService = require('../services/authService');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body.email, req.body.password, req.body.name);
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await authService.loginUser(req.body.email, req.body.password);
    res.json({ data: result });
  } catch (err) { next(err); }
}

async function getProfile(req, res, next) {
  try {
    const user = await authService.getUserProfile(req.user.id);
    res.json({ data: user });
  } catch (err) { next(err); }
}

async function listUsers(req, res, next) {
  try {
    const users = await authService.listAllUsers();
    res.json({ data: users });
  } catch (err) { next(err); }
}

async function updateUserRole(req, res, next) {
  try {
    const user = await authService.updateUserRoleById(req.params.id, req.body.role);
    res.json({ data: user });
  } catch (err) { next(err); }
}

module.exports = { register, login, getProfile, listUsers, updateUserRole };