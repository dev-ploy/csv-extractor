const config = require('../config');
const { previewData, parseCsvFile, getHeaders } = require('../services/csvParser');
const { mapHeaders } = require('../services/aiMapper');
const llm = require('../infra/llm_session');
const { computeColumnStats, computeDatasetQuality } = require('../utils/dataStats');
const leadRepo = require('../repositories/leadRepository');
const { getMinio } = require('../infra/minio');
const cache = require('../services/cacheService');

const FIELD_MAP = {
  country_code: 'countryCode',
  mobile_without_country_code: 'mobileWithoutCountryCode',
  lead_owner: 'leadOwner',
  crm_status: 'crmStatus',
  crm_note: 'crmNote',
  data_source: 'dataSource',
  possession_time: 'possessionTime',
  created_at: 'createdAt',
};

function toPrismaField(f) { return FIELD_MAP[f] || f; }

function rowToPrisma(row, mapping) {
  const m = {};
  for (const [csvHeader, schemaField] of Object.entries(mapping)) {
    if (schemaField && row[csvHeader] !== undefined && row[csvHeader] !== '') {
      m[toPrismaField(schemaField)] = row[csvHeader];
    }
  }
  return m;
}

async function getCsvContent(session) {
  if (session.originalCsv) return session.originalCsv;
  if (session.minioKey) {
    try {
      const stream = await getMinio().getObject(config.MINIO_BUCKET, session.minioKey);
      return new Promise((resolve, reject) => {
        let data = '';
        stream.on('data', (chunk) => data += chunk.toString());
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
      });
    } catch (err) {
      throw new Error(`Failed to read CSV from MinIO: ${err.message}`);
    }
  }
  throw new Error('No CSV content available for this session');
}

async function listSessions(req, res, next) {
  try {
    const sessions = await cache.cacheWrap('sessions', cache.DEFAULT_TTL.sessions, () => leadRepo.uploadSession.list());
    res.json({ data: sessions });
  } catch (err) { next(err); }
}

async function getSession(req, res, next) {
  try {
    const session = await cache.cacheWrap('session', cache.DEFAULT_TTL.session, () => leadRepo.uploadSession.get(req.params.id, true), req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ data: session });
  } catch (err) { next(err); }
}

async function uploadCsv(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!req.file.buffer || req.file.buffer.length === 0) return res.status(400).json({ error: 'Empty file' });

    const csvContent = req.file.buffer.toString();
    const preview = previewData(req.file.buffer, config.MAX_PREVIEW_ROWS);

    // Upload to MinIO
    const objectName = `${req.user.id}/${Date.now()}_${req.file.originalname}`;
    await getMinio().putObject(config.MINIO_BUCKET, objectName, req.file.buffer, null, {
      'Content-Type': 'text/csv',
    });

    await cache.del('sessions');
    await cache.invalidatePattern('session');
    const session = await leadRepo.uploadSession.create({
      filename: req.file.originalname,
      minioKey: objectName,
      originalCsv: csvContent,
      totalRows: preview.totalRows,
      status: 'pending',
      createdBy: req.user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    res.status(201).json({
      data: {
        id: session.id,
        filename: session.filename,
        status: session.status,
        totalRows: preview.totalRows,
        preview: {
          headers: preview.headers,
          rows: preview.preview,
          totalRows: preview.totalRows,
        },
      },
    });
  } catch (err) { next(err); }
}

async function mapHeadersHandler(req, res, next) {
  try {
    const session = await leadRepo.uploadSession.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const csvContent = await getCsvContent(session);
    const headers = getHeaders(Buffer.from(csvContent));
    const result = await mapHeaders(headers);

    await leadRepo.uploadSession.update(session.id, {
      headerMapping: result.mapping,
      status: 'mapped',
    });
    await cache.del('session', session.id);
    await cache.del('mapping', session.id);

    res.json({ data: { strategy: result.strategy, mapping: result.mapping } });
  } catch (err) { next(err); }
}

async function previewMapping(req, res, next) {
  try {
    const cached = await cache.get('sessionPreview', req.params.id);
    if (cached) return res.json({ data: cached });
    const session = await leadRepo.uploadSession.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const csvContent = await getCsvContent(session);
    const raw = parseCsvFile(Buffer.from(csvContent));
    const mapping = session.headerMapping || {};

    const mapped = raw.map((row) => {
      const rawRow = {};
      const m = {};
      for (const [k, v] of Object.entries(row)) {
        rawRow[k] = v;
        const mappedField = mapping[k];
        if (mappedField) m[toPrismaField(mappedField)] = v;
      }
      return { raw: rawRow, mapped: m };
    });

    const result = {
      headers: Object.keys(raw[0] || {}),
      mapping,
      rows: mapped.slice(0, config.MAX_PREVIEW_ROWS),
      totalRows: mapped.length,
    };
    await cache.set('sessionPreview', result, cache.DEFAULT_TTL.sessionPreview, req.params.id);
    res.json({ data: result });
  } catch (err) { next(err); }
}

async function importLeads(req, res, next) {
  try {
    const session = await leadRepo.uploadSession.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.headerMapping) return res.status(400).json({ error: 'Headers not mapped yet' });

    const csvContent = await getCsvContent(session);
    const raw = parseCsvFile(Buffer.from(csvContent));
    const mapping = session.headerMapping;
    const leads = raw.map((row) => rowToPrisma(row, mapping));

    const result = await leadRepo.lead.batchInsert(session.id, leads, config.BATCH_SIZE);

    await leadRepo.uploadSession.update(session.id, {
      totalRows: leads.length,
      status: result.skipped.length > 0 ? 'imported_partial' : 'imported',
    });
    await cache.del('session', session.id);
    await cache.del('summary', session.id);
    await cache.del('sessionPreview', session.id);

    res.status(201).json({
      data: {
        imported: result.created.length,
        skipped: result.skipped.length,
        total: leads.length,
        created: result.created,
        skipped: result.skipped,
      },
    });
  } catch (err) { next(err); }
}

async function getSummary(req, res, next) {
  try {
    const cached = await cache.get('summary', req.params.id);
    if (cached) return res.json({ data: cached });
    const session = await leadRepo.uploadSession.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const summary = await leadRepo.lead.summary(session.id);
    const result = { sessionId: session.id, filename: session.filename, status: session.status, ...summary };
    await cache.set('summary', result, cache.DEFAULT_TTL.summary, session.id);
    res.json({ data: result });
  } catch (err) { next(err); }
}

async function getLeads(req, res, next) {
  try {
    const { status, offset, limit } = req.query;
    const leads = await leadRepo.lead.list(req.params.id, { status, offset: parseInt(offset) || 0, limit: parseInt(limit) || 50 });
    res.json({ data: leads });
  } catch (err) { next(err); }
}

async function deleteSession(req, res, next) {
  try {
    const session = await leadRepo.uploadSession.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Also delete from MinIO if stored
    if (session.minioKey) {
      try { await getMinio().removeObject(config.MINIO_BUCKET, session.minioKey); } catch (e) { /* ignore */ }
    }

    await leadRepo.lead.deleteBySession(session.id);
    await leadRepo.uploadSession.update(session.id, { status: 'deleted' });
    await cache.del('sessions');
    await cache.del('session', session.id);
    await cache.del('summary', session.id);
    await cache.del('sessionPreview', session.id);
    res.json({ data: { message: 'Session deleted', id: session.id } });
  } catch (err) { next(err); }
}

async function reprocessLeads(req, res, next) {
  try {
    const session = await leadRepo.uploadSession.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.headerMapping) return res.status(400).json({ error: 'Headers not mapped' });

    const csvContent = await getCsvContent(session);
    await leadRepo.lead.deleteBySession(session.id);
    await leadRepo.uploadSession.update(session.id, { status: 'pending' });

    const raw = parseCsvFile(Buffer.from(csvContent));
    const mapping = session.headerMapping;
    const leads = raw.map((row) => rowToPrisma(row, mapping));

    const result = await leadRepo.lead.batchInsert(session.id, leads, config.BATCH_SIZE);

    await leadRepo.uploadSession.update(session.id, {
      totalRows: leads.length,
      status: result.skipped.length > 0 ? 'imported_partial' : 'imported',
    });
    await cache.del('session', session.id);
    await cache.del('summary', session.id);
    await cache.del('sessionPreview', session.id);

    res.json({
      data: {
        imported: result.created.length,
        skipped: result.skipped.length,
        total: leads.length,
      },
    });
  } catch (err) { next(err); }
}

async function aiSummary(req, res, next) {
  try {
    const cached = await cache.get('aiSummary', req.params.id);
    if (cached) return res.json({ data: cached });

    const session = await leadRepo.uploadSession.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const csvContent = await getCsvContent(session);
    const raw = parseCsvFile(Buffer.from(csvContent));
    const headers = Object.keys(raw[0] || {});
    const mapping = session.headerMapping || {};
    const totalRows = raw.length;

    const sampleSize = totalRows > 50 ? 10 : Math.max(totalRows, 1);
    const sampleRows = raw.slice(0, sampleSize);

    const columnStats = headers.map((h) => {
      const values = raw.map((r) => r[h]);
      return computeColumnStats(h, values, totalRows);
    });
    const dataQuality = computeDatasetQuality(columnStats);

    if (!config.GROQ_API_KEY && !config.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'No AI provider configured for summary generation' });
    }

    const prompt = llm.buildSummaryPrompt(
      { filename: session.filename, totalRows, status: session.status },
      headers,
      sampleRows,
      mapping,
      columnStats,
      dataQuality,
    );

    let result;
    if (config.GROQ_API_KEY) {
      const rawLLM = await llm.completeWithGroq(prompt, { model: config.LLM_MODEL, maxTokens: 2000 });
      result = llm.extractJson(rawLLM);
    } else {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
      const out = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });
      result = llm.extractJson(out.choices[0].message.content);
    }

    const enriched = {
      ...result,
      totalRows,
      filename: session.filename,
      sessionId: session.id,
    };
    await cache.set('aiSummary', enriched, cache.DEFAULT_TTL.summary, session.id);
    res.json({ data: enriched });
  } catch (err) { next(err); }
}

module.exports = {
  listSessions,
  getSession,
  uploadCsv,
  mapHeadersHandler,
  previewMapping,
  importLeads,
  getSummary,
  getLeads,
  deleteSession,
  reprocessLeads,
  aiSummary,
};