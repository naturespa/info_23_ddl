const fs = require('node:fs/promises');
const path = require('node:path');

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
module.exports = { FILE_RE, listRecords, summaryCsv, examsCsv };
