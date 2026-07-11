const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const leadRepo = require('../src/repositories/leadRepository');

describe('leadRepository', () => {
  let sessionId;

  before(async () => {
    const session = await leadRepo.uploadSession.create({
      filename: 'test_repo.csv',
      totalRows: 0,
      status: 'pending',
      createdBy: null,
      expiresAt: new Date(Date.now() + 86400000),
    });
    sessionId = session.id;
  });

  after(async () => {
    try { await leadRepo.lead.deleteBySession(sessionId); } catch {}
    try { await leadRepo.uploadSession.update(sessionId, { status: 'deleted' }); } catch {}
  });

  describe('uploadSession', () => {
    it('creates a session', async () => {
      assert.ok(sessionId);
      assert.ok(sessionId.length > 10);
    });

    it('gets a session by id', async () => {
      const s = await leadRepo.uploadSession.get(sessionId);
      assert.equal(s.id, sessionId);
      assert.equal(s.filename, 'test_repo.csv');
    });

    it('lists sessions', async () => {
      const sessions = await leadRepo.uploadSession.list();
      assert.ok(Array.isArray(sessions));
      assert.ok(sessions.length >= 1);
    });

    it('updates a session', async () => {
      const s = await leadRepo.uploadSession.update(sessionId, { status: 'mapped' });
      assert.equal(s.status, 'mapped');
    });
  });

  describe('lead', () => {
    const leads = [
      { email: 'alice@test.com', leadOwner: 'Alice', company: 'Acme' },
      { email: 'bob@test.com', leadOwner: 'Bob', company: 'Globex' },
    ];

    it('batch inserts leads', async () => {
      const result = await leadRepo.lead.batchInsert(sessionId, leads, 2);
      assert.equal(result.created.length, 2, 'Should create 2 leads');
      assert.equal(result.skipped.length, 0, 'Should skip 0 leads');
    });

    it('detects duplicate emails in session', async () => {
      const dupeLeads = [{ email: 'alice@test.com', leadOwner: 'Alice 2' }];
      const result = await leadRepo.lead.batchInsert(sessionId, dupeLeads, 1);
      assert.equal(result.created.length, 0, 'Should not create duplicate');
      assert.equal(result.skipped.length, 1, 'Should skip 1 lead');
      assert.ok(result.skipped[0].skipReason.includes('Duplicate'));
    });

    it('lists leads for session', async () => {
      const leadsList = await leadRepo.lead.list(sessionId, { offset: 0, limit: 10 });
      assert.ok(Array.isArray(leadsList));
      assert.equal(leadsList.length, 2);
    });

    it('gets import summary', async () => {
      const summary = await leadRepo.lead.summary(sessionId);
      assert.equal(summary.total, 2);
      assert.equal(summary.imported, 2);
    });

    it('deletes leads by session', async () => {
      const result = await leadRepo.lead.deleteBySession(sessionId);
      assert.ok(result.count >= 2);
      const remaining = await leadRepo.lead.list(sessionId, {});
      assert.equal(remaining.length, 0);
    });
  });
});