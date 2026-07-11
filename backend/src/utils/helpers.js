function sanitizeString(value, maxLength = 255) {
  if (!value || typeof value !== 'string') return null;
  return value.trim().slice(0, maxLength) || null;
}

function isValidEmail(email) {
  if (!email || !email.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

function normalizeEmail(email) {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return isValidEmail(e) ? e : null;
}

function extractCountryCode(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^+\d]/g, '');
  const match = cleaned.match(/(\+\d{1,3})(\d+)/);
  if (match) return match[1];
  if (cleaned.startsWith('00')) {
    const cc = cleaned.replace(/^00/, '+');
    const m2 = cc.match(/(\+\d{1,3})(\d+)/);
    if (m2) return m2[1];
  }
  return null;
}

function stripCountryCode(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^+\d]/g, '');
  const match = cleaned.match(/(?:\+?\d{1,3})(\d+)/);
  return match ? match[1] : cleaned;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function truncate(str, maxLength = 255) {
  if (!str) return null;
  return str.trim().slice(0, maxLength);
}

function generateUuid() {
  const { v4 } = require('uuid');
  return v4();
}

function now() {
  return new Date();
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

module.exports = {
  sanitizeString, isValidEmail, normalizeEmail,
  extractCountryCode, stripCountryCode, parseDate,
  truncate, generateUuid, now, addHours,
};