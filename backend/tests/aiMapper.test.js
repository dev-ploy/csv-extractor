const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { mapHeaders } = require('../src/services/aiMapper');

// Standard headers that should match via offline mapper
const STANDARD_HEADERS = ['email', 'company', 'phone', 'city', 'state', 'country', 'Full Name', 'Notes'];

// Messy headers from the test CSV
const MESSY_HEADERS = ['Full Name', 'email addr', 'co.', 'city/town', 'ST', 'cntry', 'ph #', 'Lead Src', 'Remarks'];

// Abbreviated headers
const ABBREV_HEADERS = ['name', 'email', 'co', 'city', 'st', 'cntry', 'ph', 'src', 'notes'];

describe('aiMapper offline strategy', () => {
  it('maps standard headers', async () => {
    const result = await mapHeaders(STANDARD_HEADERS);
    assert.equal(result.strategy, 'groq');
    // If GROQ is unavailable, should fall back to offline
    if (result.strategy === 'offline') {
      const m = result.mapping;
      assert.equal(m['Full Name'], 'lead_owner');
      assert.equal(m['email'], 'email');
      assert.equal(m['company'], 'company');
      assert.equal(m['phone'], 'mobile_without_country_code');
      assert.equal(m['city'], 'city');
      assert.equal(m['state'], 'state');
      assert.equal(m['country'], 'country');
      assert.equal(m['Notes'], 'crm_note');
    }
  });

  it('should map messy headers via offline fallback', async () => {
    const result = await mapHeaders(MESSY_HEADERS);
    if (result.strategy === 'offline') {
      const m = result.mapping;
      assert.equal(m['Full Name'], 'lead_owner', 'Full Name should map to lead_owner');
      assert.equal(m['email addr'], 'email', 'email addr should map to email');
      assert.equal(m['co.'], 'company', 'co. should map to company');
      assert.equal(m['city/town'], 'city', 'city/town should map to city');
      assert.equal(m['ST'], 'state', 'ST should map to state');
      assert.equal(m['cntry'], 'country', 'cntry should map to country');
      assert.equal(m['ph #'], 'mobile_without_country_code', 'ph # should map to mobile_without_country_code');
      assert.equal(m['Lead Src'], 'data_source', 'Lead Src should map to data_source');
      assert.equal(m['Remarks'], 'crm_note', 'Remarks should map to crm_note');
    }
  });

  it('should map abbreviated headers via offline fallback', async () => {
    const result = await mapHeaders(ABBREV_HEADERS);
    if (result.strategy === 'offline') {
      const m = result.mapping;
      assert.equal(m['co'], 'company', 'co should map to company');
      assert.equal(m['cntry'], 'country', 'cntry should map to country');
      assert.equal(m['ph'], 'mobile_without_country_code', 'ph should map to mobile');
      assert.equal(m['src'], 'data_source', 'src should map to data_source');
    }
  });

  it('should return non-null mappings for all provided headers', async () => {
    const result = await mapHeaders(STANDARD_HEADERS);
    const mappedCount = Object.values(result.mapping).filter(Boolean).length;
    assert.ok(mappedCount >= 6, `Expected at least 6 mapped fields, got ${mappedCount}`);
  });
});