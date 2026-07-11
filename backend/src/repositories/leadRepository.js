const { getPrisma } = require('../infra/prisma');

function safeParseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

async function createSession(data) {
  const prisma = getPrisma();
  return prisma.uploadSession.create({ data });
}

async function getSession(id, includeLeads = false) {
  const prisma = getPrisma();
  return prisma.uploadSession.findUnique({
    where: { id },
    ...(includeLeads ? { include: { leads: { orderBy: { createdAt: 'desc' }, take: 50 } } } : {}),
  });
}

async function listSessions(limit = 50) {
  const prisma = getPrisma();
  return prisma.uploadSession.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

async function updateSession(id, data) {
  const prisma = getPrisma();
  return prisma.uploadSession.update({ where: { id }, data });
}

async function batchInsertLeads(sessionId, leads, batchSize = 10) {
  const prisma = getPrisma();
  const allCreated = [];
  const allSkipped = [];

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize).map((lead) => ({
      uploadSessionId: sessionId,
      importStatus: 'imported',
      ...lead,
      ...(lead.possessionTime ? { possessionTime: safeParseDate(lead.possessionTime) } : {}),
    }));

    // Track duplicates by email within this batch
    const seenEmails = new Map();
    const uniqueBatch = [];

    for (const lead of batch) {
      const email = lead.email;
      if (email) {
        const lowerEmail = email.toLowerCase();
        if (seenEmails.has(lowerEmail)) {
          allSkipped.push({ ...lead, skipReason: 'Duplicate email in this batch', email: lowerEmail });
          continue;
        }
        seenEmails.set(lowerEmail, true);
      }
      uniqueBatch.push(lead);
    }

    // Check against DB for existing emails
    const emails = uniqueBatch.map(l => l.email).filter(Boolean);
    if (emails.length > 0) {
      const existing = await prisma.lead.findMany({
        where: { uploadSessionId: sessionId, email: { in: emails } },
        select: { email: true },
      });
      const existingSet = new Set(existing.map(e => e.email.toLowerCase()));
      const reallyUnique = [];
      for (const lead of uniqueBatch) {
        if (lead.email && existingSet.has(lead.email.toLowerCase())) {
          allSkipped.push({ ...lead, skipReason: 'Duplicate email in this session', email: lead.email });
        } else {
          reallyUnique.push(lead);
        }
      }
      uniqueBatch.length = 0;
      uniqueBatch.push(...reallyUnique);
    }

    if (uniqueBatch.length === 0) continue;

    try {
      await prisma.lead.createMany({ data: uniqueBatch, skipDuplicates: true });
      allCreated.push(...uniqueBatch);
    } catch (err) {
      for (const lead of uniqueBatch) {
        try {
          const record = await prisma.lead.create({ data: lead });
          allCreated.push(record);
        } catch (insErr) {
          allSkipped.push({ ...lead, skipReason: insErr.code === 'P2002' ? 'Duplicate email' : insErr.message });
        }
      }
    }
  }

  return { created: allCreated, skipped: allSkipped };
}

async function getImportSummary(sessionId) {
  const prisma = getPrisma();
  const [total, imported, skipped] = await Promise.all([
    prisma.lead.count({ where: { uploadSessionId: sessionId } }),
    prisma.lead.count({ where: { uploadSessionId: sessionId, importStatus: 'imported' } }),
    prisma.lead.count({ where: { uploadSessionId: sessionId, importStatus: 'skipped' } }),
  ]);
  const parsed = total - imported - skipped;
  return { total, parsed, imported, skipped };
}

async function updateLeadImportStatus(id, status, reason = null) {
  const prisma = getPrisma();
  return prisma.lead.update({
    where: { id },
    data: { importStatus: status, skipReason: reason },
  });
}

async function getSessionLeads(sessionId, options = {}) {
  const prisma = getPrisma();
  const { status, offset = 0, limit = 50 } = options;
  const where = { uploadSessionId: sessionId };
  if (status) where.importStatus = status;
  return prisma.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });
}

async function deleteSessionLeads(sessionId) {
  const prisma = getPrisma();
  return prisma.lead.deleteMany({ where: { uploadSessionId: sessionId } });
}

module.exports = {
  uploadSession: { create: createSession, get: getSession, list: listSessions, update: updateSession },
  lead: {
    batchInsert: batchInsertLeads,
    summary: getImportSummary,
    list: getSessionLeads,
    updateStatus: updateLeadImportStatus,
    deleteBySession: deleteSessionLeads,
  },
};