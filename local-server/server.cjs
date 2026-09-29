// Node.js 標準機能だけで動く、DDL学習記録の受信専用サーバー。
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const MAX_BYTES = 2 * 1024 * 1024;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function validRecord(record) {
  return isObject(record) && record.version === 6 && /^\d{4}$/.test(record.studentCode) && typeof record.studentCode === 'string'
    && typeof record.exportedAt === 'string' && Number.isFinite(Date.parse(record.exportedAt))
    && ['drafts', 'submissions', 'experiments', 'understanding', 'wordDrafts', 'wordSubmissions', 'missionNotes', 'boughtHints', 'practiced', 'coins', 'attitude', 'summary'].every((key) => isObject(record[key]))
    && typeof record.lastLesson === 'string' && Array.isArray(record.exams) && Array.isArray(record.examDetails);
}

function createServer({ dataDir = path.join(__dirname, 'data'), allowedOrigins = ['https://naturespa.github.io'] } = {}) {
  const origins = new Set(allowedOrigins);
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) return reply(403, { ok: false, error: 'Origin not allowed' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      // 対応ブラウザのPrivate Network Accessプリフライト用。ブラウザ側の許可は別途必要。
      if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    if (req.method === 'OPTIONS' && req.url === '/api/submissions') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true, service: 'info-23-ddl-json' });
    if (req.url !== '/api/submissions') return reply(404, { ok: false, error: 'Not found' });
    if (req.method !== 'POST') return reply(405, { ok: false, error: 'POST required' });
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return reply(415, { ok: false, error: 'application/json required' });
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) { reply(413, { ok: false, error: 'Maximum size is 2 MiB' }); req.resume(); return; }
        chunks.push(chunk);
      }
      let record;
      try { record = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return reply(400, { ok: false, error: 'Invalid JSON' }); }
      if (!validRecord(record)) return reply(400, { ok: false, error: 'Invalid DDL version 6 record' });
      const receivedAt = new Date().toISOString();
      const receiptId = randomUUID();
      const filename = `${record.studentCode}_${receivedAt.replace(/[:.]/g, '-')}_${receiptId}.json`;
      await fs.mkdir(dataDir, { recursive: true });
      // flush完了後だけ成功応答。同じ番号の再送も上書きしない。
      await fs.writeFile(path.join(dataDir, filename), JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600, flush: true });
      reply(201, { ok: true, studentCode: record.studentCode, receiptId, receivedAt });
    } catch (error) {
      console.error('JSON save failed:', error.code || error.name);
      if (!res.headersSent && !res.destroyed) reply(500, { ok: false, error: 'Could not save record' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3002);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://naturespa.github.io').split(',').map(s => s.trim()).filter(Boolean);
  const server = createServer({ dataDir, allowedOrigins });
  server.requestTimeout = 30000;
  server.on('error', error => { console.error(`Server error: ${error.code}`); process.exitCode = 1; });
  server.listen(port, process.env.HOST || '0.0.0.0', () => {
    console.log(`DDL JSON receiver: port ${port}\nSave folder: ${dataDir}\nAllowed origins: ${allowedOrigins.join(', ')}\nStop: Ctrl+C`);
  });
}
module.exports = { createServer, validRecord };
