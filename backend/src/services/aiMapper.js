const config = require('../config');
const llm = require('../infra/llm_session');
const logger = require('../utils/logger');

const RETRY_DELAYS = [1000, 3000, 5000];
const VALID_SCHEMA_FIELDS = new Set(config.SCHEMA_FIELDS);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function withRetry(fn, strategyName, headers) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      if (attempt > 0) {
        logger.info({ strategy: strategyName, attempt }, `Retry attempt ${attempt}/${RETRY_DELAYS.length}`);
      }
      const result = await fn(headers);
      if (typeof result !== 'object' || result === null) {
        throw new Error('LLM returned non-object response');
      }
      for (const [k, v] of Object.entries(result)) {
        if (v !== null && !VALID_SCHEMA_FIELDS.has(v)) {
          logger.warn({ header: k, invalidField: v }, 'LLM returned invalid schema field, marking as unmapped');
          result[k] = null;
        }
      }
      return result;
    } catch (err) {
      lastErr = err;
      logger.warn({ strategy: strategyName, attempt, error: err.message }, 'Mapping attempt failed');
      if (attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]);
      }
    }
  }
  throw lastErr;
}

async function mapWithHuggingFace(headers) {
  return withRetry(async (h) => {
    const prompt = llm.buildMappingPrompt(h);
    const raw = await llm.completeWithHF(prompt);
    return llm.extractJson(raw);
  }, 'huggingface', headers);
}

async function mapWithGroq(headers) {
  return withRetry(async (h) => {
    const prompt = llm.buildMappingPrompt(h);
    const raw = await llm.completeWithGroq(prompt, { model: config.LLM_MODEL });
    return llm.extractJson(raw);
  }, 'groq', headers);
}

async function mapWithOpenAI(headers) {
  return withRetry(async (h) => {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    const prompt = llm.buildMappingPrompt(h);
    const out = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a CSV header mapper. Output only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 800,
    });
    const raw = out.choices[0].message.content;
    return llm.extractJson(raw);
  }, 'openai', headers);
}

// -> Offline keyword + Levenshtein + token/ngram/abbreviation matching (no LLM needed)
const SCHEMA_FIELDS = [
  { field: 'company', keywords: ['company', 'organization', 'org', 'employer', 'business', 'firm', 'works at', 'company name', 'company_name', 'organisation', 'corp', 'corporation', 'co.', 'co', 'company co', 'entity', 'company/organization', 'company / organization', 'company/org', 'account name', 'business name', 'biz', 'employer name', 'organisation name', 'organization name', 'firm name'] },
  { field: 'lead_owner', keywords: ['lead owner', 'owner name', 'full name', 'assigned to', 'sales rep', 'contact name', 'person name', 'first name', 'last name', 'first_name', 'last_name', 'representative', 'point of contact', 'contact person', 'owned by', 'lead rep', 'sales person', 'account owner', 'owner name', 'sales owner', 'lead contact', 'person responsible', 'customer name', 'fname', 'lname', 'fullname', 'client name', 'contact'] },
  { field: 'email', keywords: ['email', 'e-mail', 'email address', 'mail', 'email_id', 'e_mail', 'emailaddress', 'electronic mail', 'recipient', 'email_addr', 'e-mail address', 'mailid', 'emailid', 'primary email', 'business email', 'work email', 'email 1', 'email1', 'customer email', 'email address 1'] },
  { field: 'mobile_without_country_code', keywords: ['mobile', 'phone', 'phone number', 'mobile number', 'cell', 'telephone', 'tel', 'contact number', 'contact no', 'mobile phone', 'phone no', 'phone_no', 'cell phone', 'cellphone', 'mobile tel', 'mobile telephone', 'mobile #', 'phone #', 'phone#', 'mobile#', 'tel no', 'tel_no', 'telephone number', 'whatsapp no', 'whatsapp', 'contact phone', 'mobile number', 'mobile_number', 'cellular', 'phone 1', 'phone1', 'primary phone', 'landline', 'telephone #', 'ph'] },
  { field: 'country_code', keywords: ['country code', 'countrycode', 'phone code', 'dial code', 'country calling code', 'cc', 'phone prefix', 'country prefix', 'international code', 'area code', 'country cd', 'country_cd', 'iso code', 'iso country', 'code', 'telephone country code'] },
  { field: 'city', keywords: ['city', 'town', 'location', 'locality', 'municipality', 'city/town', 'city / town', 'city/town/village', 'city name', 'town/city', 'city & town', 'city, town', 'residence city', 'home city', 'work city', 'city of residence', 'city state', 'city/state', 'office city', 'city location'] },
  { field: 'state', keywords: ['state', 'province', 'region', 'district', 'territory', 'st', 'state/province', 'state / province', 'state-region', 'state/region', 'province/state', 'state area', 'state code', 'state cd', 'admin area', 'administrative area', 'admin region'] },
  { field: 'country', keywords: ['country', 'nation', 'country name', 'cntry', 'country/region', 'country region', 'country of residence', 'residence country', 'home country', 'work country', 'country of origin', 'nation name', 'land'] },
  { field: 'lead_owner', keywords: ['lead owner', 'owner name', 'assigned to', 'sales rep', 'full name', 'contact name', 'person name', 'first name', 'last name', 'first_name', 'last_name', 'representative', 'point of contact', 'contact person', 'owned by', 'lead rep', 'sales person', 'account owner', 'owner name', 'sales owner', 'lead contact', 'person responsible', 'customer name', 'fname', 'lname', 'fullname', 'client name'] },
  { field: 'crm_status', keywords: ['crm status', 'status', 'lead status', 'crm_status', 'stage', 'pipeline stage', 'deal stage', 'lead stage', 'opportunity stage', 'sales stage', 'crm stage', 'status name', 'current status', 'status text', 'lifecycle stage', 'lead lifecycle', 'lead status name', 'stage name', 'deal status', 'opportunity status', 'status (crm)', 'status crm', 'current stage'] },
  { field: 'crm_note', keywords: ['crm note', 'note', 'notes', 'remarks', 'comment', 'crm_note', 'comments', 'additional notes', 'notes & remarks', 'notes/remarks', 'remarks/notes', 'notes or remarks', 'note/remarks', 'add notes', 'crm notes', 'lead notes', 'internal notes', 'notes...', 'Remarks', 'Notes', 'Notes/Remarks', 'comments/notes', 'description notes', 'remarks/comments', 'details', 'additional info', 'info'] },
  { field: 'data_source', keywords: ['data source', 'source', 'data_source', 'lead source', 'origin', 'channel', 'referral', 'campaign', 'lead source name', 'source name', 'source channel', 'acquisition channel', 'marketing channel', 'lead channel', 'traffic source', 'utm source', 'campaign name', 'campaign source', 'source code', 'source type', 'source details', 'source info', 'source of lead', 'lead origin', 'source (channel)', 'Src', 'Lead Src', 'Lead Source'] },
  { field: 'possession_time', keywords: ['possession time', 'possession_time', 'date', 'time', 'date time', 'timestamp', 'created at', 'created_at', 'created date', 'created time', 'lead date', 'possession date', 'possession', 'lead acquisition date', 'acquisition date', 'acquisition time', 'date acquired', 'acquired date', 'date received', 'received date', 'entry date', 'created on', 'creation date', 'date created', 'date/time', 'date and time', 'possession date/time', 'possession dt', 'possession datetime', 'p_date', 'p_time', 'date of lead', 'lead date/time', 'date captured', 'date added', 'add date', 'date obtained'] },
  { field: 'description', keywords: ['description', 'desc', 'details', 'additional details', 'summary', 'about', 'more info', 'other info', 'additional information', 'description text', 'long description', 'short description', 'descr', 'descript', 'lead description', 'description of lead', 'additional comments', 'extra info', 'supplementary info', 'detailed info', 'full description', 'overview'] },
];

function normalize(s) {
  return s.replace(/[^a-z0-9\s.]/gi, '').replace(/\.+/g, '.').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\.$/, '');
}

function getTokens(s) {
  return s.split(/\s+/).filter(t => t.length > 0);
}

function bigrams(s) {
  const r = [];
  for (let i = 0; i < s.length - 1; i++) r.push(s.substring(i, i + 2));
  return r;
}

function trigrams(s) {
  const r = [];
  for (let i = 0; i < s.length - 2; i++) r.push(s.substring(i, i + 3));
  return r;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function isAbbreviationOf(short, long) {
  if (short.length < 3 || short.length >= long.length) return false;
  const sl = short.toLowerCase(), ll = long.toLowerCase();
  let si = 0;
  for (let li = 0; li < ll.length && si < sl.length; li++) {
    if (ll[li] === sl[si]) si++;
  }
  if (si === sl.length) return true;
  const acro = ll.split(/\s+/).map(w => w[0]).join('');
  return acro === sl;
}

function scoreHeader(hl, kwl) {
  if (hl === kwl) return 0;

  const len = Math.min(hl.length, kwl.length);
  const maxLen = Math.max(hl.length, kwl.length);
  const lev = levenshtein(hl, kwl);

  // Abbreviation match gets priority: "co" → "company" beats "co" → "code"
  if (isAbbreviationOf(hl, kwl)) return 0.5;

  let subScore = Infinity;
  if (kwl.includes(hl) && hl.length >= 2) {
    // Header is a substring of keyword — strong match
    subScore = 0.5;
  } else if (hl.includes(kwl) && kwl.length >= 3) {
    subScore = maxLen - len;
  }

  let tokenScore = Infinity;
  const hTokens = getTokens(hl);
  const kwTokens = getTokens(kwl);
  let overlap = 0;
  for (const ht of hTokens) {
    for (const kt of kwTokens) {
      if (ht === kt) { overlap += 2; break; }
      if (levenshtein(ht, kt) <= 1) { overlap++; break; }
    }
  }
  if (hTokens.length > 0 && kwTokens.length > 0) {
    const tokenRatio = overlap / (hTokens.length + kwTokens.length) * 2;
    tokenScore = maxLen - Math.round(tokenRatio * len);
  }

  let ngramScore = Infinity;
  if (hl.length < 6 || kwl.length < 6) {
    const hBi = bigrams(hl), kBi = bigrams(kwl);
    let biOverlap = 0;
    for (const b of hBi) { if (kBi.includes(b)) biOverlap++; }
    const hTri = trigrams(hl), kTri = trigrams(kwl);
    let triOverlap = 0;
    for (const t of hTri) { if (kTri.includes(t)) triOverlap++; }
    const bestNgram = Math.max(hBi.length, kBi.length, hTri.length, kTri.length);
    const ngramHits = biOverlap + triOverlap;
    ngramScore = bestNgram > 0 ? maxLen - Math.round((ngramHits / bestNgram) * len) : Infinity;
  }

  let prefixScore = Infinity;
  if (kwl.startsWith(hl) || hl.startsWith(kwl)) prefixScore = maxLen - len;

  return Math.min(lev, subScore, tokenScore, ngramScore, prefixScore);
}

function mapOffline(headers) {
  const mapping = {};
  const cachedNormalized = {};

  for (const h of headers) {
    const hl = normalize(h);
    cachedNormalized[h] = hl;
    let best = '', bestScore = 20;

    for (const { field, keywords } of SCHEMA_FIELDS) {
      for (const kw of keywords) {
        const kwl = normalize(kw);
        const score = scoreHeader(hl, kwl);
        if (score < bestScore) {
          bestScore = score;
          best = field;
          if (score === 0) break;
        }
      }
      if (bestScore === 0) break;
    }

    mapping[h] = bestScore <= 3 ? best : null;
  }
  return mapping;
}

async function mapHeaders(headers) {
  const strategies = [
    { name: 'groq', fn: () => mapWithGroq(headers) },
    { name: 'huggingface', fn: () => mapWithHuggingFace(headers) },
    { name: 'openai', fn: () => mapWithOpenAI(headers) },
  ];

  const errors = [];
  for (const { name, fn } of strategies) {
    try {
      if (name === 'groq' && !config.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');
      if (name === 'huggingface' && !config.HF_TOKEN) throw new Error('HF_TOKEN not configured');
      if (name === 'openai' && !config.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

      const result = await fn();
      return { strategy: name, mapping: result };
    } catch (err) {
      logger.warn({ strategy: name, error: err.message }, 'Mapping strategy failed');
      errors.push({ strategy: name, error: err.message });
    }
  }

  logger.info('All LLM strategies failed, falling back to offline mapper');
  const offlineResult = mapOffline(headers);
  return { strategy: 'offline', mapping: offlineResult };
}

async function batchExtractFields(headers, rows, batchSize = config.BATCH_SIZE) {
  const results = [];
  const errors = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    try {
      if (config.GROQ_API_KEY) {
        const prompt = llm.buildDataExtractionPrompt(headers, batch);
        const raw = await llm.completeWithGroq(prompt, { model: config.LLM_MODEL, maxTokens: 2000 });
        const extracted = llm.extractJson(raw);
        results.push(...(Array.isArray(extracted) ? extracted : [extracted]));
      } else if (config.OPENAI_API_KEY) {
        const prompt = llm.buildDataExtractionPrompt(headers, batch);
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
        const out = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 2000,
        });
        const extracted = llm.extractJson(out.choices[0].message.content);
        results.push(...(Array.isArray(extracted) ? extracted : [extracted]));
      } else {
        results.push(...batch);
      }
    } catch (err) {
      errors.push({ batch: i / batchSize, error: err.message });
      results.push(...batch);
    }
  }

  return { results, errors };
}

module.exports = { mapHeaders, batchExtractFields };