// 確認問題に添える図。教科書の図を写すのではなく、同じことを説明する図を自分で描いている。

import type { QuestionFigureName } from "./types";

/** 主記憶に命令が番地順に並び、プログラムカウンタがその番地を指している様子 */
const MemoryFetch = () => {
  const rows = [
    { addr: "100", body: "LOAD  A" },
    { addr: "101", body: "ADD   B" },
    { addr: "102", body: "STORE C" },
    { addr: "103", body: "JUMP  100" }
  ];
  return (
    <svg viewBox="0 0 360 150" className="q-figure" role="img" aria-label="主記憶に番地順に並んだ命令と、次に取り出す番地を指すレジスタ">
      <text x={96} y={14} className="qf-title">主記憶（番地の小さい順に命令が並ぶ）</text>
      {rows.map((r, i) => (
        <g key={r.addr}>
          <rect x={30} y={22 + i * 28} width={44} height={24} rx={4} className="qf-cell addr" />
          <text x={52} y={38 + i * 28} className="qf-text">{r.addr}</text>
          <rect x={78} y={22 + i * 28} width={104} height={24} rx={4} className={`qf-cell ${i === 1 ? "now" : ""}`} />
          <text x={130} y={38 + i * 28} className="qf-text mono">{r.body}</text>
        </g>
      ))}
      <text x={14} y={38} className="qf-note">↓</text>
      <text x={14} y={130} className="qf-note">↓</text>
      <line x1={16} y1={30} x2={16} y2={128} className="qf-line" />

      {/* 取り出し中の命令 */}
      <line x1={182} y1={62} x2={228} y2={62} className="qf-line arrow" markerEnd="url(#qfhead)" />
      <text x={205} y={56} className="qf-note">取り出す</text>
      <rect x={228} y={48} width={120} height={28} rx={5} className="qf-cell now" />
      <text x={288} y={66} className="qf-text">命令レジスタ</text>

      {/* 番地を指しているレジスタ */}
      <line x1={288} y1={100} x2={288} y2={80} className="qf-line arrow" markerEnd="url(#qfhead)" />
      <rect x={214} y={100} width={148} height={30} rx={5} className="qf-cell" />
      <text x={288} y={112} className="qf-text">次に取り出す命令の番地</text>
      <text x={288} y={124} className="qf-text mono">101</text>
      <defs>
        <marker id="qfhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" className="qf-head" />
        </marker>
      </defs>
    </svg>
  );
};

const figures: Record<QuestionFigureName, () => React.JSX.Element> = {
  "memory-fetch": MemoryFetch
};

export const QuestionFigure = ({ name }: { name: QuestionFigureName }) => {
  const Fig = figures[name];
  return Fig ? <Fig /> : null;
};
