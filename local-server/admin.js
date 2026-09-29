'use strict';
const $ = id => document.getElementById(id);
let records = [];

function localDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ja-JP');
}
function cell(row, value) {
  const td = document.createElement('td');
  td.textContent = value == null || value === '' ? '—' : String(value);
  row.append(td);
  return td;
}
function render() {
  const q = $('query').value.trim();
  const counts = new Map();
  for (const record of records) counts.set(record.studentCode, (counts.get(record.studentCode) ?? 0) + 1);
  $('file-count').textContent = records.length;
  $('student-count').textContent = counts.size;
  $('repeat-count').textContent = [...counts.values()].filter(count => count > 1).length;
  const seen = new Set();
  const filtered = records.filter(record => {
    if ($('latest').checked) {
      if (seen.has(record.studentCode)) return false;
      seen.add(record.studentCode);
    }
    return !q || record.studentCode.includes(q);
  });
  $('shown').textContent = `${filtered.length}件表示 / 全${records.length}件`;
  const rows = $('rows');
  rows.replaceChildren();
  for (const record of filtered) {
    const row = document.createElement('tr');
    cell(row, record.studentCode);
    cell(row, localDate(record.receivedAt));
    cell(row, record.totalScore == null ? '—' : `${record.totalScore} / ${record.totalMax ?? '?'}`);
    cell(row, `知 ${record.knowledge ?? '—'}・思 ${record.thinking ?? '—'}・態 ${record.attitude ?? '—'}`);
    cell(row, record.completedLessons == null ? '—' : `${record.completedLessons} / ${record.lessonCount ?? '?'}`);
    const exams = document.createElement('td');
    exams.textContent = record.examCount === 0 ? '0件' : `${record.examCount}件 `;
    if (record.examCount) {
      const details = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = '得点を見る';
      details.append(summary);
      for (const exam of record.exams) {
        const line = document.createElement('p');
        line.textContent = `${exam.area ?? ''} ${exam.kind ?? ''}：${exam.score ?? '—'} / ${exam.max ?? '—'}（${localDate(exam.finishedAt)}）`;
        details.append(line);
      }
      exams.append(details);
    }
    row.append(exams);
    cell(row, counts.get(record.studentCode) > 1 ? `${counts.get(record.studentCode)}回提出` : '—');
    const download = document.createElement('td');
    const link = document.createElement('a');
    link.href = `/api/admin/files/${encodeURIComponent(record.file)}`;
    link.download = record.file;
    link.textContent = 'JSONを保存';
    download.append(link); row.append(download); rows.append(row);
  }
  $('message').textContent = records.length ? (filtered.length ? '' : '該当する提出はありません。') : 'まだ提出がありません。';
}
async function refresh() {
  $('refresh').disabled = true;
  $('message').textContent = '読み込み中…';
  try {
    const response = await fetch('/api/admin/submissions', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.records)) throw new Error('形式が正しくありません');
    records = result.records;
    render();
    if (result.skipped) $('message').textContent = `${result.skipped}件のJSONを読み込めませんでした。dataフォルダーを確認してください。`;
  } catch (error) {
    $('message').textContent = `提出一覧を読み込めませんでした（${error.message}）。サーバーを確認して更新してください。`;
  } finally { $('refresh').disabled = false; }
}
$('query').addEventListener('input', render);
$('latest').addEventListener('change', render);
$('refresh').addEventListener('click', refresh);
refresh();
