const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createServer } = require('./server.cjs');
const record = { version: 6, studentCode: '0101', exportedAt: new Date().toISOString(), lastLesson: '', exams: [], examDetails: [] };
for (const key of ['drafts','submissions','experiments','understanding','wordDrafts','wordSubmissions','missionNotes','boughtHints','practiced','coins','attitude','summary']) record[key] = {};

test('receive, persist unchanged, reject invalid requests, and never overwrite', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddl-test-'));
  const server = createServer({ dataDir: dir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/submissions`;
  const post = (body, origin = 'https://naturespa.github.io') => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  try {
    const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://naturespa.github.io', 'Access-Control-Request-Private-Network': 'true' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://naturespa.github.io');
    assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
    const a = await post(record); assert.equal(a.status, 201);
    const receipt = await a.json(); assert.equal(receipt.ok, true); assert.equal(receipt.studentCode, '0101');
    const files = await fs.readdir(dir); assert.equal(files.length, 1);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, files[0]), 'utf8')), record);
    const b = await post(record); assert.equal(b.status, 201); assert.notEqual((await b.json()).receiptId, receipt.receiptId);
    assert.equal((await fs.readdir(dir)).length, 2);
    assert.equal((await post(record, 'https://untrusted.example')).status, 403);
    assert.equal((await post('{')).status, 400);
    assert.equal((await post({ ...record, studentCode: '../x' })).status, 400);
    assert.equal((await post({ ...record, version: 5 })).status, 400);
    assert.equal((await post({ ...record, summary: null })).status, 400);
    assert.equal((await post('x'.repeat(2 * 1024 * 1024 + 1))).status, 413);
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(url.replace('/api/submissions', '/data/' + files[0]))).status, 404);
    assert.equal((await fs.readdir(dir)).length, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('disk failure must not return a success receipt', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddl-fail-'));
  const file = path.join(dir, 'not-a-directory');
  await fs.writeFile(file, 'test');
  const server = createServer({ dataDir: file });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/submissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
    assert.equal(response.status, 500); assert.equal((await response.json()).ok, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('offline admin lists real submissions, exports CSV and JSON, and rejects nonlocal hosts and origins', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddl-admin-'));
  const server = createServer({ dataDir: dir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  const value = { ...record, summary: { totalScore: 72, totalMax: 100, perspective: { knowledge: 80, thinking: 70, attitude: 66 }, completedLessons: 8, lessonCount: 10 }, exams: [{ area: 'digital', kind: 'main', setId: '=HYPERLINK("evil")', score: 16, max: 20, rate: 80, finishedAt: record.exportedAt }] };
  try {
    const sent = await fetch(root + '/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://naturespa.github.io' }, body: JSON.stringify(value) });
    assert.equal(sent.status, 201);
    assert.equal((await fetch(root + '/admin')).status, 200);
    assert.match(await (await fetch(root + '/admin/admin.js')).text(), /studentCode/);
    assert.equal((await fetch(root + '/admin/admin.css')).status, 200);
    const listing = await (await fetch(root + '/api/admin/submissions')).json();
    assert.equal(listing.records.length, 1);
    assert.equal(listing.records[0].totalScore, 72);
    assert.equal(listing.records[0].examCount, 1);
    const file = listing.records[0].file;
    assert.deepEqual(await (await fetch(root + `/api/admin/files/${file}`)).json(), value);
    const summary = await (await fetch(root + '/api/admin/summary.csv')).text();
    assert.match(summary, /受験番号/); assert.match(summary, /"72"/);
    const exams = await (await fetch(root + '/api/admin/exams.csv')).text();
    assert.match(exams, /'\=HYPERLINK/);
    assert.equal((await fetch(root + '/api/admin/files/..%2fserver.cjs')).status, 404);
    const nonlocalHost = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: server.address().port, path: '/admin', headers: { Host: '192.168.1.50:3002' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(nonlocalHost, 403);
    assert.equal((await fetch(root + '/api/admin/submissions', { headers: { Origin: 'https://naturespa.github.io' } })).status, 403);
    assert.equal((await fetch(root + '/api/admin/submissions', { method: 'POST' })).status, 405);
    assert.equal((await fetch(root + '/api/admin/nope')).status, 404);
    await fs.writeFile(path.join(dir, '0101_2026-09-29T01-01-01-000Z_00000000-0000-0000-0000-000000000000.json'), '{broken');
    assert.equal((await (await fetch(root + '/api/admin/submissions')).json()).skipped, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
