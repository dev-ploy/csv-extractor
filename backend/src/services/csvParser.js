const { parse } = require('csv-parse/sync');
const { AppError } = require('../middlewares/errorHandler');

function parseCsvFile(buffer) {
  const raw = buffer.toString();
  if (!raw.trim()) throw new AppError('Empty CSV file', 400);

  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
    delimiter: [',', ';', '\t', '|'],
  });

  if (records.length === 0) throw new AppError('CSV has headers but no data rows', 400);
  return records;
}

function getHeaders(buffer) {
  const raw = buffer.toString();
  const firstLine = raw.split('\n')[0];
  return firstLine.split(/[;,|\t]/).map((h) => h.trim()).filter(Boolean);
}

function previewData(buffer, maxRows = 10) {
  const records = parseCsvFile(buffer);
  const headers = getHeaders(buffer);
  return { headers, totalRows: records.length, preview: records.slice(0, maxRows) };
}

function chunkRows(records, chunkSize = 50) {
  const chunks = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }
  return chunks;
}

function paginateRows(records, offset = 0, limit = 50) {
  return records.slice(offset, offset + limit);
}

function validateRow(row, mapping) {
  const errors = [];
  if (mapping.email && row[mapping.email] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[mapping.email])) {
    errors.push({ field: 'email', message: 'Invalid email format', value: row[mapping.email] });
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { parseCsvFile, getHeaders, previewData, chunkRows, paginateRows, validateRow };