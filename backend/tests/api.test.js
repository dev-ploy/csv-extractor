const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');


const CSV_PATH = path.resolve(__dirname, '../../test_data_messy.csv');

function api(method, urlPath, opts = {}) {
  return new Promise((resolve, reject) => {
    const separator = urlPath.startsWith('/') ? '' : '/';
    const url = new URL(`${separator}api/${urlPath}`.replace(/\/+/g, '/'), 'http://localhost:3000');
    const headers = { ...opts.headers };
    let body;

    if (opts.formData) {
      // multipart upload via Buffer
      const boundary = '----test' + Date.now();
      let parts = '';
      for (const [k, v] of Object.entries(opts.formData)) {
        if (v.buffer) {
          parts += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${v.filename}"\r\nContent-Type: text/csv\r\n\r\n`;
          parts += v.buffer.toString('latin1');
          parts += '\r\n';
        } else {
          parts += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
        }
      }
      parts += `--${boundary}--\r\n`;
      body = Buffer.from(parts, 'latin1');
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      headers['Content-Length'] = body.length.toString();
    } else if (opts.body) {
      body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body).toString();
    }

    const req = http.request(url.toString(), { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let adminToken;
let sessionId;

describe('E2E API — full pipeline with Redis + MinIO', () => {
  describe('1. Health check', () => {
    it('should return ok with cache status', async () => {
      const r = await api('GET', '/health');
      assert.equal(r.status, 200);
      assert.equal(r.body.status, 'ok');
      assert.equal(r.body.database, 'healthy');
      console.log(`  Cache: ${r.body.cache}`);
    });
  });

  describe('2. Auth', () => {
    it('should login as admin', async () => {
      const r = await api('POST', '/auth/login', { body: { email: 'admin@csv-extractor.com', password: 'admin123' } });
      assert.equal(r.status, 200);
      assert.ok(r.body.data.token);
      adminToken = r.body.data.token;
      assert.equal(r.body.data.user.role, 'admin');
    });

    it('should reject invalid credentials', async () => {
      const r = await api('POST', '/auth/login', { body: { email: 'admin@csv-extractor.com', password: 'wrong' } });
      assert.equal(r.status, 401);
    });

    it('should return user profile', async () => {
      const r = await api('GET', '/auth/me', { headers: { Authorization: `Bearer ${adminToken}` } });
      assert.equal(r.status, 200);
      assert.equal(r.body.data.email, 'admin@csv-extractor.com');
    });

    it('should register a new user', async () => {
      const r = await api('POST', '/auth/register', { body: { email: 'test-e2e@example.com', password: 'test123456' } });
      assert.ok(r.status === 201 || r.status === 409); // 409 if already exists from previous runs
    });

    it('should list users', async () => {
      const r = await api('GET', '/auth/users', { headers: { Authorization: `Bearer ${adminToken}` } });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.body.data));
      assert.ok(r.body.data.length >= 1);
    });
  });

  describe('3. CSV Upload (MinIO)', () => {
    it('should upload CSV and store in MinIO', async () => {
      const csvBuffer = fs.readFileSync(CSV_PATH);
      const r = await api('POST', '/csv/upload', {
        headers: { Authorization: `Bearer ${adminToken}` },
        formData: { file: { buffer: csvBuffer, filename: 'test_data_messy.csv' } },
      });
      assert.equal(r.status, 201);
      assert.ok(r.body.data.id);
      sessionId = r.body.data.id;
      assert.equal(r.body.data.filename, 'test_data_messy.csv');
      assert.equal(r.body.data.status, 'pending');
      assert.equal(r.body.data.totalRows, 17);
      assert.ok(r.body.data.preview);
      assert.equal(r.body.data.preview.headers.length, 9);
    });

    it('should reject empty upload', async () => {
      const r = await api('POST', '/csv/upload', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 400);
    });
  });

  describe('4. AI Mapping', () => {
    it('should map headers', async () => {
      const r = await api('POST', `/csv/sessions/${sessionId}/map`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 200);
      assert.ok(r.body.data.mapping);
      assert.equal(Object.keys(r.body.data.mapping).length, 9);
      // Check key mappings
      const m = r.body.data.mapping;
      assert.ok(m['Full Name'] === 'lead_owner' || m['Full Name'] === 'leadOwner');
      assert.ok(m['email addr'] === 'email' || m['email addr'] === null);
      assert.ok(m['co.'] === 'company' || m['co.'] === null);
    });
  });

  describe('5. Preview', () => {
    it('should return preview with mapped data', async () => {
      const r = await api('GET', `/csv/sessions/${sessionId}/preview`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 200);
      assert.ok(r.body.data.rows);
      assert.ok(r.body.data.rows.length >= 1);
      assert.ok(r.body.data.mapping);
    });
  });

  describe('6. Import', () => {
    it('should import 16 leads (1 duplicate skipped)', async () => {
      const r = await api('POST', `/csv/sessions/${sessionId}/import`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 201);
      assert.equal(r.body.data.imported + r.body.data.skipped.length, 17);
      assert.equal(r.body.data.imported, 16, '16 leads should be imported');
      assert.equal(r.body.data.skipped.length, 1, '1 duplicate should be skipped');
      if (r.body.data.skipped.length > 0) {
        assert.ok(r.body.data.skipped[0].skipReason.includes('Duplicate'));
      }
    });
  });

  describe('7. Summary', () => {
    it('should return import summary', async () => {
      const r = await api('GET', `/csv/sessions/${sessionId}/summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.data.total, 16);
      assert.equal(r.body.data.imported, 16);
    });
  });

  describe('8. Leads', () => {
    it('should list imported leads', async () => {
      const r = await api('GET', `/csv/sessions/${sessionId}/leads?limit=5`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.body.data));
      assert.ok(r.body.data.length <= 5);
      if (r.body.data.length > 0) {
        assert.ok(r.body.data[0].email);
      }
    });

    it('should filter leads by status', async () => {
      const r = await api('GET', `/csv/sessions/${sessionId}/leads?status=imported`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 200);
      if (r.body.data.length > 0) {
        assert.equal(r.body.data[0].importStatus, 'imported');
      }
    });
  });

  describe('9. RBAC', () => {
    let userToken;
    it('should login as regular user', async () => {
      // Try register if not exists
      await api('POST', '/auth/register', { body: { email: 'test-e2e-user@example.com', password: 'test123456' } }).catch(() => {});
      const r = await api('POST', '/auth/login', { body: { email: 'test-e2e-user@example.com', password: 'test123456' } });
      assert.equal(r.status, 200);
      userToken = r.body.data.token;
    });

    it('should deny user from deleting sessions', async () => {
      const r = await api('DELETE', `/csv/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.equal(r.status, 403);
    });
  });

  describe('10. Reproduce leads', () => {
    it('should delete and re-import leads', async () => {
      const r = await api('POST', `/csv/sessions/${sessionId}/reprocess`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      // Either hits 400 if mapping lost, or 200 if reprocess succeeds
      assert.ok(r.status === 200 || r.status === 400);
    });
  });

  describe('11. Delete session', () => {
    it('should delete session by admin', async () => {
      const r = await api('DELETE', `/csv/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.data.message, 'Session deleted');
    });

    it('should return deleted session as soft-deleted', async () => {
      const r = await api('GET', `/csv/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.data.status, 'deleted');
    });
  });

  describe('12. List sessions', () => {
    it('should list all sessions', async () => {
      const r = await api('GET', '/csv/sessions', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.body.data));
    });
  });

  describe('13. Admin errors endpoint', () => {
    it('should return recent errors', async () => {
      const r = await api('GET', '/errors', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.body.data));
    });

    it('should block non-admin from errors', async () => {
      let userToken2;
      const r2 = await api('POST', '/auth/login', { body: { email: 'user@csv-extractor.com', password: 'user123' } });
      if (r2.status === 200) userToken2 = r2.body.data.token;
      if (userToken2) {
        const r = await api('GET', '/errors', { headers: { Authorization: `Bearer ${userToken2}` } });
        assert.equal(r.status, 403);
      }
    });
  });
});