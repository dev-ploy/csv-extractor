const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\+\d\s\-\.\(\)]{6,20}$/;
const DATE_RE = /^\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const URL_RE = /^https?:\/\/.+/;
const BOOL_RE = /^(true|false|yes|no|0|1)$/i;

function inferType(values) {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'empty';

  let emailCount = 0, phoneCount = 0, dateCount = 0, isoDateCount = 0;
  let numberCount = 0, urlCount = 0, boolCount = 0;

  for (const v of nonEmpty) {
    const s = String(v).trim();
    if (EMAIL_RE.test(s)) emailCount++;
    else if (ISO_DATE_RE.test(s)) isoDateCount++;
    else if (DATE_RE.test(s)) dateCount++;
    else if (PHONE_RE.test(s)) phoneCount++;
    else if (NUMBER_RE.test(s)) numberCount++;
    else if (URL_RE.test(s)) urlCount++;
    else if (BOOL_RE.test(s)) boolCount++;
  }

  const total = nonEmpty.length;
  const threshold = 0.6;

  if (emailCount / total >= threshold) return 'email';
  if ((isoDateCount + dateCount) / total >= threshold) return 'date';
  if (phoneCount / total >= threshold) return 'phone';
  if (numberCount / total >= threshold) return 'number';
  if (urlCount / total >= threshold) return 'url';
  if (boolCount / total >= threshold) return 'boolean';
  return 'text';
}

function detectFormatConsistency(values) {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length < 2) return 100;

  const type = inferType(values);
  if (type === 'date') {
    const formats = {};
    for (const v of nonEmpty) {
      const s = String(v).trim();
      let fmt = 'other';
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) fmt = 'ISO';
      else if (/^\d{2}[-/\.]\d{2}[-/\.]\d{4}/.test(s)) fmt = 'DD/MM/YYYY';
      else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s)) fmt = 'M/D/YY';
      else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) fmt = 'YYYY/M/D';
      formats[fmt] = (formats[fmt] || 0) + 1;
    }
    const maxFmt = Math.max(...Object.values(formats));
    return Math.round((maxFmt / nonEmpty.length) * 100);
  }

  if (type === 'phone') {
    const withPlus = nonEmpty.filter(v => String(v).trim().startsWith('+')).length;
    return Math.round((withPlus / nonEmpty.length) * 100);
  }

  return 100;
}

function computeColumnStats(columnName, values, totalRows) {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  const unique = new Set(nonNull.map(v => String(v).trim().toLowerCase()));
  const type = inferType(values);
  const formatConsistency = detectFormatConsistency(values);

  const sampleValues = [...new Set(nonNull.map(v => String(v).trim()))].slice(0, 5);

  return {
    name: columnName,
    type,
    completeness: Math.round((nonNull.length / totalRows) * 100),
    uniqueness: Math.round((unique.size / Math.max(totalRows, 1)) * 100),
    nullCount: totalRows - nonNull.length,
    sampleValues,
    formatConsistency,
  };
}

function computeDatasetQuality(columnStats) {
  const avgCompleteness = columnStats.reduce((s, c) => s + c.completeness, 0) / columnStats.length;
  const avgUniqueness = columnStats.reduce((s, c) => s + c.uniqueness, 0) / columnStats.length;

  const lowCompletenessCols = columnStats.filter(c => c.completeness < 80).length;
  const lowConsistencyCols = columnStats.filter(c =>
    ['date', 'phone'].includes(c.type) && c.formatConsistency < 70
  ).length;

  const messinessScore = Math.round(
    ((100 - avgCompleteness) * 0.4) +
    ((100 - avgUniqueness) * 0.1) +
    (lowCompletenessCols / columnStats.length * 25) +
    (lowConsistencyCols / Math.max(columnStats.length, 1) * 25)
  );

  return {
    messinessScore: Math.min(messinessScore, 100),
    avgCompleteness: Math.round(avgCompleteness),
    avgUniqueness: Math.round(avgUniqueness),
    lowCompletenessCols,
    inconsistenFormatCols: lowConsistencyCols,
    isMessy: messinessScore > 25,
  };
}

module.exports = { computeColumnStats, computeDatasetQuality, inferType };
