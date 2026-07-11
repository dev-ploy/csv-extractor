const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeString, isValidEmail, normalizeEmail, extractCountryCode, stripCountryCode, parseDate, truncate } = require('../src/utils/helpers');

describe('helpers', () => {
  describe('sanitizeString', () => {
    it('trims whitespace', () => { assert.equal(sanitizeString('  hello  '), 'hello'); });
    it('returns null for null input', () => { assert.equal(sanitizeString(null), null); });
    it('returns null for undefined', () => { assert.equal(sanitizeString(undefined), null); });
    it('returns null for numbers', () => { assert.equal(sanitizeString(42), null); });
    it('enforces max length', () => { assert.equal(sanitizeString('hello world', 5), 'hello'); });
  });

  describe('isValidEmail', () => {
    it('accepts basic email', () => { assert.ok(isValidEmail('test@example.com')); });
    it('accepts subdomain email', () => { assert.ok(isValidEmail('user@sub.example.co.uk')); });
    it('accepts plus addressing', () => { assert.ok(isValidEmail('test+tag@example.com')); });
    it('rejects missing @', () => { assert.ok(!isValidEmail('notanemail')); });
    it('rejects empty string', () => { assert.ok(!isValidEmail('')); });
    it('rejects null', () => { assert.ok(!isValidEmail(null)); });
    it('rejects email with spaces', () => { assert.ok(!isValidEmail('test @example.com')); });
  });

  describe('normalizeEmail', () => {
    it('lowercases email', () => { assert.equal(normalizeEmail('Test@Example.COM'), 'test@example.com'); });
    it('trims whitespace', () => { assert.equal(normalizeEmail('  user@test.com  '), 'user@test.com'); });
    it('returns null for invalid', () => { assert.equal(normalizeEmail('notanemail'), null); });
    it('returns null for null', () => { assert.equal(normalizeEmail(null), null); });
  });

  describe('extractCountryCode', () => {
    it('returns +91 prefix for +91-9876543210', () => { assert.ok(extractCountryCode('+91-9876543210').startsWith('+91')); });
    it('returns +1 prefix for +1 5551234567', () => { assert.ok(extractCountryCode('+1 5551234567').startsWith('+1')); });
    it('returns null for () format', () => { assert.equal(extractCountryCode('(44) 1234567890'), null); });
    it('returns +91 prefix for +91.9876543210', () => { assert.ok(extractCountryCode('+91.9876543210').startsWith('+91')); });
    it('returns null for no match', () => { assert.equal(extractCountryCode('5551234567'), null); });
    it('returns null for null', () => { assert.equal(extractCountryCode(null), null); });
  });

  describe('stripCountryCode', () => {
    it('strips +91 prefix', () => { const r = stripCountryCode('+91-9876543210'); assert.ok(r.length >= 9); assert.ok(!r.startsWith('+')); });
    it('strips +1 prefix', () => { const r = stripCountryCode('+1 5551234567'); assert.ok(r.length >= 8); assert.ok(!r.startsWith('+')); });
    it('returns number-only string without code stripping', () => { const r = stripCountryCode('5551234567'); assert.ok(r.length >= 7); });
    it('returns null for null', () => { assert.equal(stripCountryCode(null), null); });
  });

  describe('parseDate', () => {
    it('parses ISO date', () => {
      const d = parseDate('2024-01-15');
      assert.ok(d instanceof Date);
      assert.equal(d.getUTCFullYear(), 2024);
    });
    it('parses US format', () => {
      const d = parseDate('01/15/2024');
      assert.ok(d instanceof Date);
    });
    it('returns null for invalid', () => { assert.equal(parseDate('not-a-date'), null); });
    it('returns null for null', () => { assert.equal(parseDate(null), null); });
  });

  describe('truncate', () => {
    it('truncates long string without ellipsis', () => { assert.equal(truncate('hello world', 5), 'hello'); });
    it('returns short string as is', () => { assert.equal(truncate('hi', 5), 'hi'); });
    it('returns null for null', () => { assert.equal(truncate(null, 5), null); });
  });
});