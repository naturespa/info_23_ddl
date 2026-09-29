// Node.js 標準機能だけで動く、DDL学習記録の受信専用サーバー。
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const os = require('node:os');

const FILE_RE = /^(\d{4})_(\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z)_([0-9a-f-]{36})\.json$/i;

async function listRecords(dataDir) {
  let names;
  try { names = await fs.readdir(dataDir); }
  catch (error) { if (error.code === 'ENOENT') return { records: [], skipped: 0 }; throw error; }
  const records = [];
  let skipped = 0;
  for (const name of names) {
    const match = FILE_RE.exec(name);
    if (!match) continue;
    try {
      const value = JSON.parse(await fs.readFile(path.join(dataDir, name), 'utf8'));
      if (value.version !== 6 || value.studentCode !== match[1]) throw new Error('Unexpected record');
      const summary = value.summary ?? {};
      const perspective = summary.perspective ?? {};
      records.push({
        file: name, studentCode: value.studentCode, receivedAt: match[2].replace(/^(\d{4}-\d\d-\d\d)T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z$/, '$1T$2:$3:$4.$5Z'),
        receiptId: match[3], exportedAt: value.exportedAt,
        totalScore: summary.totalScore ?? null, totalMax: summary.totalMax ?? null,
        knowledge: perspective.knowledge ?? null, thinking: perspective.thinking ?? null, attitude: perspective.attitude ?? null,
        completedLessons: summary.completedLessons ?? null, lessonCount: summary.lessonCount ?? null,
        examCount: Array.isArray(value.exams) ? value.exams.length : 0,
        exams: Array.isArray(value.exams) ? value.exams.map(exam => ({ area: exam.area, kind: exam.kind, setId: exam.setId, score: exam.score, max: exam.max, rate: exam.rate, finishedAt: exam.finishedAt })) : []
      });
    } catch { skipped += 1; }
  }
  records.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.file.localeCompare(a.file));
  return { records, skipped };
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  // Excel等で開く場合に、CSV由来の式として実行されないようにする。
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
function csv(rows) { return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
function summaryCsv(records) {
  return csv([
    ['受験番号','受信日時(UTC)','送信日時','受付番号','総合点','満点','知識・技能(%)','思考・判断・表現(%)','主体的態度(%)','完走単元','全単元','分野別テスト件数','保存ファイル'],
    ...records.map(r => [r.studentCode,r.receivedAt,r.exportedAt,r.receiptId,r.totalScore,r.totalMax,r.knowledge,r.thinking,r.attitude,r.completedLessons,r.lessonCount,r.examCount,r.file])
  ]);
}
function examsCsv(records) {
  return csv([
    ['受験番号','受信日時(UTC)','受付番号','分野','種類','セットID','得点','満点','得点率','テスト終了日時','保存ファイル'],
    ...records.flatMap(r => r.exams.map(e => [r.studentCode,r.receivedAt,r.receiptId,e.area,e.kind,e.setId,e.score,e.max,e.rate,e.finishedAt,r.file]))
  ]);
}

function lanAddresses(interfaces) {
  if (!interfaces) {
    try { interfaces = os.networkInterfaces(); }
    catch (error) { console.error('LAN address lookup failed:', error.code || error.name); return []; }
  }
  return Object.entries(interfaces).flatMap(([interfaceName, values]) => (values || [])
    .filter(item => item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.'))
    .map(item => ({ interfaceName, address: item.address })));
}
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
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    const adminPath = req.url === '/admin' || req.url === '/admin/' || req.url?.startsWith('/admin/') || req.url?.startsWith('/api/admin/');
    if (adminPath) {
      // IPだけを知る生徒端末には管理APIも管理画面も渡さない。
      const localPeer = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(req.headers.host || '');
      if (!localPeer || !localHost) return reply(403, { ok: false, error: 'Administration is available on the server PC only' });
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return reply(403, { ok: false, error: 'Invalid origin' });
      if (req.method !== 'GET') return reply(405, { ok: false, error: 'GET required' });
      try {
        const file = req.url.match(/^\/api\/admin\/files\/([^/?#]+)$/);
        if (file) {
          const name = decodeURIComponent(file[1]);
          if (!FILE_RE.test(name)) return reply(404, { ok: false, error: 'Not found' });
          let body;
          try { body = await fs.readFile(path.join(dataDir, name)); }
          catch (error) { if (error.code === 'ENOENT') return reply(404, { ok: false, error: 'Not found' }); throw error; }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` });
          return res.end(body);
        }
        if (req.url === '/admin' || req.url === '/admin/') {
          const nonce = randomUUID();
          const html = (await fs.readFile(path.join(__dirname, 'admin.html'), 'utf8')).replaceAll('__DDL_NONCE__', nonce);
          res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'`);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
        if (req.url === '/api/admin/network') return reply(200, { ok: true, addresses: lanAddresses(), port: server.address()?.port ?? null });
        if (req.url === '/api/admin/submissions' || req.url === '/api/admin/summary.csv' || req.url === '/api/admin/exams.csv') {
          const result = await listRecords(dataDir);
          if (req.url === '/api/admin/submissions') return reply(200, { ok: true, ...result });
          const body = req.url.endsWith('summary.csv') ? summaryCsv(result.records) : examsCsv(result.records);
          res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ddl-${req.url.endsWith('summary.csv') ? 'summary' : 'exams'}.csv"` });
          return res.end(body);
        }
        return reply(404, { ok: false, error: 'Not found' });
      } catch (error) {
        console.error('Admin read failed:', error.code || error.name);
        return reply(500, { ok: false, error: 'Could not read records' });
      }
    }
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
  return server;
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
    console.log(`管理画面（先生PC） http://localhost:${port}/admin`);
    console.log(`接続テスト（先生PC） http://localhost:${port}/health`);
    const addresses = lanAddresses();
    for (const item of addresses) {
      console.log(`生徒に伝えるIP（${item.interfaceName}） ${item.address}`);
      console.log(`接続テスト（LAN） http://${item.address}:${port}/health`);
    }
    if (!addresses.length) console.log('LANのIPv4アドレスが見つかりません。ネットワーク接続を確認してください。');
    console.log(`保存先 ${dataDir}\n終了 Ctrl+C`);
  });
}
module.exports = { createServer, validRecord, lanAddresses };
