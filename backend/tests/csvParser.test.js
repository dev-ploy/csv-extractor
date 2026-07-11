const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { parseCsvFile, getHeaders, previewData, validateRow } = require('../src/services/csvParser');

const SAMPLE_CSV = 'name,email,co.\nJohn,john@test.com,Acme\nJane,jane@test.com,Globex\n';
const SAMPLE_CSV_SEMICOL = 'name;email;company\nJohn;john@test.com;Acme\n';
const SAMPLE_CSV_MESSY = 'Full Name,email addr,co.,city/town,ST,cntry,ph #,Lead Src,Remarks\nJohn Smith,john@acmecorp.com,Acme Corp,NYC,NY,USA,555-0100,Web,Notes\n';

describe('csvParser', () => {
  describe('getHeaders', () => {
    it('parses comma-delimited headers', () => {
      const h = getHeaders(Buffer.from(SAMPLE_CSV));
      assert.deepEqual(h, ['name', 'email', 'co.']);
    });

    it('parses semicolon-delimited headers', () => {
      const h = getHeaders(Buffer.from(SAMPLE_CSV_SEMICOL));
      assert.deepEqual(h, ['name', 'email', 'company']);
    });

    it('handles messy CSV headers', () => {
      const h = getHeaders(Buffer.from(SAMPLE_CSV_MESSY));
      assert.equal(h.length, 9);
      assert.ok(h.includes('Full Name'));
      assert.ok(h.includes('email addr'));
    });

    it('returns empty array for empty file', () => {
      assert.deepEqual(getHeaders(Buffer.from('')), []);
    });
  });

  describe('parseCsvFile', () => {
    it('parses standard CSV', () => {
      const records = parseCsvFile(Buffer.from(SAMPLE_CSV));
      assert.equal(records.length, 2);
      assert.equal(records[0].name, 'John');
      assert.equal(records[0].email, 'john@test.com');
      assert.equal(records[1].name, 'Jane');
    });

    it('parses semicolon-delimited CSV', () => {
      const records = parseCsvFile(Buffer.from(SAMPLE_CSV_SEMICOL));
      assert.equal(records.length, 1);
      assert.equal(records[0].email, 'john@test.com');
    });

    it('parses messy CSV with special characters', () => {
      const records = parseCsvFile(Buffer.from(SAMPLE_CSV_MESSY));
      assert.equal(records.length, 1);
      assert.equal(records[0]['Full Name'], 'John Smith');
      assert.equal(records[0]['email addr'], 'john@acmecorp.com');
    });

    it('throws on empty CSV', () => {
      assert.throws(() => parseCsvFile(Buffer.from('')), /Empty CSV/);
    });

    it('throws on headers-only CSV', () => {
      assert.throws(() => parseCsvFile(Buffer.from('a,b,c\n')), /no data rows/);
    });
  });

  describe('previewData', () => {
    it('returns headers, totalRows, and limited preview', () => {
      const p = previewData(Buffer.from(SAMPLE_CSV), 1);
      assert.equal(p.totalRows, 2);
      assert.deepEqual(p.headers, ['name', 'email', 'co.']);
      assert.equal(p.preview.length, 1);
    });

    it('respects maxRows limit', () => {
      const manyRows = 'a,b\n' + Array.from({ length: 50 }, (_, i) => `${i},val${i}`).join('\n');
      const p = previewData(Buffer.from(manyRows), 5);
      assert.equal(p.totalRows, 50);
      assert.equal(p.preview.length, 5);
    });
  });

  describe('validateRow', () => {
    it('passes valid row', () => {
      const mapping = { email: 'email' };
      const row = { email: 'test@example.com' };
      const r = validateRow(row, mapping);
      assert.ok(r.valid);
      assert.equal(r.errors.length, 0);
    });

    it('flags invalid email', () => {
      const mapping = { email: 'email' };
      const row = { email: 'not-an-email' };
      const r = validateRow(row, mapping);
      assert.ok(!r.valid);
      assert.equal(r.errors.length, 1);
      assert.equal(r.errors[0].field, 'email');
    });

    it('passes row without email field', () => {
      const mapping = {};
      const row = { name: 'John' };
      const r = validateRow(row, mapping);
      assert.ok(r.valid);
    });
  });
});