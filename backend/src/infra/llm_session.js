const config = require('../config');
const logger = require('../utils/logger');

let hfClient = null;
let groqClient = null;

const SCHEMA_DESCRIPTION = [
  'email - email address of the lead',
  'country_code - country dialing code (e.g., +1, +44)',
  'mobile_without_country_code - phone number without country code',
  'company - company/organization name',
  'city - city name',
  'state - state or province',
  'country - country name',
  'lead_owner - person responsible for the lead (name, sales rep, owner)',
  'crm_status - lead status pipeline stage',
  'crm_note - notes, remarks, or comments about the lead',
  'data_source - source/channel the lead came from',
  'possession_time - date or timestamp of when the lead was acquired',
  'description - free text description',
];

const FEW_SHOT_EXAMPLES = [
  {
    headers: ['Full Name', 'Email Address', 'Organization', 'Location', 'Contact Number', 'Lead Source', 'Notes'],
    output: {
      'Full Name': 'lead_owner',
      'Email Address': 'email',
      'Organization': 'company',
      'Location': 'city',
      'Contact': 'mobile_without_country_code',
      'Lead Source': 'data_source',
      'Notes': 'crm_note',
    },
  },
  {
    headers: ['first_name', 'email', 'company_name', 'phone_number', 'country_code', 'city', 'state'],
    output: {
      'first_name': 'lead_owner',
      'email': 'email',
      'company_name': 'company',
      'phone_number': 'mobile_without_country_code',
      'country_code': 'country_code',
      'city': 'city',
      'state': 'state',
    },
  },
  {
    headers: ['E-Mail', 'Firma', 'Ort', 'Land', 'Telefon', 'Bemerkungen'],
    output: {
      'E-Mail': 'email',
      'Firma': 'company',
      'Ort': 'city',
      'Land': 'country',
      'Telefon': 'mobile_without_country_code',
      'Bemerkungen': 'crm_note',
    },
  },
];

function getHfClient() {
  if (!hfClient && config.HF_TOKEN) {
    const { HfInference } = require('@huggingface/inference');
    hfClient = new HfInference(config.HF_TOKEN);
  }
  return hfClient;
}

function getGroqClient() {
  if (!groqClient && config.GROQ_API_KEY) {
    const OpenAI = require('openai');
    groqClient = new OpenAI({ apiKey: config.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
  }
  return groqClient;
}

function buildMappingPrompt(headers) {
  const exampleBlocks = FEW_SHOT_EXAMPLES.map(
    (ex) => `Input headers: ${ex.headers.join(', ')}\nOutput: ${JSON.stringify(ex.output)}`
  ).join('\n\n');

  return [
    `You are a CSV header mapper. Map each input header to the closest field from our schema.`,
    ``,
    `SCHEMA FIELDS (pick from these):`,
    SCHEMA_DESCRIPTION.map((f) => `  - ${f}`).join('\n'),
    ``,
    `RULES:`,
    `- If a header maps to nothing useful, map it to null`,
    `- Output ONLY valid JSON, no explanation, no markdown`,
    `- The JSON keys must be the EXACT input header strings`,
    `- The JSON values must be schema field names or null`,
    ``,
    `EXAMPLES:`,
    exampleBlocks,
    ``,
    `Now map these headers:`,
    headers.join(', '),
    `Output JSON:`,
  ].join('\n');
}

function buildDataExtractionPrompt(headers, rows) {
  return [
    `You are a data extraction assistant. Extract structured data from CSV rows into our schema.`,
    ``,
    `TARGET SCHEMA (use these exact field names):`,
    SCHEMA_DESCRIPTION.join('\n'),
    ``,
    `CSV HEADERS:`,
    headers.join(', '),
    ``,
    `RULES:`,
    `- Convert date-like strings to ISO 8601 format for "possession_time"`,
    `- Strip country codes from phone numbers and put them in "country_code"`,
    `- Output a JSON array of objects, one per row`,
    `- Use null for missing values`,
    `- Output ONLY valid JSON, no explanation`,
    ``,
    `ROWS:`,
    rows.map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join('\n'),
    ``,
    `Output JSON array:`,
  ].join('\n');
}

async function hfFetch(url, body, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new Error(`HF ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}

async function completeWithHF(prompt, options = {}) {
  const model = options.model || config.LLM_MODEL;
  const maxTokens = options.maxTokens || 800;
  const temperature = options.temperature || 0.1;

  if (!config.HF_TOKEN) throw new Error('HF_TOKEN not configured');

  const apiBase = 'https://api-inference.huggingface.co/models';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const data = await hfFetch(`${apiBase}/${model}`, {
      inputs: prompt,
      parameters: { max_new_tokens: maxTokens, temperature, return_full_text: false },
    }, controller.signal);
    clearTimeout(timeout);

    if (Array.isArray(data)) {
      const text = data[0]?.generated_text;
      if (text) return text;
    }
    if (typeof data === 'string') return data;
    if (data?.generated_text) return data.generated_text;

    throw new Error(`Unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
  } catch (err) {
    clearTimeout(timeout);

    if (err.message.includes('ENOTFOUND') || err.message.includes('fetch failed') || err.message.includes('aborted')) {
      throw new Error(`HF API unreachable (DNS/network). Run on your machine where api-inference.huggingface.co resolves.`);
    }

    if (err.message.includes('504') || err.message.includes('503') || err.message.includes('400') || err.message.includes('not supported')) {
      try {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 30000);
        const data = await hfFetch(`${apiBase}/${model}/v1/chat/completions`, {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        }, controller2.signal);
        clearTimeout(timeout2);
        return data.choices?.[0]?.message?.content || JSON.stringify(data);
      } catch (chatErr) {
        clearTimeout(timeout2);
        throw new Error(`HF chat failed. ${chatErr.message}`);
      }
    }

    throw err;
  }
}

async function completeWithGroq(prompt, options = {}) {
  const client = getGroqClient();
  if (!client) throw new Error('GROQ_API_KEY not configured');

  const model = options.model || config.LLM_MODEL || 'llama-3.3-70b-versatile';
  const maxTokens = options.maxTokens || 1000;

  const out = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are a precise data extraction assistant. Output only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: options.temperature || 0.1,
    max_tokens: maxTokens,
  });
  return out.choices[0].message.content;
}

function extractJson(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`Failed to parse JSON: ${e.message}\nRaw: ${text.slice(0, 500)}`);
    }
  }
  throw new Error(`No JSON found in LLM response:\n${text.slice(0, 500)}`);
}

function buildSummaryPrompt(sessionInfo, headers, sampleRows, mapping, columnStats, dataQuality) {
  const qualityLabel = dataQuality.isMessy ? 'MESSY / NOISY' : 'CLEAN / WELL-STRUCTURED';

  const statsBlock = columnStats.map((c) =>
    `  "${c.name}": type=${c.type}, completeness=${c.completeness}%, uniqueness=${c.uniqueness}%, nulls=${c.nullCount}, format_consistency=${c.formatConsistency}%`
  ).join('\n');

  const qualityBlock = [
    `Dataset quality assessment: ${qualityLabel}`,
    `  Messiness score: ${dataQuality.messinessScore}/100`,
    `  Avg completeness: ${dataQuality.avgCompleteness}%`,
    `  Avg uniqueness: ${dataQuality.avgUniqueness}%`,
    `  Columns with <80% completeness: ${dataQuality.lowCompletenessCols}`,
    `  Columns with inconsistent formats: ${dataQuality.inconsistenFormatCols}`,
  ].join('\n');

  const analysisDirective = dataQuality.isMessy
    ? [
        `FOCUS ON DATA CLEANING:`,
        `- Identify inconsistent formats (dates, phones, emails)`,
        `- Suggest normalization for messy columns`,
        `- Flag columns that might be split or merged`,
        `- Prioritize actionable cleaning steps`,
        `- Assess if the header mapping is reliable given the messiness`,
      ].join('\n')
    : [
        `FOCUS ON INSIGHTS:`,
        `- Identify key patterns and distributions`,
        `- Assess data coverage per schema field`,
        `- Suggest enrichment opportunities`,
        `- Evaluate mapping quality and completeness`,
        `- Flag any subtle issues (e.g., near-duplicates, outliers)`,
      ].join('\n');

  return [
    `You are a CSV data analyst. Analyze the following dataset and return a structured JSON analysis.`,
    ``,
    `DATASET INFO:`,
    `- Filename: ${sessionInfo.filename}`,
    `- Total rows: ${sessionInfo.totalRows}`,
    `- Status: ${sessionInfo.status}`,
    ``,
    `HEADERS AND MAPPING:`,
    headers.map((h) => `  "${h}" → ${mapping[h] || 'unmapped'}`).join('\n'),
    ``,
    `COMPUTED COLUMN STATISTICS:`,
    statsBlock,
    ``,
    qualityBlock,
    ``,
    `SAMPLE ROWS (${sampleRows.length} shown):`,
    JSON.stringify(sampleRows, null, 2),
    ``,
    `ANALYSIS DIRECTIVE:`,
    analysisDirective,
    ``,
    `OUTPUT RULES — follow these EXACTLY:`,
    `- "overallSummary": 1-2 sentence summary of what this dataset contains and its quality`,
    `- "dataQualityScore": 0-100 score based on completeness, consistency, and mapping quality`,
    `- "datasetQuality": MUST be EXACTLY "${qualityLabel}" — copy verbatim, do not paraphrase`,
    `- "columns": array with one entry per column:`,
    `    { "name": string, "type": string, "completeness": 0-100, "uniqueness": 0-100,`,
    `      "mappingConfidence": "high"|"medium"|"low", "issues": string|null }`,
    `- "recommendations": array of 3-7 actionable strings tailored to the dataset quality`,
    `- Output ONLY valid JSON, no explanation, no markdown. No trailing text.`,
    ``,
    `Output JSON:`,
  ].join('\n');
}

module.exports = {
  getHfClient,
  getGroqClient,
  buildMappingPrompt,
  buildDataExtractionPrompt,
  buildSummaryPrompt,
  completeWithHF,
  completeWithGroq,
  extractJson,
  FEW_SHOT_EXAMPLES,
};