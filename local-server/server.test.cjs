const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
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
