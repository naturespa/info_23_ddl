"use client";

// 実験カードの中で使う共通部品。
// すべての実験は「自分で数値や文字を入力 → その場で結果が変わる」形にそろえる。

import { createContext, useContext, type ReactNode } from "react";
import { clamp, normalPdf, tPdf } from "./calc";

/* ---------- 入力部品 ---------- */

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <i className="field-hint">{hint}</i>}
      </span>
      <span className="field-input">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          max={max}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(min !== undefined && max !== undefined ? clamp(next, min, max) : next);
          }}
        />
        {unit && <em>{unit}</em>}
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <i className="field-hint">{hint}</i>}
      </span>
      <span className="field-input">
        <input
          className={mono ? "mono" : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

export function AreaField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  rows = 3
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <label className="field field-wide">
      <span className="field-label">
        {label}
        {hint && <i className="field-hint">{hint}</i>}
      </span>
      <textarea rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <i className="field-hint">{hint}</i>}
      </span>
      <span className="field-input">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <label className="field field-wide">
      <span className="field-label">
        {label}
        <b className="field-value">
          {value.toLocaleString("ja-JP")}
          {unit}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <b>{on ? 1 : 0}</b>
    </button>
  );
}

export function Tabs({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 表示部品 ---------- */

export function Row({ children }: { children: ReactNode }) {
  return <div className="input-row">{children}</div>;
}

export function Results({ items }: { items: { label: string; value: ReactNode; note?: string; warn?: boolean }[] }) {
  return (
    <div className="result-cards" aria-live="polite">
      {items.map((item, index) => (
        <div className={`result-card ${item.warn ? "warn" : ""}`} key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <b>{item.value}</b>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </div>
  );
}

export function Steps({ items }: { items: { label: string; value: ReactNode; note?: string }[] }) {
  return (
    <div className="calc-steps">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <b>{item.value}</b>
          {item.note && <em>{item.note}</em>}
        </div>
      ))}
    </div>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return <p className="formula">{children}</p>;
}

export function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div className={`verdict ${ok ? "ok" : "ng"}`}>{children}</div>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint-line">{children}</p>;
}

/**
 * つまずいたときだけ開くヒント。
 * 最初は閉じているので、自力で考えたい生徒のじゃまをしない。
 * label を変えれば「もっとくわしく」など段階をつけられる。
 */
type HintShop = {
  /** いま持っているG */
  balance: number;
  /** 1つ開くのに必要なG */
  price: number;
  /** すでに買ったか */
  bought: (id: string) => boolean;
  /** 買う。足りなければ何も起きない */
  buy: (id: string) => void;
  /** テスト中など、ヒントそのものを出さない場面 */
  hidden?: boolean;
};

/** ヒントの売り場。page.tsx が値を入れる。入っていないときはタダで開ける（テスト用） */
export const HintShopContext = createContext<HintShop | null>(null);

export function HintButton({
  id,
  label = "ヒントを見る",
  children
}: {
  /** ヒント1つ1つを見分ける名前。`単元-実験番号-その中の何番目か` */
  id: string;
  label?: string;
  children: ReactNode;
}) {
  const shop = useContext(HintShopContext);

  if (shop?.hidden) return null;

  if (shop && !shop.bought(id)) {
    const short = shop.price - shop.balance;
    return (
      <div className={`hint-shop ${short > 0 ? "short" : ""}`}>
        <button type="button" onClick={() => shop.buy(id)} disabled={short > 0}>
          <span aria-hidden="true">？</span>
          {label}
          <b>{shop.price}G</b>
        </button>
        <em>
          {short > 0
            ? `あと ${short}G 足りません。実験を ${short} 個やると開けます`
            : `いま ${shop.balance}G 持っています。開くと ${shop.balance - shop.price}G になります`}
        </em>
      </div>
    );
  }

  return (
    <details className="hint-toggle" open={!!shop}>
      <summary>
        <span aria-hidden="true">？</span>
        {label}
        {shop && <b className="hint-owned">開放ずみ</b>}
      </summary>
      <div className="hint-toggle-body">{children}</div>
    </details>
  );
}

export function DataTable({
  head,
  rows,
  highlight,
  full
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  highlight?: (rowIndex: number) => boolean;
  /** 行を詰めて、内側のスクロールなしで全部見せる（ASCIIコード表など） */
  full?: boolean;
}) {
  return (
    <div className={full ? "table-scroll full" : "table-scroll"}>
      <table className={full ? "lab-table dense" : "lab-table"}>
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th key={index}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={highlight?.(rowIndex) ? "hit" : undefined}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** ビット列を桁の重み付きで並べる。クリックで0/1を反転できる */
export function BitStrip({
  bits,
  onToggle,
  weights = true,
  signed = false
}: {
  bits: string;
  onToggle?: (index: number) => void;
  weights?: boolean;
  signed?: boolean;
}) {
  const width = bits.length;
  return (
    <div className={`bit-strip ${onToggle ? "clickable" : ""}`}>
      {bits.split("").map((bit, index) => {
        const power = width - 1 - index;
        const weight = signed && index === 0 ? -(2 ** power) : 2 ** power;
        return (
          <button
            type="button"
            key={index}
            className={bit === "1" ? "on" : ""}
            disabled={!onToggle}
            onClick={() => onToggle?.(index)}
          >
            <b>{bit}</b>
            {weights && <small>{weight.toLocaleString("ja-JP")}</small>}
          </button>
        );
      })}
    </div>
  );
}

/** 折れ線・棒の簡易グラフ（SVG） */
export function BarChart({
  values,
  labels,
  overlay,
  height = 140,
  unit,
  highlight,
  series,
  tone
}: {
  values: number[];
  labels?: string[];
  overlay?: (number | null)[];
  height?: number;
  unit?: string;
  /** true を返した棒だけ色を変える（該当する範囲を示すときに使う） */
  highlight?: (index: number) => boolean;
  /** 3つ以上の集団を並べるとき、棒ごとにどの集団かを 0・1・2 で返す */
  series?: (index: number) => 0 | 1 | 2;
  /** "compare" にすると、2つの集団を並べるための配色になる（赤は使わない） */
  tone?: "compare";
}) {
  if (!values.length) return null;
  const max = Math.max(...values, ...(overlay?.filter((v): v is number => v !== null) ?? []));
  const min = Math.min(0, ...values, ...(overlay?.filter((v): v is number => v !== null) ?? []));
  const span = max - min || 1;
  const width = Math.max(320, values.length * 34);
  const barWidth = width / values.length;
  const y = (value: number) => height - ((value - min) / span) * (height - 18) - 4;
  const points = overlay
    ?.map((value, index) => (value === null ? null : `${index * barWidth + barWidth / 2},${y(value)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <div className="chart-scroll">
      <svg
        viewBox={`0 0 ${width} ${height + 20}`}
        className={tone === "compare" ? "chart chart-compare" : "chart"}
        role="img"
        aria-label="グラフ"
      >
        {values.map((value, index) => (
          <rect
            key={index}
            x={index * barWidth + barWidth * 0.15}
            y={y(value)}
            width={barWidth * 0.7}
            height={Math.max(1, height - 4 - y(value))}
            rx="3"
            className={series ? `s${series(index)}` : highlight?.(index) ? "hot" : undefined}
          />
        ))}
        {points && <polyline points={points} className="overlay" />}
        {labels?.map((label, index) => (
          <text key={index} x={index * barWidth + barWidth / 2} y={height + 15} textAnchor="middle" className="axis">
            {label}
          </text>
        ))}
      </svg>
      {unit && <small className="chart-unit">単位: {unit}</small>}
    </div>
  );
}

/** 散布図 */
export function Scatter({
  xs,
  ys,
  line
}: {
  xs: number[];
  ys: number[];
  line?: { a: number; b: number } | null;
}) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const xMin = Math.min(...xs.slice(0, n));
  const xMax = Math.max(...xs.slice(0, n));
  const yMin = Math.min(...ys.slice(0, n));
  const yMax = Math.max(...ys.slice(0, n));
  const px = (x: number) => 30 + ((x - xMin) / (xMax - xMin || 1)) * 250;
  const py = (y: number) => 150 - ((y - yMin) / (yMax - yMin || 1)) * 130;
  return (
    <svg viewBox="0 0 300 170" className="scatter" role="img" aria-label="散布図">
      <line x1="30" y1="20" x2="30" y2="150" className="axis-line" />
      <line x1="30" y1="150" x2="285" y2="150" className="axis-line" />
      {line && (
        <line x1={px(xMin)} y1={py(line.a * xMin + line.b)} x2={px(xMax)} y2={py(line.a * xMax + line.b)} className="fit" />
      )}
      {Array.from({ length: n }, (_, index) => (
        <circle key={index} cx={px(xs[index])} cy={py(ys[index])} r="3.5" />
      ))}
    </svg>
  );
}

/** 箱ひげ図 */
export function BoxPlot({
  summary,
  domain
}: {
  summary: { min: number; q1: number; q2: number; q3: number; max: number; mean: number };
  /** 複数の箱ひげ図を並べて比べるときは、共通の目盛り [下端, 上端] を渡す */
  domain?: [number, number];
}) {
  const { min, q1, q2, q3, max, mean } = summary;
  const low = domain ? domain[0] : min;
  const high = domain ? domain[1] : max;
  const span = high - low || 1;
  const pos = (value: number) => 5 + ((value - low) / span) * 90;
  return (
    <div className="boxplot-wrap">
      <svg viewBox="0 0 100 40" className="boxplot" preserveAspectRatio="none" role="img" aria-label="箱ひげ図">
        <line x1={pos(min)} y1="20" x2={pos(max)} y2="20" className="whisker" />
        <line x1={pos(min)} y1="10" x2={pos(min)} y2="30" className="cap" />
        <line x1={pos(max)} y1="10" x2={pos(max)} y2="30" className="cap" />
        <rect x={pos(q1)} y="8" width={Math.max(0.6, pos(q3) - pos(q1))} height="24" className="box" />
        <line x1={pos(q2)} y1="8" x2={pos(q2)} y2="32" className="median" />
        <line x1={pos(mean)} y1="14" x2={pos(mean)} y2="26" className="mean" />
      </svg>
      <div className="boxplot-legend">
        <span>最小 {min}</span>
        <span>Q1 {q1.toFixed(1)}</span>
        <span>中央 {q2.toFixed(1)}</span>
        <span>Q3 {q3.toFixed(1)}</span>
        <span>最大 {max}</span>
      </div>
    </div>
  );
}

/**
 * 棄却域の図。
 * 分布のカーブを描き、有意水準で決まる「棄却域」を塗り分け、
 * 実際の検定統計量がどちら側に落ちたかを示す。
 */
export function RejectionCurve({
  stat,
  critical,
  alpha,
  two = true,
  df,
  statLabel = "検定統計量"
}: {
  stat: number;
  critical: number;
  alpha: number;
  two?: boolean;
  /** 自由度。指定するとt分布、省略すると標準正規分布を描く */
  df?: number;
  statLabel?: string;
}) {
  const W = 320;
  const H = 170;
  const BASE = 132;
  const span = Math.max(4, Math.abs(stat) + 1, critical + 1);
  const density = (x: number) => (df && df > 0 ? tPdf(x, df) : normalPdf(x));
  const peak = density(0) || 1;
  const px = (x: number) => ((x + span) / (2 * span)) * W;
  const py = (d: number) => BASE - (d / peak) * 100;

  const curve = (from: number, to: number) => {
    const pts: string[] = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const x = from + ((to - from) * i) / steps;
      pts.push(`${px(x).toFixed(2)},${py(density(x)).toFixed(2)}`);
    }
    return pts;
  };
  const area = (from: number, to: number) =>
    `${px(from).toFixed(2)},${BASE} ${curve(from, to).join(" ")} ${px(to).toFixed(2)},${BASE}`;

  const inReject = two ? Math.abs(stat) >= critical : stat >= critical;
  const clampedStat = clamp(stat, -span + 0.05, span - 0.05);

  return (
    <div className="reject-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="reject-curve" role="img"
        aria-label={`棄却域の図。有意水準 ${alpha}、臨界値 ${critical.toFixed(3)}、${statLabel} ${stat.toFixed(3)}。${inReject ? "棄却域に入っています" : "棄却域に入っていません"}`}>
        <polygon className="accept-area" points={area(two ? -critical : -span, critical)} />
        {two && <polygon className="reject-area" points={area(-span, -critical)} />}
        <polygon className="reject-area" points={area(critical, span)} />
        <polyline className="reject-line" points={curve(-span, span).join(" ")} />
        <line x1="0" y1={BASE} x2={W} y2={BASE} className="axis-line" />
        {two && (
          <line x1={px(-critical)} y1={py(density(critical))} x2={px(-critical)} y2={BASE} className="critical-line" />
        )}
        <line x1={px(critical)} y1={py(density(critical))} x2={px(critical)} y2={BASE} className="critical-line" />
        <line x1={px(clampedStat)} y1="24" x2={px(clampedStat)} y2={BASE} className="mark" />
        <text x={clamp(px(clampedStat), 26, W - 26)} y="18" textAnchor="middle" className="axis">
          {statLabel} {stat.toFixed(3)}
        </text>
        {two && (
          <text x={clamp(px(-critical), 22, W - 22)} y={BASE + 14} textAnchor="middle" className="axis">
            −{critical.toFixed(3)}
          </text>
        )}
        <text x={clamp(px(critical), 22, W - 22)} y={BASE + 14} textAnchor="middle" className="axis">
          {critical.toFixed(3)}
        </text>
        <text x={W / 2} y={BASE + 30} textAnchor="middle" className="axis">
          真ん中は「差がない」としても起こりうる範囲
        </text>
      </svg>
      <div className="reject-legend">
        <span><i className="swatch-accept" />採択域（棄却できない）</span>
        <span><i className="swatch-reject" />棄却域　合計 {(alpha * 100).toFixed(0)}%{two ? "（両側に半分ずつ）" : "（片側）"}</span>
      </div>
      <Verdict ok={!inReject}>
        {inReject
          ? `${statLabel}は棄却域に入りました。「たまたまこうなった」では説明しにくい、と判断します。`
          : `${statLabel}は棄却域に入っていません。「たまたまこうなった」でも説明できる範囲です。`}
      </Verdict>
    </div>
  );
}

/** 正規分布のカーブと、指定した位置の目印 */
export function NormalCurve({
  mean,
  sd,
  marks,
  domain,
  bands
}: {
  mean: number;
  sd: number;
  marks: { value: number; label: string }[];
  /** 横軸を固定したいときに渡す。渡すと σ を変えたとき山の太さと高さが実際に変わる */
  domain?: [number, number];
  /** μ±1σ・±2σ・±3σ の帯を塗る */
  bands?: boolean;
}) {
  const from = domain ? domain[0] : mean - 4 * sd;
  const to = domain ? domain[1] : mean + 4 * sd;
  const px = (value: number) => ((value - from) / (to - from)) * 300;
  // 横軸を固定したときは、面積が1になるように高さを決める（σが大きいほど低く広くなる）
  const refSd = domain ? (to - from) / 8 : sd;
  const peak = domain ? Math.min(1, refSd / sd) : 1;
  const points: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const x = from + ((to - from) * i) / 120;
    const density = peak * Math.exp(-((x - mean) ** 2) / (2 * sd ** 2));
    points.push(`${(i / 120) * 300},${130 - density * 105}`);
  }
  const bandDefs: [number, string][] = [
    [3, "band3"],
    [2, "band2"],
    [1, "band1"]
  ];
  return (
    <svg viewBox="0 0 300 150" className="normal-curve" role="img" aria-label="正規分布">
      {bands &&
        bandDefs.map(([k, cls]) => {
          const x1 = Math.max(0, px(mean - k * sd));
          const x2 = Math.min(300, px(mean + k * sd));
          return x2 > x1 ? <rect key={k} x={x1} y={20} width={x2 - x1} height={110} className={cls} /> : null;
        })}
      <polyline points={points.join(" ")} />
      <line x1="0" y1="130" x2="300" y2="130" className="axis-line" />
      {[-3, -2, -1, 0, 1, 2, 3].map((k) => {
        const x = px(mean + k * sd);
        if (x < 0 || x > 300) return null;
        return (
          <g key={k}>
            <line x1={x} y1="126" x2={x} y2="134" className="axis-line" />
            <text x={x} y="146" textAnchor="middle" className="axis">
              {k === 0 ? "μ" : `${k > 0 ? "+" : "−"}${Math.abs(k)}σ`}
            </text>
          </g>
        );
      })}
      {marks.map((mark) => (
        <g key={mark.label}>
          <line x1={px(mark.value)} y1="20" x2={px(mark.value)} y2="130" className="mark" />
          <text x={Math.min(275, Math.max(20, px(mark.value)))} y="14" textAnchor="middle" className="axis">
            {mark.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** 前の実験で入れた値をそのまま使うカードで、入力欄のかわりに出す案内 */
export function Carried({ from, children }: { from: string; children: ReactNode }) {
  return (
    <p className="carried">
      <b>{from}で入れた値を使っています</b>
      <span>{children}</span>
      <em>変えたいときは{from}に戻ってください</em>
    </p>
  );
}
