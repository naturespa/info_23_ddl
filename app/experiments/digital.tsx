"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  asciiInfo,
  audioBytes,
  binaryAdd,
  byteSteps,
  clamp,
  dpiToDots,
  effectiveAccess,
  fmt,
  fromBase,
  fullAdder,
  gateFormula,
  gateOutput,
  halfAdder,
  imageBytes,
  instructionTimeNs,
  normalizeBinary,
  nyquist,
  onesComplement,
  padBits,
  parseBits,
  parseNumbers,
  radixComplement,
  compressionRate,
  divisionLadder,
  huffman,
  nandOnly,
  nandRecipe,
  rippleAdder,
  runLength,
  seededRandom,
  shiftBits,
  signedValue,
  sjisBytes,
  toBase,
  toFloat32,
  toMips,
  toSignedBits,
  transferSeconds,
  twosComplement,
  utf16Bytes,
  utf8Bytes,
  videoBytes,
  type Gate
} from "../lib/calc";
import {
  AreaField,
  BitStrip,
  DataTable,
  Formula,
  Hint,
  HintButton,
  NumberField,
  Results,
  Row,
  SelectField,
  SliderField,
  Steps,
  Tabs,
  TextField,
  Toggle,
  Verdict
} from "../lib/ui";
import { MOJIBAKE_ENCODINGS, mojibakeSamples } from "../lib/mojibake-data";

export type CardRenderer = (index: number, title: string, goal: string, body: ReactNode) => ReactNode;
export type LabProps = {
  card: CardRenderer;
  /** 応用ミッションの自由記述。ページ側が持ち、保存とJSON出力の対象になる */
  missionNote: string;
  onMissionNote: (value: string) => void;
};

/** 教科書（1KB＝1,024B）にそろえた段階表示。IPAの問題文が1,000進を指定する場合は下段を見る */
const bytesRow = (bytes: number) => {
  const s = byteSteps(bytes);
  return [
    { label: "バイト", value: `${fmt(s.bytes, 0)} B` },
    { label: "キロバイト", value: `${fmt(s.kib, 2)} KB`, note: "÷1,024" },
    { label: "メガバイト", value: `${fmt(s.mib, 3)} MB`, note: "÷1,024²" },
    { label: "ギガバイト", value: `${fmt(s.gib, 4)} GB`, note: "÷1,024³" }
  ];
};

/**
 * 小数部に2をかけて整数部（0か1）を拾う手順を、1段ずつ返す。
 * 教科書の「小数を2進数に直す手順」をそのまま画面に出すために使う。
 */
const fractionSteps = (value: number, maxRows = 8) => {
  const abs = Math.abs(value);
  let rest = abs - Math.floor(abs);
  const rows: { before: number; doubled: number; digit: number; after: number }[] = [];
  for (let i = 0; i < maxRows && rest > 1e-12; i++) {
    const doubled = rest * 2;
    const digit = Math.floor(doubled);
    const after = doubled - digit;
    rows.push({ before: rest, doubled, digit, after });
    rest = after;
  }
  return rows;
};

/** 問題文で1MB＝1,000kBと指定されたときの値 */
const bytesRowSI = (bytes: number) => {
  const s = byteSteps(bytes);
  return [
    { label: "キロバイト", value: `${fmt(s.kb, 2)} kB`, note: "÷1,000" },
    { label: "メガバイト", value: `${fmt(s.mb, 3)} MB`, note: "÷1,000²" },
    { label: "ギガバイト", value: `${fmt(s.gb, 4)} GB`, note: "÷1,000³" }
  ];
};

/* ------------------------------------------------------------------
 * 電気回路のミニ図（D4 実験1）
 * スイッチのつなぎ方だけでゲートと同じ働きになることを、7種類ならべて見せる
 * ---------------------------------------------------------------- */

type WiringKind = "single-not" | "series" | "parallel" | "series-not" | "parallel-not" | "cross" | "cross-not";

/** 開いた／閉じたスイッチ。closed のとき電気が通る */
const SwitchMark = ({ x, y, closed, label }: { x: number; y: number; closed: boolean; label: string }) => (
  <g>
    <circle cx={x} cy={y} r={2.2} className="pin" />
    <circle cx={x + 18} cy={y} r={2.2} className="pin" />
    <line
      x1={x}
      y1={y}
      x2={closed ? x + 18 : x + 16}
      y2={closed ? y : y - 9}
      className={`lever ${closed ? "closed" : ""}`}
    />
    <text x={x + 9} y={y + 13} className="pin-label">
      {label}
    </text>
  </g>
);

const NotBox = ({ x, y }: { x: number; y: number }) => (
  <g>
    <rect x={x} y={y - 7} width={17} height={14} rx={3} className="notbox" />
    <text x={x + 8.5} y={y + 4} className="notbox-label">
      NOT
    </text>
  </g>
);

const MiniCircuit = ({ kind, a, b, on }: { kind: WiringKind; a: boolean; b: boolean; on: boolean }) => (
  <svg viewBox="0 0 130 76" className={`mini-circuit ${on ? "on" : ""}`} role="img">
    {/* 電池と外枠 */}
    <line x1={10} y1={20} x2={10} y2={56} className="rail" />
    <line x1={6} y1={32} x2={14} y2={32} className="rail thick" />
    <line x1={7.5} y1={40} x2={12.5} y2={40} className="rail" />
    <line x1={10} y1={20} x2={26} y2={20} className="rail" />
    <line x1={10} y1={56} x2={112} y2={56} className="rail" />
    <line x1={112} y1={56} x2={112} y2={38} className="rail" />

    {kind === "single-not" && (
      <>
        <line x1={26} y1={20} x2={112} y2={20} className="rail" />
        <line x1={112} y1={20} x2={112} y2={26} className="rail" />
        {/* ランプと並列に入ったスイッチ。閉じるとランプを素通りして消える */}
        <line x1={52} y1={20} x2={52} y2={38} className="rail" />
        <line x1={52} y1={38} x2={112} y2={38} className="rail" />
        <SwitchMark x={58} y={38} closed={a} label="A" />
      </>
    )}

    {kind !== "single-not" && kind !== "parallel" && kind !== "parallel-not" && kind !== "cross" && kind !== "cross-not" && (
      <>
        <SwitchMark x={30} y={20} closed={a} label="A" />
        <line x1={48} y1={20} x2={58} y2={20} className="rail" />
        <SwitchMark x={58} y={20} closed={b} label="B" />
        {kind === "series" ? (
          <line x1={76} y1={20} x2={112} y2={20} className="rail" />
        ) : (
          <>
            <line x1={76} y1={20} x2={86} y2={20} className="rail" />
            <NotBox x={86} y={20} />
            <line x1={103} y1={20} x2={112} y2={20} className="rail" />
          </>
        )}
        <line x1={112} y1={20} x2={112} y2={26} className="rail" />
      </>
    )}

    {(kind === "parallel" || kind === "parallel-not") && (
      <>
        <line x1={26} y1={20} x2={26} y2={40} className="rail" />
        <line x1={26} y1={12} x2={30} y2={12} className="rail" />
        <line x1={26} y1={12} x2={26} y2={40} className="rail" />
        <SwitchMark x={30} y={12} closed={a} label="A" />
        <SwitchMark x={30} y={40} closed={b} label="B" />
        <line x1={48} y1={12} x2={70} y2={12} className="rail" />
        <line x1={48} y1={40} x2={70} y2={40} className="rail" />
        <line x1={70} y1={12} x2={70} y2={40} className="rail" />
        {kind === "parallel" ? (
          <line x1={70} y1={20} x2={112} y2={20} className="rail" />
        ) : (
          <>
            <line x1={70} y1={20} x2={86} y2={20} className="rail" />
            <NotBox x={86} y={20} />
            <line x1={103} y1={20} x2={112} y2={20} className="rail" />
          </>
        )}
        <line x1={112} y1={20} x2={112} y2={26} className="rail" />
      </>
    )}

    {(kind === "cross" || kind === "cross-not") && (
      <>
        {/* 三路スイッチ2つ。上下どちらの線でつながるかが入力で変わる */}
        <circle cx={30} cy={20} r={2.2} className="pin" />
        <line x1={30} y1={20} x2={48} y2={a ? 12 : 30} className={`lever closed`} />
        <line x1={48} y1={12} x2={64} y2={12} className="rail" />
        <line x1={48} y1={30} x2={64} y2={30} className="rail" />
        <circle cx={48} cy={12} r={2} className="pin" />
        <circle cx={48} cy={30} r={2} className="pin" />
        <circle cx={64} cy={12} r={2} className="pin" />
        <circle cx={64} cy={30} r={2} className="pin" />
        <line x1={64} y1={b ? 30 : 12} x2={82} y2={20} className={`lever closed`} />
        <circle cx={82} cy={20} r={2.2} className="pin" />
        <text x={39} y={45} className="pin-label">
          A
        </text>
        <text x={73} y={45} className="pin-label">
          B
        </text>
        {kind === "cross" ? (
          <line x1={82} y1={20} x2={112} y2={20} className="rail" />
        ) : (
          <>
            <line x1={82} y1={20} x2={86} y2={20} className="rail" />
            <NotBox x={86} y={20} />
            <line x1={103} y1={20} x2={112} y2={20} className="rail" />
          </>
        )}
        <line x1={112} y1={20} x2={112} y2={26} className="rail" />
      </>
    )}

    {/* ランプ */}
    <circle cx={112} cy={32} r={6} className="bulb" />
    <line x1={108} y1={28} x2={116} y2={36} className="bulb-x" />
    <line x1={116} y1={28} x2={108} y2={36} className="bulb-x" />
  </svg>
);

/** 周波数から、いちばん近い音階の名前と、そこからのずれ（セント）を求める */
const NOTE_NAMES = ["ド", "ド♯", "レ", "レ♯", "ミ", "ファ", "ファ♯", "ソ", "ソ♯", "ラ", "ラ♯", "シ"];
const NOTE_ALPHA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteOf = (freq: number) => {
  // ラ（A4, 440Hz）を基準に、半音いくつ離れているかを数える
  const semitones = 12 * Math.log2(freq / 440);
  const nearest = Math.round(semitones);
  const cents = Math.round((semitones - nearest) * 100);
  // A4 は MIDI 69。そこから半音数を足す
  const midi = 69 + nearest;
  const index = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return {
    name: `${NOTE_NAMES[index]}（${NOTE_ALPHA[index]}${octave}）`,
    exact: 440 * 2 ** (nearest / 12),
    cents,
    octave
  };
};

/* ------------------------------------------------------------------
 * CPUのブロック図（D5 実験2）
 * 取出し→解読→実行→次の命令へ　の1周を、光る場所で示す
 * ---------------------------------------------------------------- */

const CpuDiagram = ({ step, address, instruction }: { step: number; address: string; instruction: string }) => {
  const cls = (n: number) => (step === n ? "cpu-box on" : "cpu-box");
  const arrow = (n: number) => (step === n ? "cpu-arrow on" : "cpu-arrow");
  return (
    <svg viewBox="0 0 480 176" className="cpu-diagram" role="img">
      {/* 主記憶 */}
      <rect x={8} y={30} width={104} height={116} rx={8} className="cpu-outer" />
      <text x={60} y={22} className="cpu-title">主記憶</text>
      <rect x={18} y={44} width={84} height={26} rx={5} className={cls(0)} />
      <text x={60} y={61} className="cpu-label">{address}番地の命令</text>
      <text x={60} y={90} className="cpu-note">{instruction}</text>
      <rect x={18} y={100} width={84} height={34} rx={5} className={cls(2)} />
      <text x={60} y={121} className="cpu-label">データ</text>

      {/* CPU の外枠 */}
      <rect x={150} y={14} width={322} height={148} rx={10} className="cpu-outer" />
      <text x={311} y={30} className="cpu-title">CPU（中央処理装置）</text>

      {/* 制御装置 */}
      <rect x={162} y={40} width={298} height={62} rx={8} className="cpu-group" />
      <text x={311} y={54} className="cpu-note">制御装置</text>
      <rect x={174} y={60} width={82} height={32} rx={5} className={cls(0)} />
      <text x={215} y={80} className="cpu-label">プログラムカウンタ</text>
      <rect x={268} y={60} width={82} height={32} rx={5} className={cls(0)} />
      <text x={309} y={80} className="cpu-label">命令レジスタ</text>
      <rect x={362} y={60} width={86} height={32} rx={5} className={cls(1)} />
      <text x={405} y={80} className="cpu-label">デコーダ（解読）</text>

      {/* 演算装置 */}
      <rect x={268} y={114} width={180} height={34} rx={6} className={cls(2)} />
      <text x={358} y={135} className="cpu-label">演算装置（計算する）</text>

      {/* 線 */}
      <polyline points="112,57 174,57 174,60" className={arrow(0)} markerEnd="url(#cpuhead)" />
      <polyline points="256,76 268,76" className={arrow(0)} markerEnd="url(#cpuhead)" />
      <polyline points="350,76 362,76" className={arrow(1)} markerEnd="url(#cpuhead)" />
      <polyline points="405,92 405,131 448,131" className={arrow(2)} />
      <polyline points="112,117 268,131" className={arrow(2)} markerEnd="url(#cpuhead)" />
      <polyline points="215,92 215,158 405,158 405,148" className={arrow(3)} markerEnd="url(#cpuhead)" />
      <text x={311} y={172} className="cpu-note">④ 次の命令の番地へ進める</text>
      <defs>
        <marker id="cpuhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" className="cpu-head" />
        </marker>
      </defs>
    </svg>
  );
};

/* ------------------------------------------------------------------
 * 加算器の回路図（D4 実験3・実験4）
 * 入力のボタンを押すと、線の0と1がその場で変わる
 * ---------------------------------------------------------------- */

const B = (v: boolean | number) => (typeof v === "number" ? v : Number(v));
const live = (v: boolean | number) => (B(v) ? "wire on" : "wire");

/** MIL記号のゲート。type で形が変わる。幅28・高さ24 */
const GateSymbol = ({ x, y, type, on }: { x: number; y: number; type: "AND" | "OR" | "XOR"; on: boolean }) => (
  <g transform={`translate(${x} ${y})`} className={on ? "gate on" : "gate"}>
    {type === "AND" ? (
      <path d="M0,0 H16 A12,12 0 0 1 16,24 H0 Z" className="gate-body" />
    ) : (
      <path d="M0,0 Q14,12 0,24 Q22,22 28,12 Q22,2 0,0 Z" className="gate-body" />
    )}
    {type === "XOR" && <path d="M-5,0 Q9,12 -5,24" className="gate-arc" />}
    <text x={type === "AND" ? 11 : 12} y={15} className="gate-label">
      {type}
    </text>
  </g>
);

/** 値つきの箱（半加算器・全加算器のブロック） */
const BlockSymbol = ({ x, y, w, h, label, on }: { x: number; y: number; w: number; h: number; label: string; on?: boolean }) => (
  <g className={on ? "gate on" : "gate"}>
    <rect x={x} y={y} width={w} height={h} rx={6} className="gate-body" />
    <text x={x + w / 2} y={y + h / 2 + 4} className="gate-label">
      {label}
    </text>
  </g>
);

/** 線の途中に出す0/1 */
const WireValue = ({ x, y, v }: { x: number; y: number; v: boolean | number }) => (
  <text x={x} y={y} className={B(v) ? "wire-value on" : "wire-value"}>
    {B(v)}
  </text>
);

/** 半加算器：XORが和、ANDがくり上がり */
const HalfAdderDiagram = ({ a, b, s, c }: { a: boolean; b: boolean; s: boolean; c: boolean }) => (
  <svg viewBox="0 0 250 92" className="logic-diagram" role="img">
    <text x={6} y={24} className="port">A</text>
    <text x={6} y={72} className="port">B</text>
    <WireValue x={20} y={24} v={a} />
    <WireValue x={20} y={72} v={b} />

    {/* Aの線：XORの上入力とANDの上入力へ */}
    <polyline points="30,20 46,20 46,64 100,64" className={live(a)} />
    <polyline points="46,20 100,20" className={live(a)} />
    {/* Bの線：XORの下入力とANDの下入力へ */}
    <polyline points="30,68 60,68 60,32 100,32" className={live(b)} />
    <polyline points="60,68 100,68" className={live(b)} />

    <GateSymbol x={100} y={14} type="XOR" on={s} />
    <GateSymbol x={100} y={52} type="AND" on={c} />

    <polyline points="128,26 210,26" className={live(s)} />
    <polyline points="128,64 210,64" className={live(c)} />
    <WireValue x={196} y={22} v={s} />
    <WireValue x={196} y={60} v={c} />
    <text x={216} y={30} className="port">S</text>
    <text x={216} y={68} className="port">C</text>
    <text x={216} y={42} className="port-note">和</text>
    <text x={216} y={80} className="port-note">くり上がり</text>
  </svg>
);

/** 全加算器：半加算器2つとORでできている */
const FullAdderDiagram = ({
  a,
  b,
  ci,
  s1,
  c1,
  s,
  c2,
  co
}: {
  a: boolean;
  b: boolean;
  ci: boolean;
  s1: boolean;
  c1: boolean;
  s: boolean;
  c2: boolean;
  co: boolean;
}) => (
  <svg viewBox="0 0 330 120" className="logic-diagram" role="img">
    <text x={4} y={22} className="port">A</text>
    <text x={4} y={44} className="port">B</text>
    <text x={4} y={92} className="port">Ci</text>
    <WireValue x={18} y={22} v={a} />
    <WireValue x={18} y={44} v={b} />
    <WireValue x={22} y={92} v={ci} />

    <polyline points="28,18 62,18" className={live(a)} />
    <polyline points="28,40 62,40" className={live(b)} />
    <BlockSymbol x={62} y={8} w={58} h={42} label="半加算器①" on={s1 || c1} />

    {/* ①のS → ②へ */}
    <polyline points="120,20 150,20" className={live(s1)} />
    <WireValue x={132} y={16} v={s1} />
    {/* ①のC → ORへ */}
    <polyline points="120,40 136,40 136,104 236,104" className={live(c1)} />
    <WireValue x={186} y={100} v={c1} />

    {/* Ci → ②へ */}
    <polyline points="30,88 150,88 150,42" className={live(ci)} />

    <BlockSymbol x={150} y={8} w={58} h={42} label="半加算器②" on={s || c2} />
    <polyline points="208,20 300,20" className={live(s)} />
    <WireValue x={286} y={16} v={s} />
    <text x={306} y={24} className="port">S</text>

    {/* ②のC → ORへ */}
    <polyline points="208,40 222,40 222,80 236,80" className={live(c2)} />
    <WireValue x={214} y={76} v={c2} />

    <GateSymbol x={236} y={80} type="OR" on={co} />
    <polyline points="264,92 300,92" className={live(co)} />
    <WireValue x={286} y={88} v={co} />
    <text x={306} y={96} className="port">Co</text>
    <text x={236} y={114} className="port-note">2つのくり上がりのどちらかが1なら、上のけたへ送る</text>
  </svg>
);

/** 4ビットの並列加算器：全加算器を4つ並べ、Coを次のCiへ渡す */
const RippleDiagram = ({
  stages,
  carryOut
}: {
  stages: { x: number; y: number; ci: number; s: number; co: number }[];
  carryOut: boolean;
}) => {
  // stages は上位けたから並んでいる。図では下位けたを右に置く
  const cells = stages.slice().reverse();
  const W = 74;
  const left = (i: number) => 300 - i * W;
  return (
    <svg viewBox="0 0 330 128" className="logic-diagram" role="img">
      {cells.map((stage, i) => {
        const x = left(i) - 56;
        return (
          <g key={i}>
            <text x={x + 28} y={12} className="port-note">
              {i + 1}けた目
            </text>
            <polyline points={`${x + 14},22 ${x + 14},42`} className={live(stage.x)} />
            <polyline points={`${x + 42},22 ${x + 42},42`} className={live(stage.y)} />
            <text x={x + 14} y={34} className="port-note">A</text>
            <text x={x + 42} y={34} className="port-note">B</text>
            <WireValue x={x + 6} y={20} v={stage.x} />
            <WireValue x={x + 34} y={20} v={stage.y} />
            <BlockSymbol x={x} y={42} w={56} h={34} label="全加算器" on={!!stage.s || !!stage.co} />
            <polyline points={`${x + 28},76 ${x + 28},96`} className={live(stage.s)} />
            <WireValue x={x + 24} y={110} v={stage.s} />
            {/* Co（左へ） */}
            <polyline points={`${x},59 ${x - 18},59`} className={live(stage.co)} />
            <WireValue x={x - 14} y={55} v={stage.co} />
          </g>
        );
      })}
      <text x={4} y={62} className={carryOut ? "port warn" : "port"}>
        {carryOut ? "あふれ" : "0"}
      </text>
      <text x={306} y={62} className="port">Ci</text>
      <text x={314} y={100} className="port-note">和</text>
    </svg>
  );
};

/* ========================================================================
 * D0 デジタル情報の特徴
 * ====================================================================== */
export function FeatureLab({ card, missionNote, onMissionNote }: LabProps) {
  const [bits, setBits] = useState(8);
  const [temp, setTemp] = useState(21.7);
  const [gradation, setGradation] = useState("1");
  const [copies, setCopies] = useState(6);
  const [wear, setWear] = useState("normal");
  const [kinds, setKinds] = useState(15);
  const [stage, setStage] = useState("digitization");

  /* --- 実験1: アナログ温度計とデジタル温度計 --- */
  const stepSize = Number(gradation);
  const digitalTemp = Math.round(temp / stepSize) * stepSize;
  const gap = Math.abs(temp - digitalTemp);
  const TEMP_MIN = -5;
  const TEMP_MAX = 40;
  const heightOf = (value: number) => ((value - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100;

  /* --- 実験2: コピーを重ねる --- */
  const HEART = [
    "00000000",
    "01100110",
    "11111111",
    "11111111",
    "11111111",
    "01111110",
    "00111100",
    "00011000"
  ];
  const wearAmount = wear === "small" ? 0.04 : wear === "large" ? 0.2 : 0.1;
  const copied = useMemo(() => {
    const random = seededRandom(20260818);
    const rows = HEART.map((row) => row.split("").map(Number));
    const analog = rows.map((row) => row.map((v) => v));
    for (let c = 0; c < copies; c++) {
      for (let y = 0; y < analog.length; y++) {
        for (let x = 0; x < analog[y].length; x++) {
          analog[y][x] = clamp(analog[y][x] + (random() - 0.5) * 2 * wearAmount, 0, 1);
        }
      }
    }
    // デジタルは1回ごとに「0.5より上か下か」で判定し直すので、もとの値に戻る
    const digital = rows.map((row) => row.map((v) => v));
    const diffs = analog.flatMap((row, y) => row.map((v, x) => Math.abs(v - rows[y][x])));
    return {
      original: rows,
      analog,
      digital,
      analogGap: diffs.reduce((a, b) => a + b, 0) / diffs.length,
      worst: Math.max(...diffs)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copies, wearAmount]);

  /* --- 実験3: ビット数と表せる組み合わせ --- */
  const combos = 2n ** BigInt(bits);
  const binaryRaw = combos.toString(2);
  const padded = binaryRaw.padStart(Math.ceil(binaryRaw.length / 8) * 8, "0");
  const byteGroups = padded.match(/.{8}/g) ?? [];
  const combosNumber = Number(combos);
  const unit = (value: number) => {
    if (value === 0) return "0";
    if (value >= 1e15 || value < 1e-4) return value.toExponential(3);
    return value.toLocaleString("ja-JP", { maximumFractionDigits: value < 1 ? 6 : 3 });
  };

  /* --- 実験4: 符号化に必要なビット数 --- */
  const safeKinds = Math.max(2, Math.round(kinds));
  const neededBits = Math.ceil(Math.log2(safeKinds));
  const capacity = 2 ** neededBits;
  const presets: [string, number][] = [
    ["天気 15種類", 15],
    ["色鉛筆 50色", 50],
    ["ひらがな 46字", 46],
    ["半角文字 256種", 256],
    ["常用漢字 2,136字", 2136],
    ["JIS第1・第2水準 6,879字", 6879],
    ["1色ぶん 256階調", 256],
    ["フルカラー 16,777,216色", 16777216]
  ];
  /** 1〜24ビットの早見表。24ビット＝フルカラーまで一気に見渡せるようにする */
  const bitTable = Array.from({ length: 24 }, (_, i) => i + 1);

  /* --- 応用: デジタル化の3段階 --- */
  const stages: [string, string, string, string][] = [
    ["digitization", "デジタイゼーション", "形式を変える", "紙の出席簿を、そのままの形でアプリに入力する"],
    ["digitalization", "デジタライゼーション", "手順を変える", "入室時のICカードで出席が自動記録され、点呼をやめる"],
    ["dx", "DX", "仕組みを変える", "「授業に来たか」ではなく「どこでどれだけ学んだか」で学習を捉え直す"]
  ];

  return (
    <>
      {card(
        0,
        "アナログ温度計とデジタル温度計を見比べる",
        "同じ温度を、連続で表す場合と段階で表す場合で並べます。つまみを動かしてみましょう。",
        <>
          <SliderField label="いまの本当の温度" value={temp} onChange={setTemp} min={-5} max={40} step={0.1} unit=" ℃" />
          <SelectField
            label="デジタル温度計の細かさ"
            value={gradation}
            onChange={setGradation}
            options={[
              { value: "1", label: "1℃きざみ（整数だけ表示）" },
              { value: "0.5", label: "0.5℃きざみ" },
              { value: "0.1", label: "0.1℃きざみ" }
            ]}
          />
          <div className="thermo-pair">
            <div className="thermo">
              <span className="thermo-title">アナログ温度計</span>
              <div className="thermo-tube">
                <i style={{ height: `${heightOf(temp)}%` }} />
              </div>
              <b className="thermo-read analog">{temp.toFixed(1)} ℃</b>
              <small>液体の高さがなめらかに変わる</small>
            </div>
            <div className="thermo">
              <span className="thermo-title">デジタル温度計</span>
              <div className="thermo-tube stepped">
                <i style={{ height: `${heightOf(digitalTemp)}%` }} />
                {gap > 0.001 && (
                  <em
                    style={{
                      bottom: `${Math.min(heightOf(temp), heightOf(digitalTemp))}%`,
                      height: `${Math.abs(heightOf(temp) - heightOf(digitalTemp))}%`
                    }}
                  />
                )}
              </div>
              <b className="thermo-read digital">{digitalTemp.toFixed(gradation === "1" ? 0 : 1)} ℃</b>
              <small>段階が決まっていて、途中で止まらない</small>
            </div>
          </div>
          <Formula>
            デジタルの表示 ＝ 本当の温度 ÷ きざみ幅 を、いちばん近い整数に丸めてから、もう一度きざみ幅をかけた値
          </Formula>
          <Steps
            items={[
              { label: "① 本当の温度", value: `${temp.toFixed(1)} ℃` },
              { label: `② きざみ幅 ${stepSize} ℃ で割る`, value: fmt(temp / stepSize, 3) },
              { label: "③ いちばん近い整数に丸める", value: fmt(Math.round(temp / stepSize), 0), note: "ここで段階に置きかわる" },
              { label: "④ きざみ幅をかけて表示に戻す", value: `${digitalTemp.toFixed(gradation === "1" ? 0 : 1)} ℃` },
              { label: "⑤ 本当の温度から引く", value: `${gap.toFixed(2)} ℃`, note: "これが丸めで失われた分" }
            ]}
          />
          <Results
            items={[
              { label: "デジタルの表示", value: `${digitalTemp.toFixed(gradation === "1" ? 0 : 1)} ℃`, note: "手順④で求めた、いちばん近い段階の値" },
              { label: "本当の温度とのずれ", value: `${gap.toFixed(2)} ℃`, warn: gap > stepSize / 4, note: "手順⑤の差。段階に丸めたせいで表せなかった分" },
              { label: "1℃あたりの段階数", value: `${fmt(1 / stepSize, 0)} 段階`, note: "1 ÷ きざみ幅。多いほど本当の温度に近づく" }
            ]}
          />
          <Hint>
            つまみを少しずつ動かすと、左はなめらかに動き、右はカクカクと飛びます。この「段階に置きかえる」考え方が、このあと学ぶ
            音（D7）・画像（D8）・動画（D9）のデジタル化すべての土台になります。
          </Hint>
        </>
      )}

      {card(
        1,
        "コピーを重ねると、絵はどうなるか",
        "同じ絵をアナログとデジタルでコピーし続けます。回数を増やして見比べましょう。",
        <>
          <SliderField label="コピーした回数" value={copies} onChange={setCopies} min={0} max={20} unit=" 回" />
          <SelectField
            label="1回コピーするごとの劣化の大きさ"
            value={wear}
            onChange={setWear}
            options={[
              { value: "small", label: "小さい（きれいなコピー機）" },
              { value: "normal", label: "ふつう" },
              { value: "large", label: "大きい（古いコピー機）" }
            ]}
          />
          <div className="copy-lab">
            <div>
              <span>もとの絵</span>
              <div className="pixel-grid">
                {copied.original.map((row, y) => (
                  <div key={y}>
                    {row.map((v, x) => (
                      <i key={x} style={{ background: `rgb(${v * 220 + 20},${v * 60 + 20},${v * 70 + 30})` }} />
                    ))}
                  </div>
                ))}
              </div>
              <small>スタート</small>
            </div>
            <div className="arrow">→</div>
            <div>
              <span>アナログでコピー</span>
              <div className="pixel-grid">
                {copied.analog.map((row, y) => (
                  <div key={y}>
                    {row.map((v, x) => (
                      <i key={x} style={{ background: `rgb(${v * 220 + 20},${v * 60 + 20},${v * 70 + 30})` }} />
                    ))}
                  </div>
                ))}
              </div>
              <small className={copies > 0 ? "bad" : ""}>{copies}回コピー後</small>
            </div>
            <div>
              <span>デジタルでコピー</span>
              <div className="pixel-grid">
                {copied.digital.map((row, y) => (
                  <div key={y}>
                    {row.map((v, x) => (
                      <i key={x} style={{ background: `rgb(${v * 220 + 20},${v * 60 + 20},${v * 70 + 30})` }} />
                    ))}
                  </div>
                ))}
              </div>
              <small className="good">{copies}回コピー後</small>
            </div>
          </div>
          <Results
            items={[
              { label: "アナログのくずれ具合", value: `${(copied.analogGap * 100).toFixed(1)} %`, warn: copied.analogGap > 0.05, note: "もとの絵と今の絵の差を、全部の点で平均した値" },
              { label: "いちばんくずれた点", value: `${(copied.worst * 100).toFixed(1)} %`, warn: copied.worst > 0.2, note: "いちばん大きくずれた1点の差" },
              { label: "デジタルのくずれ具合", value: "0.0 %", note: "毎回0か1に判定し直すので、差が生まれない" },
              { label: "あと5回コピーすると", value: copies >= 15 ? "アナログは判別が難しい" : "アナログはさらにくずれる", note: "デジタルは何回コピーしても0.0 %のまま" }
            ]}
          />
          <Verdict ok>
            見るところは「もとの絵とどれだけちがうか」の1つだけです。
            {copies === 0
              ? "いまは0回なので、どちらももとの絵と同じです。回数のつまみを右へ動かして、差がどちらに出るかを見てください。"
              : `${copies}回コピーした時点で、アナログは${(copied.analogGap * 100).toFixed(1)}%ずれ、デジタルは0.0%のまま。ここから「複製をくり返しても劣化しないのはデジタルのほうだ」と言えます。`}
          </Verdict>
          <Hint>
            デジタルが崩れないのは、コピーのたびに「この点は明るいほうか、暗いほうか」を判定し直して、0か1に戻しているからです。
            少しくらい汚れても、どちら寄りかさえ分かれば元どおりにできます。
          </Hint>
        </>
      )}

      {card(
        2,
        "ビット数を変えて、表せる数を確かめる",
        "1ビットから128ビットまで動かします。上段が表せる数、下段がバイトに直した大きさです。",
        <>
          <Row>
            <NumberField label="ビット数を直接入力" value={bits} onChange={(v) => setBits(clamp(Math.round(v), 1, 128))} min={1} max={128} unit="bit" />
          </Row>
          <SliderField label="ビット数" value={bits} onChange={setBits} min={1} max={128} unit=" bit" />
          <Formula>
            表せる組み合わせ ＝ 2 の {bits} 乗　／　{bits} bit ＝ {fmt(bits / 8, 3)} バイト
          </Formula>

          <div className="tier">
            <span className="tier-label">上段　表せる組み合わせ</span>
            <div className="tier-body">
              <div className="tier-cell wide">
                <small>2進数（1バイト＝8ビットごとに区切って表示）</small>
                <div className="byte-groups">
                  {byteGroups.map((group, index) => (
                    <b key={index} className="mono">
                      {group}
                    </b>
                  ))}
                </div>
                <em>2進数で {binaryRaw.length} けた。8ビットずつ区切って表示（先頭は0で埋めています）</em>
              </div>
              <div className="tier-cell">
                <small>10進数</small>
                <b className="big-number">{combos.toLocaleString("ja-JP")}</b>
                <em>通り</em>
              </div>
              <div className="tier-cell">
                <small>16進数</small>
                <b className="mono big-number">{combos.toString(16).toUpperCase()}</b>
                <em>{combos.toString(16).length} けた</em>
              </div>
            </div>
          </div>

          <div className="tier">
            <span className="tier-label">下段　もしこの数がバイト数だったら、どれくらいの大きさか</span>
            <div className="tier-body four">
              <div className="tier-cell">
                <small>B（バイト）</small>
                <b>{unit(combosNumber)}</b>
              </div>
              <div className="tier-cell">
                <small>KB（÷1,024）</small>
                <b>{unit(combosNumber / 1024)}</b>
              </div>
              <div className="tier-cell">
                <small>MB（÷1,024²）</small>
                <b>{unit(combosNumber / 1024 ** 2)}</b>
              </div>
              <div className="tier-cell">
                <small>GB（÷1,024³）</small>
                <b>{unit(combosNumber / 1024 ** 3)}</b>
              </div>
            </div>
          </div>

          <div className="preset-row">
            {[8, 10, 16, 20, 30, 32, 64, 128].map((n) => (
              <button type="button" key={n} onClick={() => setBits(n)}>
                {n} bit
              </button>
            ))}
          </div>
          <Hint>
            10ビットにすると1KB、20ビットで1MB、30ビットで1GBちょうどになります。1KB→1MB→1GBと単位が上がるとき、毎回1,024倍（＝2の10乗倍）になっているのは、このためです。
          </Hint>
        </>
      )}

      {card(
        3,
        "何ビットあれば区別できるかを求める",
        "区別したいものの数を入れると、必要なビット数が出ます。",
        <>
          <div className="preset-row">
            {presets.map(([label, value]) => (
              <button type="button" key={label} onClick={() => setKinds(value)}>
                {label}
              </button>
            ))}
          </div>
          <NumberField label="区別したいものの数" value={kinds} onChange={setKinds} min={2} max={16777216} unit="種類" />
          <Formula>2 の（必要なビット数）乗 ≧ 区別したいものの数</Formula>
          <Results
            items={[
              { label: "必要な最小ビット数", value: `${neededBits} bit`, note: `2のn乗が${fmt(safeKinds, 0)}種類以上になる、いちばん小さいn` },
              { label: `${neededBits}ビットで表せる数`, value: `${fmt(capacity, 0)} 通り`, note: `2の${neededBits}乗。区別したい数をちょうど上回る` },
              { label: "余り", value: `${fmt(capacity - safeKinds, 0)} 通り`, note: "表せる数から区別したい数を引いた、使わずに残る分" },
              { label: `${neededBits - 1}ビットだと`, value: `${fmt(2 ** (neededBits - 1), 0)} 通りで不足`, warn: true, note: "1ビット減らすと、区別したい数に届かなくなる" }
            ]}
          />
          <DataTable
            head={["ビット数", "表せる数", "判定"]}
            rows={[neededBits - 2, neededBits - 1, neededBits, neededBits + 1]
              .filter((n) => n >= 1)
              .map((n) => [`${n} bit`, fmt(2 ** n, 0), 2 ** n >= safeKinds ? "足りる" : "足りない"])}
            highlight={(index) =>
              [neededBits - 2, neededBits - 1, neededBits, neededBits + 1].filter((n) => n >= 1)[index] === neededBits
            }
          />
          <div className="bit-scale">
            <span className="bit-scale-label">1〜24ビットの早見表（今の答えは色つき）</span>
            <div className="bit-scale-grid">
              {bitTable.map((n) => (
                <b key={n} className={n === neededBits ? "on" : 2 ** n >= safeKinds ? "enough" : ""}>
                  <span>{n}bit</span>
                  <em>{fmt(2 ** n, 0)}</em>
                </b>
              ))}
            </div>
            <em className="bit-scale-note">
              24ビット＝16,777,216通り。光の3原色を各8ビット（256階調）で表すと8×3＝24ビットになり、これが「フルカラー」です。
            </em>
          </div>
          <HintButton id="feature-3-1">
            必要なビット数は「その数以上になる最小の2のn乗」を探すことで求まります。15種類なら4ビット（16通り）、50色なら6ビット（64通り）、
            1,677万色なら24ビット（16,777,216通り）です。ビットを1つ増やすたびに、表せる数は2倍になります。
          </HintButton>
        </>
      )}

      {card(
        4,
        "デジタル化の3つの段階で身近な情報を分類する",
        "段階が上がるほど、変わる範囲が広がります。カードを押して確かめましょう。",
        <>
          <div className="stage-flow">
            {stages.map(([id, name, change, example], index) => (
              <div key={id} className={`stage-card ${stage === id ? "active" : ""}`} onClick={() => setStage(id)}>
                <span className="stage-step">STEP {index + 1}</span>
                <b>{name}</b>
                <i>{change}</i>
                <p>{example}</p>
              </div>
            ))}
          </div>
          <div className="stage-scale">
            <span>書き方が変わるだけ</span>
            <div className="scale-bar">
              <i style={{ width: `${(stages.findIndex(([id]) => id === stage) + 1) * 33.3}%` }} />
            </div>
            <span>やり方の仕組みごと変わる</span>
          </div>
          <AreaField
            label="選んだ事例と、次の段階に進めるなら何を変えるか"
            value={missionNote}
            onChange={onMissionNote}
            placeholder="例：出席確認は今アプリ入力なのでデジタイゼーション。入室時のICカードで自動記録すれば点呼の手順がなくなり、デジタライゼーションに進む。"
            rows={4}
          />
        </>
      )}
    </>
  );
}

/* ========================================================================
 * D1 基数変換・加算・シフト
 * ====================================================================== */
export function BaseLab({ card, missionNote, onMissionNote }: LabProps) {
  const [decimal, setDecimal] = useState(45);
  const [ladderValue, setLadderValue] = useState(36);
  const [bitInput, setBitInput] = useState("00101101");
  const [fraction, setFraction] = useState(0.1);
  const [addA, setAddA] = useState("11001011");
  const [addB, setAddB] = useState("11110110");
  const [shiftTab, setShiftTab] = useState("logical");
  const [shiftSource, setShiftSource] = useState("00001011");
  const [shiftCount, setShiftCount] = useState(3);
  const [shiftDir, setShiftDir] = useState("left");
  const [devices, setDevices] = useState(480);
  const [growth, setGrowth] = useState(3);

  const ladder = divisionLadder(ladderValue);
  const bits = padBits(parseBits(bitInput) || "0", 8);
  const bitValue = parseInt(bits, 2);
  const fracBinary = toBase(fraction, 2, 20);
  const fracBack = fromBase(fracBinary, 2) ?? 0;
  const fracRows = fractionSteps(fraction, 8);
  const add = binaryAdd(addA, addB, 8);
  const logical = shiftBits(shiftSource, 8, shiftDir as "left" | "right", shiftCount, "logical");
  const arithmetic = shiftBits(shiftSource, 8, shiftDir as "left" | "right", shiftCount, "arithmetic");
  const needed = devices;
  const future = Math.ceil(devices * (1 + growth / 10));
  const requiredBits = Math.ceil(Math.log2(Math.max(1, future)));

  const toggleBit = (index: number) => {
    const next = bits.split("");
    next[index] = next[index] === "1" ? "0" : "1";
    setBitInput(next.join(""));
  };

  return (
    <>
      {card(
        0,
        "同じ数を2進数・10進数・16進数で見比べる",
        "同じ値が、表記を変えても同じ数であることを確かめます。ビットのボタンを押して確かめましょう。",
        <>
              <Row>
                <NumberField label="10進数(10)（ふだん使う数）を入力" value={decimal} onChange={(v) => { setDecimal(clamp(v, 0, 255)); setBitInput(padBits(clamp(v, 0, 255).toString(2), 8)); }} min={0} max={255} />
                <TextField label="2進数(2)を直接入力" value={bitInput} onChange={(v) => { setBitInput(v); const parsed = parseInt(parseBits(v) || "0", 2); setDecimal(parsed); }} mono hint="0と1だけ・8けた" />
              </Row>
              <BitStrip bits={bits} onToggle={toggleBit} />
              <Results
                items={[
                  { label: "2進数(2)", value: bits, note: "ビットのボタンで作った、0と1だけの並び" },
                  { label: "10進数(10)", value: bitValue, note: "1が立ったけたの重み（1,2,4,8…）を全部たした値" },
                  { label: "16進数(16)", value: bitValue.toString(16).toUpperCase().padStart(2, "0"), note: "同じ値を、右から4けたずつ区切って書き直したもの" },
                  { label: "8進数(8)", value: bitValue.toString(8), note: "同じ値を、右から3けたずつ区切って書き直したもの" }
                ]}
              />
              <Hint>ビットのボタンを押すと0と1が入れかわります。1が立っているけたの重みを足すと10進数になります。16進数は「右から4けたずつ区切って書き直したもの」で、上の表のとおり同じ値です。</Hint>
        </>
      )}

      {card(
        1,
        "割り算をくり返して2進数にする",
        "10進数を2で割り続け、余りを逆から並べます。教科書と同じ手順です。",
        <>
          <NumberField label="10進数(10)（ふだん使う数）を入力" value={ladderValue} onChange={(v) => setLadderValue(clamp(Math.round(v), 0, 100000))} min={0} max={100000} />
          <div className="preset-row">
            {[36, 88, 72, 44, 255].map((v) => (
              <button type="button" key={v} onClick={() => setLadderValue(v)}>
                {v}
              </button>
            ))}
          </div>
          <Formula>
            2進数 ＝ 商が0になるまで2で割り続け、そのつど出た余り（0か1）を下から上へ読んだ並び
          </Formula>
          <DataTable
            head={["割られる数", "÷2 の商", "余り"]}
            rows={ladder.rows.map((r, i) => [
              r.dividend,
              r.quotient,
              <b key={i} className="hot">{r.remainder}</b>
            ])}
          />
          <div className="ladder-result">
            <span>余りを下から上へ並べる → 2進数(2)</span>
            <b className="mono">{ladder.digits}</b>
          </div>
          <Steps
            items={[
              { label: "① 2で割った回数", value: `${ladder.rows.length} 回`, note: "商が0になるまでくり返した" },
              {
                label: "② 出てきた余りを、表の上から順に書く",
                value: <span className="mono">{ladder.rows.map((r) => r.remainder).join("")}</span>,
                note: "左が1回目の余り"
              },
              {
                label: "③ 最後の一手：その並びを逆にする（下から上へ読む）",
                value: <span className="mono">{ladder.digits}</span>,
                note: "最後に出た余りがいちばん上のけたになる"
              },
              { label: "④ けたの重みを足して確かめる", value: parseInt(ladder.digits, 2), note: "もとの10進数に戻れば正しい" }
            ]}
          />
          <Results
            items={[
              { label: "10進数(10)", value: ladderValue, note: "入力した、ふだん使う数" },
              { label: "2進数(2)", value: <span className="mono">{ladder.digits}</span>, note: "手順③で、余りを下から上へ読んだ並び" },
              { label: "けた数", value: `${ladder.digits.length} けた`, note: "割り算をくり返した回数と同じ" },
              { label: "答え合わせ（2進数を10進数に戻す）", value: parseInt(ladder.digits, 2) === ladderValue ? "一致" : "不一致", warn: parseInt(ladder.digits, 2) !== ladderValue, note: "1が立ったけたの重みを足した結果と、もとの数を比べた" }
            ]}
          />
          <HintButton id="base-1-1">
            商が0になるまで2で割り、出てきた余りを最後から最初へ逆順に並べると2進数になります。
            表の余りの列を、下から上へ読んでみましょう。
          </HintButton>
        </>
      )}

      {card(
        2,
        "小数を2進数にする",
        "10進の小数を2進数に直し、けたが途中で終わるかを確かめます。",
        <>
          <NumberField label="10進数(10)の小数を入力" value={fraction} onChange={setFraction} step={0.05} min={0} max={100} hint="0.1 や 0.375 を試そう" />
          <Formula>
            小数部の2進数 ＝ 小数部に2をかけ、出てきた整数部（0か1）を上から順に並べたもの（小数部が0になるまでくり返す）
          </Formula>
          <DataTable
            head={["小数点以下 何けた目", "小数部 × 2", "整数部＝このけた", "残る小数部"]}
            rows={fracRows.map((r, i) => [
              `${i + 1} けた目`,
              `${fmt(r.before, 10)} × 2 ＝ ${fmt(r.doubled, 10)}`,
              <b key={i} className="hot">{r.digit}</b>,
              fmt(r.after, 10)
            ])}
          />
          <Steps
            items={[
              { label: "① 整数部を2で割って2進数にする", value: <span className="mono">{Math.floor(fraction).toString(2)}</span>, note: "小数点より左の部分" },
              {
                label: "② 小数部に2をかけ、整数部を上から順に拾う",
                value: <span className="mono">{fracRows.map((r) => r.digit).join("") || "0"}</span>,
                note: fracRows.length >= 8 ? "8けた目までを表示（この先も続く）" : "小数部が0になったので、ここで終わり"
              },
              { label: "③ ①と②を小数点でつなぐ", value: <span className="mono">{fracBinary}</span>, note: "20けたまで表示" },
              { label: "④ けたの重み（1/2, 1/4, 1/8…）を足して10進数に戻す", value: fmt(fracBack, 12) },
              { label: "⑤ もとの数から引く", value: fmt(Math.abs(fraction - fracBack), 12), note: "打ち切ったせいで残った誤差" }
            ]}
          />
          <Results
            items={[
              { label: "2進数(2)（20けたまで）", value: <span className="mono">{fracBinary}</span>, note: "手順③でつないだ並び。20けたで打ち切っている" },
              { label: "戻した値", value: fmt(fracBack, 12), note: "手順④。1が立ったけたの重みを足した値" },
              { label: "誤差", value: fmt(Math.abs(fraction - fracBack), 12), warn: Math.abs(fraction - fracBack) > 1e-9, note: "手順⑤。0でなければ、けたが足りていない" },
              { label: "けたが途中で終わるか", value: Math.abs(fraction - fracBack) < 1e-12 ? "終わる" : "終わらない（循環する）", note: "誤差が0なら終わる、残るなら終わらない" }
            ]}
          />
          <Hint>0.5、0.25、0.375 は表せますが、0.1 や 0.3 は循環して表しきれません。ここが誤差の出発点です。</Hint>
        </>
      )}

      {card(
        3,
        "2進数の筆算で足す",
        "8けたの2進数を2つ入力し、けたごとのくり上がりを追います。",
        <>
          <Row>
            <TextField label="元の値(2)" value={addA} onChange={setAddA} mono hint="0と1だけ・8けた" />
            <TextField label="加える値(2)" value={addB} onChange={setAddB} mono hint="0と1だけ・8けた" />
          </Row>
          <Formula>
            けたごとに　元の値のけた ＋ 加える値のけた ＋ 下から来たくり上がり　を足し、2以上なら和のけたに（合計−2）を書いて上のけたへ1を送る
          </Formula>
          <div className="calc-sheet">
            <div><span>くり上がり(2)</span><b className="mono">{add.carries}</b></div>
            <div><span>元の値(2)</span><b className="mono">{add.a}</b></div>
            <div><span>加える値(2)</span><b className="mono">{add.b}</b></div>
            <div className="sum"><span>結果(2)</span><b className="mono">{add.sum}</b></div>
          </div>
          <DataTable
            head={["けた（右から）", "けたの重み", "元の値", "加える値", "下から来たくり上がり", "足した合計", "和のけた", "上へ送るくり上がり"]}
            rows={Array.from({ length: 8 }, (_, k) => {
              const i = 7 - k; // k=0 がいちばん右のけた
              const carryIn = i === 7 ? 0 : Number(add.carries[i + 1]);
              const total = Number(add.a[i]) + Number(add.b[i]) + carryIn;
              return [
                `${k + 1} けた目`,
                fmt(2 ** k, 0),
                add.a[i],
                add.b[i],
                carryIn,
                total,
                <b key={k} className="hot">{total % 2}</b>,
                add.carries[i]
              ];
            })}
          />
          <Steps
            items={[
              { label: "① いちばん右のけたから足す", value: `${add.a[7]} ＋ ${add.b[7]} ＝ ${Number(add.a[7]) + Number(add.b[7])}`, note: "下からのくり上がりはまだ無い" },
              { label: "② 各けたが上へ送ったくり上がり", value: <span className="mono">{add.carries}</span>, note: "1が立ったけたで、上のけたへ1を送った" },
              { label: "③ 8けた分の和", value: <span className="mono">{add.sum}</span> },
              { label: "④ 9けた目まで書くと", value: <span className="mono">{add.full}</span>, note: add.overflow ? "先頭の1は8けたに入らないので捨てる" : "9けた目は出なかった" },
              { label: "⑤ 10進で答え合わせ", value: `${add.decimalA} ＋ ${add.decimalB} ＝ ${add.decimalSum}` }
            ]}
          />
          <Results
            items={[
              { label: "10進での確認", value: `${add.decimalA} + ${add.decimalB} = ${add.decimalSum}`, note: "手順⑤。2進数の筆算と同じ答えになるはず" },
              { label: "8けたに収まるか", value: add.overflow ? "けたあふれ（オーバーフロー）" : "収まる", warn: add.overflow, note: "いちばん左のけたから、さらに1が出たかどうか" },
              { label: "9けた目まで含めた、切り捨てる前の結果", value: <span className="mono">{add.full}</span>, note: "手順④。先頭の1を捨てたものが画面の結果(2)" }
            ]}
          />
          <Hint>1 + 1 は 10（イチゼロ）。決めたけた数からあふれた1は捨てられます。これがオーバーフローです。</Hint>
        </>
      )}

      {card(
        4,
        "けたをずらす：0で埋めるシフトと、符号を残すシフト",
        "同じビット列を同じ向きにずらし、空いた場所に何が入るかの違いを見比べます。",
        <>
          <Row>
            <TextField label="元のビット列" value={shiftSource} onChange={setShiftSource} mono hint="先頭が1なら負の数として読む" />
            <SelectField label="方向" value={shiftDir} onChange={setShiftDir} options={[{ value: "left", label: "左シフト（×2）" }, { value: "right", label: "右シフト（÷2）" }]} />
            <NumberField label="ずらすビット数" value={shiftCount} onChange={setShiftCount} min={0} max={8} />
          </Row>
          <Formula>
            1けたずらすと、すべてのけたの重みが2倍（左）または1/2（右）になる　→　{shiftCount}けたずらすと 計算どおりなら
            {shiftDir === "left" ? ` ×2の${shiftCount}乗 ＝ ×${2 ** shiftCount}` : ` ÷2の${shiftCount}乗 ＝ ÷${2 ** shiftCount}`}
          </Formula>
          <Tabs
            value={shiftTab}
            onChange={setShiftTab}
            options={[
              { value: "logical", label: "論理シフト（符号なし）" },
              { value: "arithmetic", label: "算術シフト（符号あり）" }
            ]}
          />
          {shiftTab === "logical" ? (
            <>
              <BitStrip bits={logical.before} />
              <div className="shift-arrow">{shiftDir === "left" ? "← 左へ" : "右へ →"} {shiftCount} ビット（空きには 0 が入る）</div>
              <BitStrip bits={logical.after} />
              <Steps
                items={[
                  { label: "① シフト前の値（1が立ったけたの重みの合計）", value: logical.beforeValue },
                  {
                    label: `② ${shiftDir === "left" ? "左" : "右"}へ ${shiftCount} けたずらす（${shiftDir === "left" ? "×2" : "÷2"} を ${shiftCount} 回）`,
                    value: shiftDir === "left" ? `${logical.beforeValue} × ${2 ** shiftCount}` : `${logical.beforeValue} ÷ ${2 ** shiftCount}`,
                    note: "空いたけたには0が入る"
                  },
                  {
                    label: "③ 計算どおりならこの値",
                    value: shiftDir === "left" ? fmt(logical.beforeValue * 2 ** shiftCount, 3) : fmt(logical.beforeValue / 2 ** shiftCount, 3),
                    note: "8けたに収まりきらない分は、まだ捨てていない"
                  },
                  {
                    label: "④ 8けたからはみ出したビットを捨てた結果",
                    value: logical.afterValue,
                    note: logical.beforeValue && logical.afterValue !== (shiftDir === "left" ? logical.beforeValue * 2 ** shiftCount : Math.floor(logical.beforeValue / 2 ** shiftCount)) ? "はみ出した分だけ、③とずれた" : "はみ出しはなく、③と同じ"
                  },
                  { label: "⑤ 実際は何倍になったか（④ ÷ ①）", value: logical.beforeValue ? fmt(logical.afterValue / logical.beforeValue, 3) : "-" }
                ]}
              />
              <Results
                items={[
                  { label: "シフト前（10進）", value: logical.beforeValue, note: "ずらす前のビット列を、符号なしで読んだ値" },
                  { label: "シフト後（10進）", value: logical.afterValue, note: "手順④。はみ出したビットを捨てたあとの値" },
                  { label: "計算どおりなら何倍か", value: shiftDir === "left" ? `×${2 ** shiftCount}` : `÷${2 ** shiftCount}`, note: `2の${shiftCount}乗。けたの重みが${shiftCount}回変わるため` },
                  { label: "実際は何倍になったか", value: logical.beforeValue ? fmt(logical.afterValue / logical.beforeValue, 3) : "-", warn: shiftDir === "left" && logical.afterValue < logical.beforeValue, note: "手順⑤。ずれていれば、けたがはみ出して捨てられている" }
                ]}
              />
              <Hint>ビット列のはしからはみ出した0や1は消えてしまうので、ぴったり2倍・半分にならないことがあります。</Hint>
            </>
          ) : (
            <>
              <BitStrip bits={arithmetic.before} signed />
              <div className="shift-arrow">{shiftDir === "left" ? "← 左へ" : "右へ →"} {shiftCount} ビット（空きには {shiftDir === "right" ? arithmetic.before[0] : "0"} が入る）</div>
              <BitStrip bits={arithmetic.after} signed />
              <Steps
                items={[
                  { label: "① シフト前の値（先頭のけたの重みだけマイナス）", value: arithmetic.beforeValue },
                  {
                    label: `② ${shiftDir === "left" ? "左" : "右"}へ ${shiftCount} けたずらす（${shiftDir === "left" ? "×2" : "÷2"} を ${shiftCount} 回）`,
                    value: shiftDir === "left" ? `${arithmetic.beforeValue} × ${2 ** shiftCount}` : `${arithmetic.beforeValue} ÷ ${2 ** shiftCount}`,
                    note: shiftDir === "right" ? `空いたけたには先頭と同じ ${arithmetic.before[0]} が入る` : "空いたけたには0が入る"
                  },
                  { label: "③ ずらしたあとのビット列", value: <span className="mono">{arithmetic.after}</span> },
                  { label: "④ 符号付きで読み直した値", value: arithmetic.afterValue, note: "先頭が1なら負の数として読む" }
                ]}
              />
              <Results
                items={[
                  { label: "シフト前（符号付き）", value: arithmetic.beforeValue, note: "先頭のけたの重みをマイナスとして読んだ値" },
                  { label: "シフト後（符号付き）", value: arithmetic.afterValue, note: "手順④。同じ読み方でずらしたあとを読んだ値" },
                  { label: "符号は保たれたか", value: arithmetic.before[0] === arithmetic.after[0] ? "保たれた" : "変わった", warn: arithmetic.before[0] !== arithmetic.after[0], note: "先頭のけたが、ずらす前とあとで同じかどうか" },
                  { label: "論理シフトなら", value: logical.after, note: "空きに0を入れた場合。先頭が0になり、負の数が正に変わってしまう" }
                ]}
              />
              <Hint>負の数を論理シフトすると符号が消えて正の数になってしまいます。だから符号ありには算術シフトを使います。</Hint>
            </>
          )}
          <HintButton id="base-4-1">
            右にずらすと、いちばん左のあいた場所に何を入れるかが問題になります。ここに0を入れると、マイナスだった数がいきなりプラスに変わってしまいます。だから「いちばん左の値をそのままコピーして入れる」というルールにしています。氷を割って半分にしても氷であることは変わらないのと同じで、半分にしてもマイナスはマイナスのままでなければいけません。
          </HintButton>
        </>
      )}

      {card(
        5,
        "校内の端末に重複しないIDを設計する",
        "台数と増え方から必要なビット数を見積もり、採用するビット数とその理由を書きます。",
        <>
          <Row>
            <NumberField label="今の台数" value={devices} onChange={setDevices} min={1} max={1000000} unit="台" />
            <NumberField label="10年後に何割ふえそうか" value={growth} onChange={setGrowth} min={0} max={100} unit="割" />
          </Row>
          <Formula>
            必要なビット数 ＝ 2のn乗 ≧ 番号をつけたい台数　を満たす、いちばん小さい n
          </Formula>
          <Steps
            items={[
              { label: "① 今の台数", value: `${fmt(needed, 0)} 台` },
              { label: `② ${growth}割ふえた10年後の台数`, value: `${fmt(needed, 0)} × ${fmt(1 + growth / 10, 1)} ＝ ${fmt(future, 0)} 台`, note: "小数は切り上げる" },
              { label: "③ その台数以上になる2のn乗をさがす", value: `2の${requiredBits}乗 ＝ ${fmt(2 ** requiredBits, 0)}`, note: `2の${requiredBits - 1}乗 ＝ ${fmt(2 ** (requiredBits - 1), 0)} では足りない` },
              { label: "④ 必要なビット数", value: `${requiredBits} bit` },
              { label: "⑤ 余り", value: `${fmt(2 ** requiredBits - future, 0)} 台分`, note: "さらに増えても使える余裕" }
            ]}
          />
          <Results
            items={[
              { label: "将来の必要数", value: `${fmt(future, 0)} 台`, note: "手順②。今の台数に増える分を足した見積もり" },
              { label: "必要な最小ビット数", value: `${requiredBits} bit`, note: "手順④。この台数以上になる最小の2のn乗のn" },
              { label: `${requiredBits} bitで表せる数`, value: fmt(2 ** requiredBits, 0), note: `2の${requiredBits}乗。これだけの番号を作れる` },
              { label: "8ビットで足りるか", value: future <= 256 ? "足りる" : "不足", warn: future > 256, note: "8 bit ＝ 256通りと、将来の必要数を比べた" }
            ]}
          />
          <Hint>必要数以上になる最小の2のn乗を選びます。足りないと必ずどこかで番号がぶつかります。128ビットなら 3.4×10³⁸ 通り（IPv6と同じ規模）で、増設の心配がなくなります。</Hint>
          <AreaField
            label="採用するビット数と、その理由"
            value={missionNote}
            onChange={onMissionNote}
            placeholder="例：現在480台、10年後に720台と見積もると10ビット（1,024通り）で足りる。ただし他校と統合する可能性を考え16ビットを採用する。"
            rows={4}
          />
        </>
      )}
    </>
  );
}

/* ========================================================================
 * D2 負の数（補数）
 * ====================================================================== */
export function NegativeLab({ card, missionNote, onMissionNote }: LabProps) {
  const [minuend, setMinuend] = useState(56);
  const [subtrahend, setSubtrahend] = useState(17);
  const [source, setSource] = useState("00000101");
  const [target, setTarget] = useState(-50);
  const [width, setWidth] = useState(8);
  const [counterMax, setCounterMax] = useState(300);

  const digits = String(Math.max(minuend, subtrahend)).length;
  const complement = radixComplement(subtrahend, 10, digits);
  const added = minuend + complement;
  const dropped = added - 10 ** digits;
  const bits = padBits(parseBits(source) || "0", 8);
  const ones = onesComplement(bits);
  const twos = twosComplement(bits, 8);
  const check = binaryAdd(bits, twos.result, 8);
  const signedBits = toSignedBits(target, width);
  const unsignedMax = 2 ** width - 1;
  const signedMin = -(2 ** (width - 1));
  const signedMax = 2 ** (width - 1) - 1;

  return (
    <>
      {card(
        0,
        "足し算しかできない機械で、引き算をする",
        "CPUの計算回路は足し算が基本です。引き算をどうやって足し算に変えるかを試します。",
        <>
          <div className="premise">
            <b>この機械にできること</b>
            <span className="ok">足し算</span>
            <span className="ng">引き算</span>
            <span className="ok">けたあふれを捨てる</span>
          </div>
          <Row>
            <NumberField label="引かれる数" value={minuend} onChange={setMinuend} min={0} max={99999} />
            <NumberField label="引く数" value={subtrahend} onChange={setSubtrahend} min={0} max={99999} />
          </Row>
          <Steps
            items={[
              { label: `引く数を「足すとけたが1つ上がる数」に置きかえる`, value: fmt(complement, 0), note: `${10 ** digits} − ${subtrahend}` },
              { label: "足し算だけする", value: `${minuend} + ${complement} = ${fmt(added, 0)}` },
              { label: "あふれたけたを捨てる", value: fmt(dropped, 0), note: `${10 ** digits} のけたを消す` },
              { label: "ふつうに引くと", value: fmt(minuend - subtrahend, 0) }
            ]}
          />
          <div className="drop-digit">
            <span className="dropped">{String(added).slice(0, String(added).length - digits) || "0"}</span>
            <span className="kept">{String(added).slice(-digits).padStart(digits, "0")}</span>
            <i>← 左の色が薄い部分は、けたあふれとして捨てられる</i>
          </div>
          <Verdict ok={dropped === minuend - subtrahend}>
            {dropped === minuend - subtrahend
              ? `${minuend} − ${subtrahend} を、引き算をひとつも使わずに求められました。`
              : "けた数の指定を見直してください。"}
          </Verdict>
          <Hint>
            補数とは「その数に足したとき、けた上がりする最小の数」です。引き算を、足し算とけた捨てに置きかえられるので、
            機械は加算回路だけを持てばよくなります。次からは、これを2進数でやってみます。
          </Hint>
        </>
      )}

      {card(
        1,
        "1の補数から2の補数までを、ひと続きで作る",
        "1つのビット列に、反転（1の補数）と＋1（2の補数）を続けて行い、元の数と足すと0になることまで確かめます。",
        <>
          <TextField label="元のビット列(2)（8けた）" value={source} onChange={setSource} mono hint="0と1だけ・8けた" />
          <Formula>1の補数 ＝ すべてのけたの0と1を入れかえた並び　／　2の補数 ＝ 1の補数 ＋ 1</Formula>

          <div className="complement-chain">
            <div className="chain-step">
              <span className="chain-tag">① 元のビット列</span>
              <BitStrip bits={bits} />
              <em>符号なしで読むと {parseInt(bits, 2)}</em>
            </div>
            <div className="chain-arrow">
              <b>すべて反転（NOT）</b>
              <i>0は1へ、1は0へ</i>
            </div>
            <div className="chain-step">
              <span className="chain-tag">② 1の補数</span>
              <BitStrip bits={ones} />
              <em>①と②を足すと必ず 11111111（＝{parseInt(bits, 2)} ＋ {parseInt(ones, 2)} ＝ 255）</em>
            </div>
            <div className="chain-arrow">
              <b>＋1 する</b>
              <i>ここが1の補数と2の補数のちがい</i>
            </div>
            <div className="chain-step accent">
              <span className="chain-tag">③ 2の補数</span>
              <BitStrip bits={twos.result} />
              <em>10進で読むと {signedValue(twos.result)}。これが「元の数のマイナス版」</em>
            </div>
          </div>

          <Steps
            items={[
              { label: "① 元のビット列(2)", value: <span className="mono">{bits}</span>, note: `符号なしで読むと ${parseInt(bits, 2)}` },
              { label: "② けたごとに0と1を入れかえる（1の補数）", value: <span className="mono">{ones}</span>, note: "機械はNOTを8個並べるだけでできる" },
              { label: "③ ②に1を足す（2の補数）", value: <span className="mono">{twos.result}</span>, note: "1の補数より、ちょうど1だけ大きい" },
              { label: "④ ①と③を足して確かめる", value: <span className="mono">{check.full}</span>, note: `8けたからあふれた1を捨てると ${check.sum}` }
            ]}
          />
          <Results
            items={[
              { label: "元の値（符号なし）", value: parseInt(bits, 2), note: "1が立ったけたの重みを足した値" },
              { label: "1の補数", value: <span className="mono">{ones}</span>, note: "手順②。足すと255（11111111）になる相手" },
              { label: "2の補数", value: <span className="mono">{twos.result}</span>, note: "手順③。1の補数＋1。足すと256になり、8けたでは0になる相手" },
              { label: "2の補数を符号つきで読むと", value: signedValue(twos.result), note: "元の値の符号を反転した数になっていれば正しい" }
            ]}
          />
          <Verdict ok={check.sum === "00000000"}>
            {check.sum === "00000000"
              ? `${parseInt(bits, 2)} + (${signedValue(twos.result)}) = 0 が成り立ちました。引き算をせずに、足し算とけた捨てだけで求められています。`
              : "0になりません。元の値が0のときは、2の補数も0になります（0に符号はないため）。"}
          </Verdict>
          <HintButton id="negative-1-1">
            1の補数は、オセロの盤面をまるごと裏返すのと同じで、0と1を入れかえるだけです。足すと必ず 11111111（255）になります。
            そこにもう1だけ足したものが2の補数で、足すと 100000000（256）になります。8けたしかない機械では、いちばん上のけたは捨てられるので、
            残るのは 00000000＝0 です。つまり2の補数は「足すと0になる相手」＝マイナスの値そのものになります。
            1の補数で止めると255にしかならないので、0にするための最後の＋1が要る、というつながりです。
          </HintButton>
        </>
      )}

      {card(
        2,
        "10進数を、マイナスも表せるビットの並びにする",
        "負の数を入力して、表現できる範囲の外に出るとどうなるかを見ます。",
        <>
          <Row>
            <NumberField label="10進数(10)（負でも可）" value={target} onChange={setTarget} min={-100000} max={100000} />
            <SelectField label="ビット幅" value={String(width)} onChange={(v) => setWidth(Number(v))} options={[4, 8, 16, 32].map((n) => ({ value: String(n), label: `${n} bit` }))} />
          </Row>
          <Formula>
            負の数のビット列 ＝ 2の{width}乗 ＋ その数　を、{width}けたの2進数にした並び（正の数はそのまま2進数にする）
          </Formula>
          <Formula>
            表せる範囲 ＝ −2の（{width}−1）乗 　〜 　2の（{width}−1）乗 − 1 　＝ 　{fmt(signedMin, 0)} 〜 {fmt(signedMax, 0)}
          </Formula>
          {signedBits ? (
            <>
              <BitStrip bits={signedBits.length > 16 ? signedBits.slice(-16) : signedBits} signed weights={width <= 16} />
              <Steps
                items={[
                  { label: "① 入力した10進数(10)", value: target },
                  {
                    label: target < 0 ? `② 負なので 2の${width}乗 を足す` : "② 正なのでそのまま使う",
                    value: target < 0 ? `${fmt(2 ** width, 0)} ＋ (${target}) ＝ ${fmt(2 ** width + target, 0)}` : fmt(target, 0),
                    note: `2の${width}乗 ＝ ${fmt(2 ** width, 0)}`
                  },
                  { label: `③ ${width}けたの2進数(2)にする`, value: <span className="mono">{signedBits}</span> },
                  { label: "④ いちばん左のけたを見る", value: signedBits[0] === "1" ? "1 → 負の数" : "0 → 正の数", note: "これが符号ビット" }
                ]}
              />
              <Results
                items={[
                  { label: "2の補数での表し方", value: <span className="mono">{signedBits}</span>, note: "手順③。この並びで負の数まで表せる" },
                  { label: "符号ビット", value: signedBits[0] === "1" ? "1（負）" : "0（正）", note: "手順④。いちばん左のけただけで正負が分かる" },
                  { label: "16進数(16)", value: parseInt(signedBits, 2).toString(16).toUpperCase(), note: "同じ並びを4けたずつ区切って書き直したもの" }
                ]}
              />
            </>
          ) : (
            <Verdict ok={false}>
              {width} ビットでは表せません。範囲は {signedMin} 〜 {signedMax} です。
            </Verdict>
          )}
          <HintButton id="negative-2-1">
            いちばん左のビットが1なら、その数はマイナスという約束です。ビットの数が決まっているので、表せる数にも上限と下限があります。8けたのメーターに999が表示できないのと同じで、範囲の外の数は入りません。
          </HintButton>
        </>
      )}

      {card(
        3,
        "表現できる範囲を比べる",
        "符号なしと符号ありで、範囲がどう変わるかを確かめます。",
        <>
          <SliderField label="ビット幅" value={width} onChange={setWidth} min={4} max={32} unit=" bit" />
          <Formula>
            符号なしの上限 ＝ 2の{width}乗 − 1　／　符号ありの範囲 ＝ −2の（{width}−1）乗 〜 2の（{width}−1）乗 − 1
          </Formula>
          <Steps
            items={[
              { label: "① 全部の組み合わせ", value: `2の${width}乗 ＝ ${fmt(2 ** width, 0)} 通り`, note: "符号ありでも符号なしでも、この数は変わらない" },
              { label: "② 符号なしなら 0 から順に割り当てる", value: `0 〜 ${fmt(unsignedMax, 0)}`, note: "上限は 2の乗数 −1（0の分だけ1つ減る）" },
              { label: "③ 符号ありなら半分ずつに分ける", value: `${fmt(2 ** (width - 1), 0)} 個ずつ`, note: `2の（${width}−1）乗 ＝ ${fmt(2 ** (width - 1), 0)}` },
              { label: "④ 0を正の側に入れる", value: `正 ${fmt(signedMax + 1, 0)} 個 ／ 負 ${fmt(-signedMin, 0)} 個`, note: "正の側は0で1つ使うので、表せる最大は1小さくなる" },
              { label: "⑤ 符号ありの範囲", value: `${fmt(signedMin, 0)} 〜 ${fmt(signedMax, 0)}` }
            ]}
          />
          <Results
            items={[
              { label: "符号なし", value: `0 〜 ${fmt(unsignedMax, 0)}`, note: `手順②。全${fmt(2 ** width, 0)} 通りを0から順に使う` },
              { label: "符号あり", value: `${fmt(signedMin, 0)} 〜 ${fmt(signedMax, 0)}`, note: `手順⑤。同じ${fmt(2 ** width, 0)} 通りを正負に分けた` },
              { label: "正の側", value: `${fmt(signedMax + 1, 0)} 個`, note: "0を含む。だから表せる最大は1つ小さい" },
              { label: "負の側", value: `${fmt(-signedMin, 0)} 個`, note: "0を使わないぶん、負が1つ多い" }
            ]}
          />
          <Hint>個数はどちらも同じ 2 の {width} 乗です。0をプラス側に入れるので、マイナス側が1つだけ多くなり、上下でそろいません。</Hint>
        </>
      )}

      {card(
        4,
        "購買部の在庫を数える仕組みを設計する",
        "いちばん大きい数といちばん小さい数から、何ビット使うか、マイナスを表せるようにするかを決めます。",
        <>
          <NumberField label="1日に扱う最大個数" value={counterMax} onChange={setCounterMax} min={1} max={100000} unit="個" />
          <Formula>
            符号なしのビット数 ＝ 2のn乗 ≧ 最大個数 ＋ 1（0も数えるため）を満たす最小のn　／　符号ありは、そこに符号ビット1つを足す
          </Formula>
          <Steps
            items={[
              { label: "① 表したい値の個数", value: `${fmt(counterMax + 1, 0)} 通り`, note: `0個から${fmt(counterMax, 0)}個までなので、最大個数に1を足す` },
              {
                label: "② その数以上になる2のn乗をさがす",
                value: `2の${Math.ceil(Math.log2(counterMax + 1))}乗 ＝ ${fmt(2 ** Math.ceil(Math.log2(counterMax + 1)), 0)}`,
                note: "これが符号なしのビット数"
              },
              {
                label: "③ 返品でマイナスも出るなら、符号ビットを1つ足す",
                value: `${Math.ceil(Math.log2(counterMax + 1))} ＋ 1 ＝ ${Math.ceil(Math.log2(counterMax + 1)) + 1} bit`,
                note: "いちばん左のけたを正負の区別に使うため"
              },
              {
                label: "④ 8ビットと比べる",
                value: `符号なし ${fmt(255, 0)} ／ 符号あり ${fmt(127, 0)} まで`,
                note: counterMax > 255 ? "どちらも足りない" : counterMax > 127 ? "符号なしなら足りる" : "どちらでも足りる"
              }
            ]}
          />
          <Results
            items={[
              { label: "必要な最小ビット数（符号なし）", value: `${Math.ceil(Math.log2(counterMax + 1))} bit`, note: "手順②。0〜最大個数を表せる最小のビット数" },
              { label: "必要な最小ビット数（符号あり）", value: `${Math.ceil(Math.log2(counterMax + 1)) + 1} bit`, note: "手順③。符号ビット1つ分だけ増える" },
              { label: "8ビット符号なしで足りるか", value: counterMax <= 255 ? "足りる" : "不足", warn: counterMax > 255, note: "8 bit 符号なしの上限は 255" },
              { label: "8ビット符号ありで足りるか", value: counterMax <= 127 ? "足りる" : "不足", warn: counterMax > 127, note: "8 bit 符号ありの上限は 127" }
            ]}
          />
          <AreaField
            label="採用する設計と、範囲外になったときの対応"
            value={missionNote}
            onChange={onMissionNote}
            placeholder="例：返品でマイナスが出るので符号あり。1日最大300個なら16ビット符号ありを採用し、範囲外はエラー表示にして記録を残す。"
            rows={4}
          />
        </>
      )}
    </>
  );
}

/* ========================================================================
 * D3 実数（浮動小数点）
 * ====================================================================== */
export function RealLab({ card, missionNote, onMissionNote }: LabProps) {
  const [times, setTimes] = useState(100);
  const [addend, setAddend] = useState(0.1);
  const [value, setValue] = useState(-10.25);
  const [amounts, setAmounts] = useState("120.8, 80.1, 35.1");

  /* --- 実験1: 0.1 を何回も足す --- */
  const naiveTotal = useMemo(() => {
    let total = 0;
    for (let i = 0; i < times; i++) total += addend;
    return total;
  }, [times, addend]);
  const trueTotal = Math.round(addend * times * 1e10) / 1e10;
  const drift = naiveTotal - trueTotal;
  const trace = useMemo(() => {
    const marks: { at: number; sum: number }[] = [];
    let total = 0;
    for (let i = 1; i <= times; i++) {
      total += addend;
      if (i <= 4 || i === times || i === Math.round(times / 2)) marks.push({ at: i, sum: total });
    }
    return marks;
  }, [times, addend]);

  /* --- 実験2以降 --- */
  const normalized = normalizeBinary(value);
  const float32 = toFloat32(value);
  const valueRows = fractionSteps(value, 10);
  const values = parseNumbers(amounts);
  const naive = values.reduce((a, b) => a + b, 0);
  const integerSum = values.reduce((a, b) => a + Math.round(b * 10), 0) / 10;

  return (
    <>
      {card(
        0,
        "0.1 を100回足すと、10になるか",
        "電卓なら当たり前の計算を、コンピュータにやらせてみます。",
        <>
          <Row>
            <NumberField label="足す数" value={addend} onChange={setAddend} step={0.1} min={0.01} max={10} />
            <NumberField label="足す回数" value={times} onChange={(v) => setTimes(clamp(Math.round(v), 1, 10000))} min={1} max={10000} unit="回" />
          </Row>
          <div className="code-block">
            <code>
              {addend} を {times} 回たすと … {naiveTotal}
            </code>
          </div>
          <Formula>
            正しい答え ＝ 足す数 × 足す回数　／　コンピュータの答え ＝ 足す数を1回ずつ加え続けた合計
          </Formula>
          <Steps
            items={[
              { label: "① かけ算で求めた正しい答え", value: `${addend} × ${times} ＝ ${trueTotal}` },
              { label: "② 1回ずつ足していく", value: trace.length ? String(trace[0].sum) : String(addend), note: "1回目の合計" },
              { label: `③ ${times} 回足し終えたときの合計`, value: String(naiveTotal), note: "コンピュータが出した答え" },
              { label: "④ ①と③の差", value: drift === 0 ? "0（ぴったり）" : drift.toExponential(3), note: drift === 0 ? "ずれは出なかった" : "1回ごとの小さなずれが積み上がった分" }
            ]}
          />
          <Results
            items={[
              { label: "正しい答え", value: trueTotal, note: "手順①。かけ算で求めた、ずれのない値" },
              { label: "コンピュータの答え", value: String(naiveTotal), warn: drift !== 0, note: "手順③。1回ずつ足し続けた合計" },
              { label: "ずれ", value: drift === 0 ? "0（ぴったり）" : drift.toExponential(3), warn: drift !== 0, note: "手順④。コンピュータの答えから正しい答えを引いた差" },
              { label: "ぴったり合ったか", value: naiveTotal === trueTotal ? "合った" : "合わなかった", warn: naiveTotal !== trueTotal, note: "ずれが0かどうかで判定した" }
            ]}
          />
          <DataTable
            head={["何回目", "そのときの合計"]}
            rows={trace.map((m) => [`${m.at} 回目`, <span key={m.at} className="mono">{m.sum}</span>])}
          />
          <Hint>
            0.5 や 0.25 を足すとぴったり合うのに、0.1 や 0.3 だとずれます。この違いはどこから来るのでしょうか。
            次の実験で、その正体をさぐります。
          </Hint>
        </>
      )}

      {card(
        1,
        "小数を2進数に直して、正体をさぐる",
        "さっきの数を2進数にすると、けたが終わらないことが分かります。",
        <>
          <NumberField label="10進数(10)（小数可・負も可）" value={value} onChange={setValue} step={0.25} />
          <div className="preset-row">
            {[0.5, 0.25, 0.375, 0.1, 0.3, -10.25].map((v) => (
              <button type="button" key={v} onClick={() => setValue(v)}>
                {v}
              </button>
            ))}
          </div>
          <Formula>
            小数部の2進数 ＝ 小数部に2をかけ、出てきた整数部（0か1）を上から順に並べたもの（小数部が0になるまでくり返す）
          </Formula>
          <DataTable
            head={["小数点以下 何けた目", "小数部 × 2", "整数部＝このけた", "残る小数部"]}
            rows={valueRows.map((r, i) => [
              `${i + 1} けた目`,
              `${fmt(r.before, 10)} × 2 ＝ ${fmt(r.doubled, 10)}`,
              <b key={i} className="hot">{r.digit}</b>,
              fmt(r.after, 10)
            ])}
          />
          <Steps
            items={[
              { label: "① 符号を外して絶対値にする", value: fmt(Math.abs(value), 6), note: value < 0 ? "マイナスはあとで戻す" : "もともと正の数" },
              { label: "② 整数部を2で割り続けて2進数にする", value: <span className="mono">{Math.floor(Math.abs(value)).toString(2)}</span> },
              {
                label: "③ 小数部に2をかけ、整数部を上から拾う",
                value: <span className="mono">{valueRows.map((r) => r.digit).join("") || "0"}</span>,
                note: valueRows.length >= 10 ? "10けた目までを表示（この先も続く）" : "小数部が0になったので、ここで終わり"
              },
              { label: "④ ②と③を小数点でつなぐ", value: <span className="mono">{toBase(value, 2, 20)}</span>, note: "20けたで打ち切って表示" }
            ]}
          />
          <Results
            items={[
              { label: "2進数(2)", value: <span className="mono">{toBase(value, 2, 20)}</span>, note: "手順④。けたの重みは 1, 1/2, 1/4, 1/8 …" },
              { label: "16進数(16)", value: <span className="mono">{toBase(value, 16, 8)}</span>, note: "同じ値を、2進数4けたずつまとめて書き直したもの" },
              { label: "けたが終わるか", value: toBase(Math.abs(value), 2, 30).length < 24 ? "終わる" : "終わらない（循環する）", warn: toBase(Math.abs(value), 2, 30).length >= 24, note: "手順③で小数部が0になれば終わる、ならなければ終わらない" },
              { label: "小数部の重み", value: "1/2, 1/4, 1/8, 1/16 …", note: "この重みの足し算で表せない小数は、必ず誤差を含む" }
            ]}
          />
          <Hint>
            0.5＝1/2、0.25＝1/4、0.375＝1/4+1/8 は、2の負のべき乗の足し算でぴったり表せます。
            ところが0.1は、いくらけたを増やしても表しきれません。どこかで打ち切るしかないので、必ず誤差が残ります。
          </Hint>
        </>
      )}


      {card(
        2,
        "小数点をそろえてから、32ビットの浮動小数点に分解する",
        "まず 1.◯◯◯ × 2の◯乗 の形にそろえ（正規化）、そのうえで符号部1・指数部8・仮数部23 に並べます。",
        <>
          <Formula>
            {value} ＝ {normalized.negative ? "−" : "＋"} {normalized.mantissa} × 2<sup>{normalized.exponent}</sup>
          </Formula>
          <Steps
            items={[
              { label: "① 2進数(2)に直す", value: <span className="mono">{normalized.binary}</span> },
              { label: "② 符号を切り離す", value: normalized.negative ? "− (1)" : "＋ (0)" },
              { label: "③ 1.◯◯◯ の形にそろえる（仮数）", value: <span className="mono">{normalized.mantissa}</span>, note: "小数点が左に動けば指数は正、右に動けば負" },
              { label: "④ 動かしたけた数が指数", value: `2 の ${normalized.exponent} 乗` }
            ]}
          />
          <div className="float-bits">
            <div className="sign">
              <small>符号部 1bit</small>
              <b className="mono">{float32.sign}</b>
            </div>
            <div className="exponent">
              <small>指数部 8bit</small>
              <b className="mono">{float32.exponent}</b>
            </div>
            <div className="mantissa">
              <small>仮数部 23bit</small>
              <b className="mono">{float32.mantissa}</b>
            </div>
          </div>
          <Formula>
            32ビット ＝ 符号部1ビット ＋ 指数部8ビット ＋ 仮数部23ビット　／　指数部に入れる値 ＝ 実際の指数 ＋ 127（バイアス）
          </Formula>
          <Steps
            items={[
              { label: "⑤ 32けたの並びを取り出す", value: <span className="mono">{float32.bits.slice(0, 12)}…</span>, note: "先頭12けたのみ表示" },
              { label: "⑥ 左から1けた目を切り出す（符号部）", value: <span className="mono">{float32.sign}</span>, note: float32.sign === "1" ? "1 なので負の数" : "0 なので正の数" },
              { label: "⑦ 次の8けたを切り出す（指数部）", value: <span className="mono">{float32.exponent}</span>, note: `10進で読むと ${float32.exponentValue}` },
              { label: "⑧ 127を引いて実際の指数に戻す", value: `${float32.exponentValue} − 127 ＝ ${float32.realExponent}` },
              { label: "⑨ 残り23けたを切り出す（仮数部）", value: <span className="mono">{float32.mantissa.slice(0, 12)}…</span>, note: "1.◯◯◯ の小数点より右だけを左詰めで入れてある" },
              { label: "⑩ 組み立て直した値", value: fmt(float32.stored, 10), note: "仮数部が23けたで打ち切られた分だけ、元の値とずれる" }
            ]}
          />
          <Results
            items={[
              { label: "指数部に入っている値", value: float32.exponentValue, note: "手順⑦。実際の指数に127を足した値" },
              { label: "実際の指数", value: float32.realExponent, note: "手順⑧。指数部から127を引いて戻した値" },
              { label: "実際に保存された値", value: fmt(float32.stored, 10), note: "手順⑩。この32ビットが表している値" },
              { label: "元の値とのずれ", value: fmt(float32.error, 12), warn: float32.error !== 0, note: "保存された値から元の値を引いた差。仮数部の打ち切りで生じる" }
            ]}
          />
          <HintButton id="real-2-2">
            指数部にはバイアス127を足した値が入ります。指数が3なら 3 + 127 = 130 を2進数で格納します。
            指数がマイナスになることもあるので、127を足してからしまうことで、必ず0以上の数にしています。
          </HintButton>
          <HintButton id="real-2-1">
            指数はマイナスになることもあります。そのままだとマイナスをしまう場所がもう1つ必要になるので、あらかじめ127を足して、必ず0以上の数にしてからしまいます。海面より低い土地の標高を「マイナス3m」と書くかわりに、全部に100を足して「97m」と書くようなものです。この127をバイアスといいます。
          </HintButton>
        </>
      )}

      {card(
        3,
        "整数に直して誤差を消す",
        "金額を小数のまま足す場合と、円単位の整数で足す場合を比べます。",
        <>
          <TextField label="金額を並べて入力" value={amounts} onChange={setAmounts} hint="カンマまたはスペースで区切る" />
          <Formula>
            整数にして合計 ＝ 各金額を10倍して整数に直し、整数どうしで足してから、最後に10で割って表示に戻す
          </Formula>
          <Steps
            items={[
              { label: "① 小数のまま順に足す", value: String(naive), note: "1件足すごとに、表しきれない分の誤差が残る" },
              { label: "② 各金額を10倍して整数にする", value: values.map((v) => fmt(Math.round(v * 10), 0)).join(" ＋ ") || "-", note: "0.1円の位まで整数で持つ" },
              { label: "③ 整数どうしで足す", value: fmt(values.reduce((a, b) => a + Math.round(b * 10), 0), 0), note: "整数の足し算に誤差は出ない" },
              { label: "④ 10で割って表示に戻す", value: String(integerSum) },
              { label: "⑤ ①と④の差", value: naive === integerSum ? "0（ぴったり）" : Math.abs(naive - integerSum).toExponential(2) }
            ]}
          />
          <Results
            items={[
              { label: "そのまま合計", value: String(naive), note: "手順①。小数のまま足した合計" },
              { label: "10倍の整数にして合計", value: String(integerSum), note: "手順④。整数で足してから戻した合計" },
              { label: "ずれ", value: naive === integerSum ? "0（ぴったり）" : Math.abs(naive - integerSum).toExponential(2), warn: naive !== integerSum, note: "手順⑤。2つの合計の差。件数が増えるほど積み上がる" },
              { label: "件数", value: `${values.length} 件`, note: "足し算の回数。ずれが積み上がる回数でもある" }
            ]}
          />
          <Hint>
            件数を増やすほど、ずれは積み上がります。金額は円単位の整数で持ち、表示するときだけ小数に戻す、これがよく使われるやり方です。
          </Hint>
        </>
      )}

      {card(
        4,
        "購買部の会計プログラムを安全にする",
        "計算したずれを根拠に、どちらの方式を採用するかを決めます。",
        <AreaField
          label="採用する方式と、その根拠"
          value={missionNote}
          onChange={onMissionNote}
          placeholder="例：0.1を100回足すと 9.99999999999998 になり、正しい10にならなかった。3件の合計でも約1.4×10⁻¹⁴のずれが出る。1日1,000件では表示に影響しうるため、円単位の整数で保持する方式を採用する。"
          rows={4}
        />
      )}
    </>
  );
}

/* ========================================================================
 * D4 論理回路
 * ====================================================================== */
export function LogicLab({ card, missionNote, onMissionNote }: LabProps) {
  const [gate, setGate] = useState<Gate>("AND");
  const [gateView, setGateView] = useState("switch");
  const [adderTab, setAdderTab] = useState("half");
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [card1, setCard1] = useState(true);
  const [pin, setPin] = useState(true);
  const [guest, setGuest] = useState(false);
  const [hx, setHx] = useState(true);
  const [hy, setHy] = useState(true);
  const [fx, setFx] = useState(true);
  const [fy, setFy] = useState(true);
  const [fc, setFc] = useState(true);
  const [ra, setRa] = useState("0111");
  const [rb, setRb] = useState("0101");

  const gates: Gate[] = ["NOT", "AND", "OR", "NAND", "NOR", "XOR", "XNOR"];
  /** 電気回路で見るとき、どのつなぎ方がどのゲートに当たるか */
  const wirings: { gate: Gate; kind: WiringKind; wiring: string }[] = [
    { gate: "NOT", kind: "single-not", wiring: "ランプと並列" },
    { gate: "AND", kind: "series", wiring: "直列" },
    { gate: "OR", kind: "parallel", wiring: "並列" },
    { gate: "NAND", kind: "series-not", wiring: "直列＋反転" },
    { gate: "NOR", kind: "parallel-not", wiring: "並列＋反転" },
    { gate: "XOR", kind: "cross", wiring: "三路（階段）" },
    { gate: "XNOR", kind: "cross-not", wiring: "三路＋反転" }
  ];
  const half = halfAdder(hx, hy);
  const full = fullAdder(fx, fy, fc);
  const ripple = rippleAdder(ra, rb, 4);
  const access = card1 && pin;
  const entry = card1 || guest;

  return (
    <>
      {card(
        0,
        "7種類のゲートを、スイッチ・真理値表・電気回路の3つの見方で確かめる",
        "同じ入力を使ったまま見方だけを切り替えて、ゲートの働きを3通りの角度からとらえます。",
        <>
          <Tabs value={gate} onChange={(v) => setGate(v as Gate)} options={gates.map((g) => ({ value: g, label: g }))} />
          <div className="switches">
            <Toggle label="入力 A" on={a} onChange={setA} />
            <Toggle label="入力 B" on={b} onChange={setB} />
          </div>
          <Tabs
            value={gateView}
            onChange={setGateView}
            options={[
              { value: "switch", label: "スイッチで試す" },
              { value: "table", label: "真理値表で一覧する" },
              { value: "circuit", label: "電気回路で見る" }
            ]}
          />
          {gateView === "switch" && (
            <>
              <div className="gate-stage">
                <div className={`lamp ${gateOutput(gate, a, b) ? "on" : ""}`}>
                  <span>出力 F</span>
                  <b>{Number(gateOutput(gate, a, b))}</b>
                </div>
              </div>
              <Formula>{gateFormula[gate]}</Formula>
              {gate === "NOT" && <Hint>NOTは入力Aだけを使います。入力Bを動かしても出力は変わりません。</Hint>}
            </>
          )}
          {gateView === "table" && (
            <>
              <DataTable
                head={["A", "B", ...gates]}
                rows={[
                  [false, false],
                  [false, true],
                  [true, false],
                  [true, true]
                ].map(([x, y]) => [
                  Number(x),
                  Number(y),
                  ...gates.map((g) => <b key={g} className={gateOutput(g, x, y) ? "hot" : ""}>{Number(gateOutput(g, x, y))}</b>)
                ])}
                highlight={(index) => index === Number(a) * 2 + Number(b)}
              />
              <Hint>出力の並びを見れば、どのゲートかを言い当てられます。ANDとNANDのように、上下が反転している組み合わせを探してみましょう。</Hint>
            </>
          )}
          {gateView === "circuit" && (
            <>
              <div className="circuit-row">
                {wirings.map((w) => {
                  const lit = gateOutput(w.gate, a, b);
                  return (
                    <div className={`circuit-mini ${lit ? "on" : ""} ${w.gate === gate ? "picked" : ""}`} key={w.gate}>
                      <span>{w.gate}</span>
                      <MiniCircuit kind={w.kind} a={a} b={b} on={lit} />
                      <em>{w.wiring}</em>
                      <b>{lit ? "点灯" : "消灯"}</b>
                    </div>
                  );
                })}
              </div>
              <Hint>
                上のスイッチAとBを動かすと、7つの回路が同時に変わります。ANDは直列つなぎ、ORは並列つなぎ。
                NANDとNORはその出口に反転（NOT）を足したもの、XORは階段の照明と同じ三路スイッチのつなぎ方です。
                NOTはランプと並列にスイッチを入れ、閉じると電気がランプを素通りするので消えます。
              </Hint>
            </>
          )}
          <HintButton id="logic-0-1">
            ゲートは「入ってきた0と1を見て、出す0と1を決める部品」です。7種類あっても、覚えるのは「どんなときに1を出すか」だけ。自動ドアが「人がいるとき開く」と決まっているように、それぞれのゲートにも1を出す条件が1つずつ決まっています。
          </HintButton>
        </>
      )}

      {card(
        1,
        "日常のルールを論理式に直す",
        "入退室のルールを、AND・OR・NOTの組み合わせで表します。",
        <>
          <div className="switches">
            <Toggle label="社員証" on={card1} onChange={setCard1} />
            <Toggle label="暗証番号一致" on={pin} onChange={setPin} />
            <Toggle label="招待状" on={guest} onChange={setGuest} />
          </div>
          <Formula>入室 ＝ 社員証 AND 暗証番号　／　入場 ＝ 社員証 OR 招待状　／　警報 ＝ NOT 入室</Formula>
          <Steps
            items={[
              { label: "① スイッチの状態を0と1で書く", value: `社員証 ${Number(card1)} ／ 暗証番号 ${Number(pin)} ／ 招待状 ${Number(guest)}` },
              { label: "② 入室：どちらも1のときだけ1（AND）", value: `${Number(card1)} AND ${Number(pin)} ＝ ${Number(access)}` },
              { label: "③ 入場：どちらか1なら1（OR）", value: `${Number(card1)} OR ${Number(guest)} ＝ ${Number(entry)}` },
              { label: "④ 警報：入室を反転する（NOT）", value: `NOT ${Number(access)} ＝ ${Number(!access)}` }
            ]}
          />
          <Results
            items={[
              { label: "入室（社員証 AND 暗証番号）", value: access ? "許可" : "拒否", warn: !access, note: `手順②の出力が ${Number(access)} だから` },
              { label: "入場（社員証 OR 招待状）", value: entry ? "許可" : "拒否", warn: !entry, note: `手順③の出力が ${Number(entry)} だから` },
              { label: "警報（NOT 入室）", value: !access ? "鳴る" : "鳴らない", note: `手順④の出力が ${Number(!access)} だから` },
              { label: "入室の式", value: <span className="mono">入室 = 社員証 AND 暗証番号</span>, note: "「かつ」で結ばれた条件はANDになる" },
              { label: "入場の式", value: <span className="mono">入場 = 社員証 OR 招待状</span>, note: "「または」で結ばれた条件はORになる" }
            ]}
          />
          <Hint>「かつ」はAND、「または」はOR、「〜でない」はNOT。日常のルールは、この3つでほぼ書き表せます。</Hint>
        </>
      )}

      {card(
        2,
        "半加算器と全加算器を組み立てて、ちがいを見る",
        "回路図の線の0と1は、入力A・B・Ciのボタンを押すとその場で変わります。XORが和、ANDがくり上がりになることを確かめましょう。",
        <>
          <Tabs
            value={adderTab}
            onChange={setAdderTab}
            options={[
              { value: "half", label: "半加算器（2つを足す）" },
              { value: "full", label: "全加算器（3つを足す）" }
            ]}
          />
          {adderTab === "half" ? (
            <>
              <div className="switches">
                <Toggle label="入力 A" on={hx} onChange={setHx} />
                <Toggle label="入力 B" on={hy} onChange={setHy} />
              </div>
              <HalfAdderDiagram a={hx} b={hy} s={half.s} c={half.c} />
              <div className="adder-view">
                <div><small>XOR → 和 S</small><b>{Number(half.s)}</b></div>
                <div><small>AND → くり上がり C</small><b>{Number(half.c)}</b></div>
              </div>
              <Formula>
                {Number(hx)} + {Number(hy)} = {Number(half.c)}{Number(half.s)} （2進数）＝ {Number(hx) + Number(hy)}（10進数）
              </Formula>
              <DataTable
                head={["A", "B", "S（和）", "C（くり上がり）"]}
                rows={[[0, 0], [0, 1], [1, 0], [1, 1]].map(([x, y]) => {
                  const r = halfAdder(!!x, !!y);
                  return [x, y, Number(r.s), Number(r.c)];
                })}
                highlight={(index) => index === Number(hx) * 2 + Number(hy)}
              />
            </>
          ) : (
            <>
              <div className="switches">
                <Toggle label="入力 A" on={fx} onChange={setFx} />
                <Toggle label="入力 B" on={fy} onChange={setFy} />
                <Toggle label="下のけたから来たくり上がり（Ci）" on={fc} onChange={setFc} />
              </div>
              <FullAdderDiagram
                a={fx}
                b={fy}
                ci={fc}
                s1={full.inner.first.s}
                c1={full.inner.first.c}
                s={full.s}
                c2={full.inner.second.c}
                co={full.co}
              />
              <div className="adder-view">
                <div><small>1つ目の半加算器 S</small><b>{Number(full.inner.first.s)}</b></div>
                <div><small>2つ目の半加算器 S → 和</small><b>{Number(full.s)}</b></div>
                <div><small>2つのCをOR → Co</small><b>{Number(full.co)}</b></div>
              </div>
              <Formula>
                {Number(fx)} + {Number(fy)} + {Number(fc)} = {Number(full.co)}{Number(full.s)}（2進数）＝ {Number(fx) + Number(fy) + Number(fc)}
              </Formula>
            </>
          )}
          <HintButton id="logic-2-1">
            1＋1は2ですが、2進数では「10」になります。つまり答えが2けたになるので、出口も2つ必要です。1の位が和S、上にくり上がる分がくり上がりCです。そろばんで珠が足りなくなったら上の位に1つ動かすのと、同じことをしています。全加算器は、右のけたから来たくり上がりを受け取る入り口をもう1つ持っている点だけがちがいます。
          </HintButton>
        </>
      )}

      {card(
        3,
        "全加算器を並べて4ビットを足す",
        "回路図で、くり上がりが右のけたから左のけたへ順番に受け渡されていく様子を追います。値を変えると図も変わります。",
        <>
          <Row>
            <TextField label="4ビットの値 A" value={ra} onChange={setRa} mono />
            <TextField label="4ビットの値 B" value={rb} onChange={setRb} mono />
          </Row>
          <Formula>
            各けたの全加算器：A ＋ B ＋ Ci（下のけたから受け取る） ＝ S（和） ＋ Co（上のけたへ送る）×2　／　あるけたのCoが、そのまま次のけたのCiになる
          </Formula>
          <RippleDiagram stages={ripple.stages} carryOut={ripple.carryOut} />
          <DataTable
            head={["けた", "A", "B", "Ci（下のけたから受け取る）", "S（和）", "Co（上のけたへ送る）"]}
            rows={ripple.stages.map((stage, index) => [4 - index, stage.x, stage.y, stage.ci, stage.s, stage.co])}
          />
          <Steps
            items={ripple.stages
              .slice()
              .reverse()
              .map((stage, k) => ({
                label: `${k === 0 ? "①" : k === 1 ? "②" : k === 2 ? "③" : "④"} ${k + 1}けた目：${stage.x} ＋ ${stage.y} ＋ 下から来た ${stage.ci}`,
                value: `和 ${stage.s} ／ 上へ送る ${stage.co}`,
                note: k === 3 ? (ripple.carryOut ? "このくり上がりは5けた目になるので、4ビットには入らない" : "上へ送るくり上がりは出なかった") : `この ${stage.co} が、次のけたのCiになる`
              }))}
          />
          <Results
            items={[
              { label: "計算結果", value: <span className="mono">{ripple.sum}</span>, note: "各けたのS（和）を、左から順に並べたもの" },
              { label: "10進で確認", value: `${parseInt(ripple.x, 2)} + ${parseInt(ripple.y, 2)} = ${parseInt(ripple.x, 2) + parseInt(ripple.y, 2)}`, note: "けたの重みを足して、2進数の答えと突き合わせる" },
              { label: "最上位のくり上がり", value: ripple.carryOut ? "あり（オーバーフロー）" : "なし", warn: ripple.carryOut, note: "4けた目のCo。1なら4ビットに収まっていない" }
            ]}
          />
          <Hint>くり上がりは右のけたから順に伝わります。1けた目のCoが2けた目のCiになる、という受け渡しが端まで続くので、けたが増えるほど伝わる時間が長くなるのが、この方式の弱点です。</Hint>
        </>
      )}

      {card(
        4,
        "NANDゲートだけで、ほかのゲートを作る",
        "NANDを組み合わせるだけで、すべてのゲートと同じ働きが作れることを確かめます。",
        <>
          <Tabs value={gate} onChange={(v) => setGate(v as Gate)} options={gates.map((g) => ({ value: g, label: g }))} />
          <div className="switches">
            <Toggle label="入力 A" on={a} onChange={setA} />
            {gate !== "NOT" && <Toggle label="入力 B" on={b} onChange={setB} />}
          </div>
          <div className="nand-recipe">
            {nandRecipe[gate].steps.map((line, i) => (
              <div key={line}>
                <i>{i + 1}</i>
                {line}
              </div>
            ))}
          </div>
          <Formula>
            必要なNANDの数 ＝ 上の組み立て手順で、NANDを1つ使うごとに1個ずつ数えた合計
          </Formula>
          <Steps
            items={[
              ...nandRecipe[gate].steps.map((line, i) => ({
                label: `${i + 1} 手目`,
                value: line
              })),
              { label: "合計した手数", value: `${nandRecipe[gate].count} 個`, note: "この個数だけNANDを並べれば同じ働きになる" },
              {
                label: "同じ入力で出力を見くらべる",
                value: `${gate} ${Number(gateOutput(gate, a, b))} ／ NANDだけ ${Number(nandOnly(gate, a, b))}`,
                note: gateOutput(gate, a, b) === nandOnly(gate, a, b) ? "一致した" : "一致しない"
              }
            ]}
          />
          <Results
            items={[
              { label: `${gate} の出力`, value: Number(gateOutput(gate, a, b)), note: "もとのゲートに、今のA・Bを入れたときの出力" },
              { label: "NANDだけで作った回路の出力", value: Number(nandOnly(gate, a, b)), note: "上の手順どおりNANDを並べたときの出力" },
              { label: "一致しているか", value: gateOutput(gate, a, b) === nandOnly(gate, a, b) ? "一致" : "不一致", warn: gateOutput(gate, a, b) !== nandOnly(gate, a, b), note: "2つの出力を突き合わせた結果。下の表の4通りすべてで確かめられる" },
              { label: "必要なNANDの数", value: `${nandRecipe[gate].count} 個`, note: "手順の数がそのまま部品の数になる" }
            ]}
          />
          <DataTable
            head={["A", "B", `${gate} の出力`, "NANDだけの回路"]}
            rows={[
              [false, false],
              [false, true],
              [true, false],
              [true, true]
            ].map(([x, y]) => [
              Number(x),
              Number(y),
              Number(gateOutput(gate, x, y)),
              <b key={`${x}${y}`} className={gateOutput(gate, x, y) === nandOnly(gate, x, y) ? "" : "hot"}>
                {Number(nandOnly(gate, x, y))}
              </b>
            ])}
          />
          <Hint>
            NANDだけですべてのゲートが作れるため、実際の電子部品ではNANDが多く使われます。
            1種類の部品だけで済むうえ、製作コストも安くなるからです。
          </Hint>
        </>
      )}

      {card(
        5,
        "階段の照明回路を設計する",
        "2か所のスイッチのどちらを操作しても切り替わる回路を選びます。",
        <>
          <div className="switches">
            <Toggle label="1階のスイッチ" on={a} onChange={setA} />
            <Toggle label="2階のスイッチ" on={b} onChange={setB} />
          </div>
          <Results
            items={[
              { label: "AND なら", value: a && b ? "点灯" : "消灯", note: "1階だけを切り替えても、2階が0のままなら消灯から動かない" },
              { label: "OR なら", value: a || b ? "点灯" : "消灯", note: "片方が1の間は、もう片方を切り替えても点灯のまま" },
              { label: "XOR なら", value: a !== b ? "点灯" : "消灯", note: "どちらか一方を切り替えるたびに、必ず反対の状態になる" },
              { label: "求める動作", value: "どちらか一方を操作したら切り替わる", note: "この動きになるゲートを4通りすべてで探す" }
            ]}
          />
          <DataTable
            head={["1階", "2階", "AND", "OR", "XOR"]}
            rows={[
              [false, false],
              [false, true],
              [true, false],
              [true, true]
            ].map(([x, y]) => [Number(x), Number(y), Number(x && y), Number(x || y), <b key={`${x}${y}`} className="hot">{Number(x !== y)}</b>])}
            highlight={(index) => index === Number(a) * 2 + Number(b)}
          />
          <Verdict ok>
            見るところは「片方のスイッチだけを切り替えたとき、出力が必ず反転するか」です。表を上下に1行ずつ動かすと、XORの列だけが毎回0と1を入れかわります。だから階段の照明にはXORを選びます。
          </Verdict>
          <AreaField
            label="選んだゲートと、その根拠"
            value={missionNote}
            onChange={onMissionNote}
            placeholder="例：XORを選ぶ。4通りすべてで、どちらか一方だけを切り替えると出力が必ず反転するため、階段のどちらからでも操作できる。"
            rows={4}
          />
        </>
      )}
    </>
  );
}

/* ========================================================================
 * D5 コンピュータの構成
 * ====================================================================== */
export function ComputerLab({ card, missionNote, onMissionNote }: LabProps) {
  const [left, setLeft] = useState(5);
  const [right, setRight] = useState(3);
  const [op, setOp] = useState("+");
  const [flowStep, setFlowStep] = useState(0);
  const [device, setDevice] = useState("キーボード");
  const [step, setStep] = useState(0);
  const [clock, setClock] = useState(1.6);
  const [cycles, setCycles] = useState(4);
  const [hitRate, setHitRate] = useState(90);
  const [cacheNs, setCacheNs] = useState(2);
  const [mainNs, setMainNs] = useState(60);
  const [osTopic, setOsTopic] = useState("task");

  /* --- 実験1: 「5+3」が「8」になるまで --- */
  const answer =
    op === "+" ? left + right : op === "−" ? left - right : op === "×" ? left * right : right === 0 ? NaN : left / right;
  const expr = `${left} ${op} ${right}`;
  const flow: { from: string; to: string; kind: "データ" | "制御"; what: string; detail: string }[] = [
    {
      from: "入力装置",
      to: "記憶装置",
      kind: "データ",
      what: `${expr}`,
      detail: `キーボードで打った「${expr}」が、そのまま主記憶に読み込まれます。まだ計算はしていません。`
    },
    {
      from: "制御装置",
      to: "演算装置",
      kind: "制御",
      what: `${op === "+" ? "加算せよ" : op === "−" ? "減算せよ" : op === "×" ? "乗算せよ" : "除算せよ"}`,
      detail: "制御装置が主記憶から命令を読み取り、演算装置に「何をするか」を指示します。数そのものは流れません。"
    },
    {
      from: "記憶装置",
      to: "演算装置",
      kind: "データ",
      what: `${left} と ${right}`,
      detail: "計算に使う2つの数が、主記憶から演算装置へ送られます。"
    },
    {
      from: "演算装置",
      to: "記憶装置",
      kind: "データ",
      what: `${Number.isFinite(answer) ? answer : "エラー"}`,
      detail: "演算装置が計算し、その結果を主記憶に書き戻します。"
    },
    {
      from: "記憶装置",
      to: "出力装置",
      kind: "データ",
      what: `${Number.isFinite(answer) ? answer : "エラー"}`,
      detail: "主記憶から結果が読み出され、ディスプレイに表示されます。ここでようやく人が答えを見られます。"
    }
  ];
  const now = flow[flowStep];
  const lit = (name: string) => (now.from === name || now.to === name ? (now.from === name ? "from" : "to") : "");

  /* --- 実験2: 五大装置 --- */
  const deviceMap: Record<string, [string, string]> = {
    キーボード: ["入力装置", "人の操作をデータに変えて、コンピュータへ送りこみます。"],
    ディスプレイ: ["出力装置", "処理した結果を、人が読める形で表示します。"],
    メインメモリ: ["記憶装置（主記憶）", "実行中の命令とデータを置きます。CPUと直接やり取りするので高速ですが、容量は小さめです。"],
    SSD: ["記憶装置（補助記憶）", "電源を切っても残る保存場所です。容量は大きいですが、主記憶より遅くなります。"],
    演算装置: ["演算装置", "計算や比較を行います。制御装置と合わせてCPUと呼びます。"],
    制御装置: ["制御装置", "他の4つの装置に制御信号を送り、全体の動きをそろえます。"],
    ルータ: ["五大装置ではありません", "通信装置は五大装置に入りません。入力・出力・記憶・演算・制御の5つです。"]
  };

  /* --- 実験3: 命令サイクル --- */
  const cycle: [string, string][] = [
    ["取出し（フェッチ）", "プログラムカウンタが指す番地から、命令を命令レジスタへ読み込みます。"],
    ["解読（デコード）", "デコーダが命令の種類と、必要なデータの場所を判断します。"],
    ["実行（エグゼキュート）", "演算装置が計算し、結果をレジスタや主記憶へ書き戻します。"],
    ["次へ進む", "プログラムカウンタが次の命令の番地を指し、また取出しに戻ります。"]
  ];

  /* --- 実験4: CPUの性能 --- */
  const perSecond = toMips(clock, cycles) * 1e6;
  const perInstructionNs = instructionTimeNs(clock, cycles);

  /* --- 実験5: 記憶の階層 --- */
  const effective = effectiveAccess(hitRate / 100, cacheNs, mainNs);

  /* --- 実験6: OSのはたらき --- */
  const osTopics: Record<string, [string, string, string]> = {
    task: ["タスク管理", "複数の処理を切り替えながら実行する", "ダウンロードしながら画像編集ができるのは、OSが処理を瞬間的に切り替えているからです。"],
    memory: ["メモリ管理", "主記憶の領域を各処理に割り当てる", "メモリには限りがあるため、どの処理にどれだけ渡すかをOSが決めています。"],
    file: ["ファイル管理", "補助記憶のデータを整理する", "フォルダという入れ物をつくって階層的に管理し、保存・削除・読み書きを担います。"],
    ui: ["ユーザインタフェースの提供", "人が操作するための画面や方法を用意する", "画面上のアイコンを指で触って操作できるのがGUI、文字入力だけで操作するのがCUIです。"],
    driver: ["ハードウェアとの仲介", "デバイスドライバがあいだに入って、機種ごとの違いを気にせず使えるようにする", "機種が違っても同じ操作でプリンタを使えるのは、OSとデバイスドライバが違いを吸収しているからです。"]
  };

  return (
    <>
      {card(
        0,
        "「5＋3」が「8」になるまでを追い、五大装置の役割を確かめる",
        "キーボードを打ってから画面に答えが出るまで、5つの装置の間を何が流れるかを1歩ずつ見て、装置の分類も確かめます。",
        <>
          <Row>
            <NumberField label="左の数" value={left} onChange={setLeft} min={0} max={9999} />
            <SelectField label="計算" value={op} onChange={setOp} options={["+", "−", "×", "÷"].map((v) => ({ value: v, label: v }))} />
            <NumberField label="右の数" value={right} onChange={setRight} min={0} max={9999} />
          </Row>
          <Tabs
            value={String(flowStep)}
            onChange={(v) => setFlowStep(Number(v))}
            options={flow.map((_, i) => ({ value: String(i), label: `${i + 1} ${i === 0 ? "入力→記憶" : i === 1 ? "制御→演算" : i === 2 ? "記憶→演算" : i === 3 ? "演算→記憶" : "記憶→出力"}` }))}
          />
          <div className="machine">
            <div className={`unit control ${lit("制御装置")}`}>
              <small>制御装置</small>
              <b>指示を出す</b>
            </div>
            <div className={`unit input ${lit("入力装置")}`}>
              <small>入力装置</small>
              <b>キーボード</b>
            </div>
            <div className={`unit memory ${lit("記憶装置")}`}>
              <small>記憶装置（主記憶）</small>
              <b>データを置く</b>
            </div>
            <div className={`unit output ${lit("出力装置")}`}>
              <small>出力装置</small>
              <b>ディスプレイ</b>
            </div>
            <div className={`unit alu ${lit("演算装置")}`}>
              <small>演算装置</small>
              <b>計算する</b>
            </div>
          </div>
          <div className={`flow-line ${now.kind === "制御" ? "control" : ""}`}>
            <span>{now.from}</span>
            <i>{now.kind === "制御" ? "制御信号" : "データ"}</i>
            <strong>{now.what}</strong>
            <i>→</i>
            <span>{now.to}</span>
          </div>
          <Results
            items={[
              { label: `手順 ${flowStep + 1} / 5`, value: `${now.from} → ${now.to}`, note: "この手順で、どの装置からどの装置へ渡すか" },
              { label: "流れるもの", value: now.kind, note: now.kind === "制御" ? "数そのものではなく、「何をするか」の指示" : "計算に使う数、または計算の結果" },
              { label: "中身", value: now.what, note: "いま実際に渡されている値や指示" },
              { label: "最終的な答え", value: Number.isFinite(answer) ? answer : "計算できません", warn: !Number.isFinite(answer), note: "手順5まで進んだとき、画面に出る値" }
            ]}
          />
          <Hint>{now.detail}</Hint>
          <SelectField label="装置を選ぶ" value={device} onChange={setDevice} options={Object.keys(deviceMap).map((value) => ({ value, label: value }))} />
          <Results items={[{ label: deviceMap[device][0], value: deviceMap[device][1], warn: deviceMap[device][0].includes("ではありません"), note: "その装置が、五大装置のどれにあたるかと、その仕事" }]} />
          <Verdict ok={!deviceMap[device][0].includes("ではありません")}>
            見分け方は1つ、「その装置は、外から取り込む・外へ出す・置いておく・計算する・指示を出す、のどれをしているか」です。
            {device}は{deviceMap[device][0].includes("ではありません") ? "この5つのどれにもあてはまらないので、五大装置ではありません。" : `${deviceMap[device][0]}にあたります。`}
          </Verdict>
          <div className="five-units">
            {["入力装置", "出力装置", "記憶装置", "演算装置", "制御装置"].map((name) => (
              <span key={name} className={deviceMap[device][0].startsWith(name.slice(0, 2)) ? "active" : ""}>
                {name}
              </span>
            ))}
          </div>
          <Hint>演算装置と制御装置をまとめてCPU（中央処理装置）と呼びます。通信装置は五大装置には含まれません。</Hint>
        </>
      )}

      {card(
        1,
        "CPUの中で命令が回る順番",
        "取出し→解読→実行の1周を、CPUの図の上で順に確かめます。タブを押すと、働いている場所が光ります。",
        <>
          <Tabs value={String(step)} onChange={(v) => setStep(Number(v))} options={cycle.map((s, i) => ({ value: String(i), label: `${i + 1} ${s[0]}` }))} />
          <Results
            items={[
              { label: cycle[step][0], value: cycle[step][1], note: `1周4段階のうちの ${step + 1} 段階目` },
              { label: "この段階で働くもの", value: step === 0 ? "プログラムカウンタ・命令レジスタ" : step === 1 ? "デコーダ" : step === 2 ? "演算装置" : "プログラムカウンタ", note: "下の並びで、色がついている部分" }
            ]}
          />
          <CpuDiagram step={step} address={`${100 + step}`} instruction="ADD 5, 3" />
          <Verdict ok>
            見分け方は「その段階で命令がどこにあるか」です。主記憶から運んでくるのが取出し、中身を読み解くのが解読、実際に計算するのが実行。
            いまは「{cycle[step][0]}」の段階です。上の図で色がついている場所が、その段階で働いている部分です。
          </Verdict>
          <div className="registers">
            <span className={step === 0 ? "active" : ""}>プログラムカウンタ</span>
            <span className={step === 0 ? "active" : ""}>命令レジスタ</span>
            <span className={step === 1 ? "active" : ""}>デコーダ</span>
            <span className={step === 2 ? "active" : ""}>演算装置</span>
          </div>
          <Hint>この1周を1秒間に何億回も繰り返しています。次の実験で、その回数を計算します。</Hint>
        </>
      )}

      {card(
        2,
        "1秒間に何回の命令を実行できるか",
        "クロック周波数と、1命令に必要なクロック数から計算します。",
        <>
          <Row>
            <NumberField label="クロック周波数" value={clock} onChange={setClock} step={0.1} min={0.1} max={6} unit="GHz" />
            <NumberField label="1命令あたりのクロック数" value={cycles} onChange={setCycles} min={1} max={20} unit="クロック" />
          </Row>
          <Formula>1秒間の命令数 ＝ クロック周波数 ÷ 1命令あたりのクロック数</Formula>
          <Steps
            items={[
              { label: "1秒間のクロック数", value: `${fmt(clock, 2)} × 10⁹ 回`, note: `${fmt(clock * 1e9, 0)} 回` },
              { label: `÷ ${cycles} クロック`, value: `${(perSecond / 1e8).toFixed(2)} × 10⁸ 回` },
              { label: "1秒間に実行できる命令数", value: `約 ${fmt(perSecond / 1e8, 1)} 億回` }
            ]}
          />
          <Results
            items={[
              { label: "1命令にかかる時間", value: `${fmt(perInstructionNs, 3)} ns`, note: "1ns＝10億分の1秒" },
              { label: "クロックを2倍にすると", value: `約 ${fmt((clock * 2 * 1e9) / cycles / 1e8, 1)} 億回`, note: "1命令あたりのクロック数はそのままで、周波数だけ2倍にした場合" },
              { label: "クロック数を半分にすると", value: `約 ${fmt((clock * 1e9) / Math.max(1, cycles / 2) / 1e8, 1)} 億回`, note: "周波数はそのままで、1命令あたりのクロック数を半分にした場合" }
            ]}
          />
          <HintButton id="computer-2-1">
            1.6GHzで4クロックなら 1.6×10⁹ ÷ 4 ＝ 4.0×10⁸ で、1秒間に4億回。クロックを上げるか、1命令あたりのクロック数を減らすかの
            2通りで速くできます。
          </HintButton>
        </>
      )}

      {card(
        3,
        "記憶装置の速さと容量を比べる",
        "よく使うデータを手元に置くと、待ち時間がどれだけ縮むかを確かめます。",
        <>
          <DataTable
            head={["記憶装置", "速さ", "容量", "電源を切ると"]}
            rows={[
              ["レジスタ（CPU内）", "最速", "数十バイト", "消える"],
              ["キャッシュメモリ", "非常に速い", "数MB", "消える"],
              ["主記憶（メインメモリ）", "速い", "数GB〜数十GB", "消える"],
              ["補助記憶（SSD・HDD）", "遅い", "数百GB〜数TB", "残る"]
            ]}
          />
          <SliderField label="キャッシュに目当てのデータがあった割合" value={hitRate} onChange={setHitRate} min={0} max={100} unit=" %" />
          <Row>
            <NumberField label="キャッシュの待ち時間" value={cacheNs} onChange={setCacheNs} step={0.5} min={0.5} max={20} unit="ns" />
            <NumberField label="主記憶の待ち時間" value={mainNs} onChange={setMainNs} step={5} min={10} max={300} unit="ns" />
          </Row>
          <Formula>平均の待ち時間 ＝ 見つかった割合 × キャッシュ ＋ 見つからなかった割合 × 主記憶</Formula>
          <Results
            items={[
              { label: "平均の待ち時間", value: `${fmt(effective, 2)} ns`, note: "見つかった割合と見つからなかった割合で重みをつけた合計" },
              { label: "キャッシュなしと比べて", value: `${fmt(mainNs / effective, 2)} 倍速い`, note: "主記憶の待ち時間 ÷ 平均の待ち時間。縮んだ倍率" },
              { label: "割合をあと5%上げると", value: `${fmt(effectiveAccess(Math.min(1, hitRate / 100 + 0.05), cacheNs, mainNs), 2)} ns`, note: "見つかる割合を5%増やして計算し直した待ち時間" }
            ]}
          />
          <HintButton id="computer-3-1">
            よく使うものを手元に置いておくと、取りに行く時間が短くなります。教科書を机に出しておくか、ロッカーまで取りに行くかの違いです。手元（キャッシュ）にある割合が高いほど平均の待ち時間は短くなりますが、手元に置ける量はごくわずかなので100%にはできません。
          </HintButton>
        </>
      )}

      {card(
        4,
        "OSは何をしているのか",
        "基本ソフトウェアであるOSの役割を、1つずつ確かめます。",
        <>
          <Tabs value={osTopic} onChange={setOsTopic} options={Object.entries(osTopics).map(([value, [label]]) => ({ value, label }))} />
          <Results
            items={[
              { label: osTopics[osTopic][0], value: osTopics[osTopic][1], note: "OSがこの役割で引き受けている仕事" },
              { label: "身近な例", value: osTopics[osTopic][2], note: "ふだんの操作で、この仕事が表に出ている場面" }
            ]}
          />
          <Verdict ok>
            見分け方は「そのソフトウェアは誰のために働くか」です。機械を動かし、他のソフトが動く場所を整えるならOS（基本ソフトウェア）、
            人がやりたい作業そのものを行うなら応用ソフトウェア。いま選んでいる「{osTopics[osTopic][0]}」は、アプリが動く土台を整える仕事なので、OSの役割です。
          </Verdict>
          <DataTable
            head={["区分", "何をするソフトウェアか", "例"]}
            rows={[
              ["基本ソフトウェア（OS）", "ハードウェアを制御し、アプリが動く環境を整える", "Windows、macOS、Android"],
              ["応用ソフトウェア", "目的ごとの作業を行う", "文書作成、表計算、ブラウザ"],
              ["デバイスドライバ", "周辺機器をOSから使えるようにする", "プリンタ用、カメラ用"]
            ]}
          />
          <Hint>
            周辺機器はUSBやHDMIなどの決まった規格の端子（インタフェース）でつながります。OSを入れ直すとデバイスドライバも消えるため、入れ直しが必要になります。
          </Hint>
        </>
      )}

      {card(
        5,
        "用途別にPCを選定する",
        "文書作成用と動画編集用のPCを、根拠つきで提案します。",
        <AreaField
          label="2台の構成と、優先順位の理由"
          value={missionNote}
          onChange={onMissionNote}
          placeholder="例：文書作成用はCPUを中位に抑えSSDを512GBに。動画編集用はメインメモリ32GBとGPUを優先。書き出しはGPU依存が大きく、メモリ不足だと4K素材で補助記憶への退避が起きて極端に遅くなるため。"
          rows={5}
        />
      )}
    </>
  );
}

/* ========================================================================
 * D6 文字
 * ====================================================================== */
export function TextLab({ card, missionNote, onMissionNote }: LabProps) {
  const [char, setChar] = useState("A");
  const [sample, setSample] = useState("情報AI 2026");
  const [saveEnc, setSaveEnc] = useState("UTF-8");
  const [readEnc, setReadEnc] = useState("UTF-8");
  const [mojiIndex, setMojiIndex] = useState(0);
  const [chars, setChars] = useState(40);
  const [lines, setLines] = useState(40);
  const [bytesPerChar, setBytesPerChar] = useState(2);

  const info = asciiInfo(char.slice(0, 1) || "A");
  const table = useMemo(
    () =>
      Array.from({ length: 16 }, (_, row) =>
        Array.from({ length: 6 }, (_, col) => {
          const code = (col + 2) * 16 + row;
          return { code, char: code === 32 ? "␣" : String.fromCharCode(code) };
        })
      ),
    []
  );
  const totalBytes = chars * lines * bytesPerChar;
  const moji = mojibakeSamples[mojiIndex];
  const mojibake = moji.pairs[`${saveEnc}>${readEnc}`] ?? "（読めません）";
  const mojiBytes = moji.bytes[saveEnc];

  /* --- 実験2: 方式ごとの内訳（1文字あたりのバイト数 × その文字数） --- */
  const sampleChars = Array.from(sample);
  const utf8Groups = useMemo(() => {
    const map = new Map<number, number>();
    Array.from(sample).forEach((ch) => {
      const size = new TextEncoder().encode(ch).length;
      map.set(size, (map.get(size) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [sample]);
  const utf8Breakdown = utf8Groups.map(([size, count]) => `${size}B × ${count}字`).join(" ＋ ") || "0";
  const sjisHalf = sampleChars.filter((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 0x80 || (code >= 0xff61 && code <= 0xff9f);
  }).length;
  const sjisFull = sampleChars.length - sjisHalf;

  return (
    <>
      {card(
        0,
        "1文字を数値に直し、ASCIIコード表で位置を確かめる",
        "文字を入力して、10進数・16進数・2進数の対応を見ます。たての列と横の行がぶつかったマスに、その文字があることを確かめます。",
        <>
          <TextField label="1文字を入力" value={char} onChange={setChar} hint="半角英数字で試そう" />
          <Formula>
            文字コード ＝ 文字コード表で、その文字に決められている番号　→　同じ番号を16進数・2進数に書き直す
          </Formula>
          <Steps
            items={[
              { label: "① 入力した文字", value: info.char },
              { label: "② 表で番号を引く（10進数）", value: info.dec, note: "A なら65、a なら97" },
              { label: "③ 同じ番号を16進数で書く", value: info.hex, note: "上のけたが表の列、下のけたが表の行になる" },
              { label: "④ 同じ番号を2進数8けたで書く", value: <span className="mono">{info.bin}</span>, note: "この0と1の並びが、実際に保存される" }
            ]}
          />
          <Results
            items={[
              { label: `「${info.char}」の10進数(10)`, value: info.dec, note: "手順②。文字コード表で決められた番号" },
              { label: `「${info.char}」の16進数(16)`, value: info.hex, note: "手順③。同じ番号の、けたのまとめ方を変えた書き方" },
              { label: `「${info.char}」の2進数(2)`, value: <span className="mono">{info.bin}</span>, note: "手順④。実際に保存される0と1の並び" }
            ]}
          />
          <Hint>A は65、a は97。大文字と小文字は32（2進数で1けた分）だけ離れています。</Hint>
          <DataTable
            full
            head={[
              "下位4bit ＼ 上位4bit",
              ...[2, 3, 4, 5, 6, 7].map((col) => (
                <span key={col} className="mono">
                  {col.toString(2).padStart(4, "0")}
                  <br />（{col}）
                </span>
              ))
            ]}
            rows={table.map((row, index) => [
              <span key="h" className="mono">{index.toString(2).padStart(4, "0")}（{index.toString(16).toUpperCase()}）</span>,
              ...row.map((cell) => (
                <span key={cell.code} className={cell.char === info.char ? "hot" : ""}>
                  {cell.char}
                </span>
              ))
            ])}
          />
          <Hint>入力した文字が表の中で赤くなります。16進数の上のけたが列、下のけたが行です。</Hint>
        </>
      )}

      {card(
        1,
        "符号化方式でバイト数を比べる",
        "同じ文字列でも、方式によってデータ量が変わることを確かめます。",
        <>
          <TextField label="文字列を入力" value={sample} onChange={setSample} />
          <Formula>
            データ量(B) ＝ 1文字あたりのバイト数 × その文字数　を、方式の決まりにしたがって全部の文字分だけ足したもの
          </Formula>
          <Steps
            items={[
              { label: "① 文字数を数える", value: `${sampleChars.length} 文字`, note: "空白も1文字として数える" },
              { label: "② UTF-8：1文字ごとのバイト数に分ける", value: utf8Breakdown, note: "英数字は1B、日本語は3B" },
              { label: "③ UTF-8：全部足す", value: `${utf8Bytes(sample)} B` },
              { label: "④ Shift_JIS：半角1B・全角2Bで数える", value: `1B × ${sjisHalf}字 ＋ 2B × ${sjisFull}字 ＝ ${sjisBytes(sample)} B` },
              { label: "⑤ UTF-16：おおむね一律2Bで数える", value: `2B × ${sample.length}字 ＝ ${utf16Bytes(sample)} B` }
            ]}
          />
          <Results
            items={[
              { label: "UTF-8", value: `${utf8Bytes(sample)} B`, note: `手順③。英数字1B・日本語3B（内訳 ${utf8Breakdown}）` },
              { label: "UTF-16", value: `${utf16Bytes(sample)} B`, note: "手順⑤。おおむね一律2B。英数字でも2B使う" },
              { label: "Shift_JIS（概算）", value: `${sjisBytes(sample)} B`, note: `手順④。半角1B・全角2B（半角${sjisHalf}字・全角${sjisFull}字）` },
              { label: "文字数", value: `${sampleChars.length} 文字`, note: "手順①。どの方式でも、かける相手はこの文字数" }
            ]}
          />
          <Results
            items={[
              { label: "1文字8ビットなら", value: "256 種類", note: "2の8乗。ASCII（128）やShift_JISの半角はこの範囲" },
              { label: "1文字16ビットなら", value: "65,536 種類", note: "2の16乗。Unicodeのよく使う範囲がここに入る" },
              { label: "1文字あたりのバイト数", value: "ビット数 ÷ 8", note: "8ビット＝1B、16ビット＝2B、24ビット＝3B" }
            ]}
          />
          <HintButton id="text-1-1">
            1ビット増やすごとに、表せる文字の数は2倍になります。世界中の文字を全部入れようとすると8ビット（256種類）ではとても足りません。座席番号のけたが足りないと同じ席に2人が座ってしまうのと同じで、けたが足りなければ別の文字に同じ番号を割り当てるしかなくなります。
          </HintButton>
          <Hint>英語中心の文書はUTF-8が小さく、日本語だけの文書はShift_JISやUTF-16が小さくなることもあります。</Hint>
        </>
      )}

      {card(
        2,
        "文字化けを再現する",
        "UTF-8・Shift_JIS・EUC-JP・UTF-16の4方式で、保存したときと読むときを食い違わせます。",
        <>
          <Row>
            <SelectField
              label="ためす文字列"
              value={String(mojiIndex)}
              onChange={(v) => setMojiIndex(Number(v))}
              options={mojibakeSamples.map((row, i) => ({ value: String(i), label: row.text }))}
            />
            <SelectField label="保存するときの方式" value={saveEnc} onChange={setSaveEnc} options={MOJIBAKE_ENCODINGS.map((value) => ({ value, label: value }))} />
            <SelectField label="読み込むときの方式" value={readEnc} onChange={setReadEnc} options={MOJIBAKE_ENCODINGS.map((value) => ({ value, label: value }))} />
          </Row>
          <div className="encoding-flow">
            <span>{moji.text}</span>
            <i>{saveEnc} で保存（{mojiBytes.bytes}B）</i>
            <span className="mono">{mojiBytes.hex}</span>
            <i>{readEnc} で読込</i>
            <strong className={saveEnc === readEnc ? "" : "broken"}>{mojibake}</strong>
          </div>
          <DataTable
            head={["保存した方式 ＼ 読んだ方式", ...MOJIBAKE_ENCODINGS]}
            rows={MOJIBAKE_ENCODINGS.map((sv) => [
              <b key={sv}>{sv}</b>,
              ...MOJIBAKE_ENCODINGS.map((rd) => (
                <span key={rd} className={sv === rd ? "hot" : "broken-cell"}>
                  {moji.pairs[`${sv}>${rd}`]}
                </span>
              ))
            ])}
            highlight={(index) => MOJIBAKE_ENCODINGS[index] === saveEnc}
          />
          <Results
            items={MOJIBAKE_ENCODINGS.map((name) => ({
              label: `${name} で保存したときの大きさ`,
              value: `${moji.bytes[name].bytes} B`,
              note:
                name === "UTF-8"
                  ? "世界中の文字を1つの表に入れた方式（Unicode）の代表。日本語は3B、英数字は1B"
                  : name === "UTF-16"
                    ? "同じくUnicodeの方式。日本語も英数字もおおむね2Bずつ使う"
                    : name === "EUC-JP"
                      ? "UNIXで使われてきた日本語の方式。全角2B・半角1B"
                      : "Windowsで長く使われてきた日本語の方式。全角2B・半角1B"
            }))}
          />
          <Verdict ok={saveEnc === readEnc}>
            {saveEnc === readEnc
              ? `${saveEnc} で保存して ${readEnc} で読んだので、正しく読めます。表の対角線（色のついたところ）だけが、もとの文字列に戻る組み合わせです。`
              : `${saveEnc} で保存したものを ${readEnc} で読んだので、文字化けしました。ファイルの中のバイトの並び（上の16進数）は壊れていません。壊れているのは「読み方の決まり」のほうなので、${saveEnc} で開き直せば元に戻ります。`}
          </Verdict>
          <HintButton id="text-2-1">
            文字化けが起きても、ファイルの中身は壊れていません。壊れているのは「読み方の決まり」のほうです。同じ数字の並びでも、日本語の表で読むか英語の表で読むかで別の文字になる。暗号を間違った鍵で開けたようなもので、正しい方式で開き直せば元どおりになります。
          </HintButton>
        </>
      )}

      

      {card(
        3,
        "文字データ量を計算する",
        "1ページ分の文字データが何キロバイトになるかを求めます。",
        <>
          <Row>
            <NumberField label="1行の文字数" value={chars} onChange={setChars} min={1} max={200} unit="字" />
            <NumberField label="行数" value={lines} onChange={setLines} min={1} max={200} unit="行" />
            <NumberField label="1文字あたり" value={bytesPerChar} onChange={setBytesPerChar} min={1} max={4} unit="B" />
          </Row>
          <Steps
            items={[
              { label: "総文字数", value: `${fmt(chars * lines, 0)} 字` },
              { label: "バイト数", value: `${fmt(totalBytes, 0)} B` },
              { label: "1KB＝1,024B なら", value: `${fmt(totalBytes / 1024, 3)} KB`, note: "教科書のきまり（1KB＝1,024B）" },
              { label: "1kB＝1,000B なら", value: `${fmt(totalBytes / 1000, 3)} kB`, note: "世界共通の単位のきまり（SI）。問題文が指定したときはこちら" }
            ]}
          />
          <HintButton id="text-3-1">1kBを1,000とするか1,024とするかで答えが変わります。問題文の指定を必ず確認しましょう。</HintButton>
        </>
      )}

      {card(
        4,
        "文字化けしたCSVを復旧する",
        "元ファイルを壊さずに読み直す手順を書き出します。",
        <AreaField
          label="復旧の手順"
          value={missionNote}
          onChange={onMissionNote}
          placeholder="例：1) 元ファイルのコピーを取る 2) テキストエディタで文字コードを指定して開き直す 3) Shift_JISで読めれば正解 4) UTF-8（BOM付き）で保存し直す 5) 以後はUTF-8で統一する"
          rows={5}
        />
      )}
    </>
  );
}

/* ========================================================================
 * D7 音声
 * ====================================================================== */
export function AudioLab({ card, missionNote, onMissionNote }: LabProps) {
  const [freq, setFreq] = useState(440);
  const [sampleRate, setSampleRate] = useState(44100);
  const [maxFreq, setMaxFreq] = useState(20000);
  const [quantBits, setQuantBits] = useState(16);
  const [seconds, setSeconds] = useState(300);
  const [channels, setChannels] = useState(2);
  const [preset, setPreset] = useState("CD");

  const wave = Array.from({ length: 60 }, (_, i) => Math.sin((i / 60) * Math.PI * 2 * (freq / 220)));
  const sampleCount = clamp(Math.round(sampleRate / 2000), 4, 60);
  const levels = 2 ** quantBits;
  const bytes = audioBytes(sampleRate, quantBits, channels, seconds);
  const presets: Record<string, [number, number, number, string]> = {
    "電話くらいの音質": [8000, 8, 1, "声が聞き取れれば十分な用途"],
    CD: [44100, 16, 2, "音楽の標準的な品質"],
    "DVD / YouTube": [48000, 16, 2, "映像作品でよく使われる"],
    ハイレゾ: [96000, 24, 2, "CDを超える情報量"]
  };
  const [pRate, pBits, pCh, pNote] = presets[preset] ?? presets.CD;

  /* --- 実験1: 音階 --- */
  const note = noteOf(freq);
  /** ド〜シ＋1オクターブ上のド。1Hz刻みのつまみに合わせて、四捨五入した値を使う */
  const scaleKeys = useMemo(
    () =>
      [0, 2, 4, 5, 7, 9, 11, 12].map((semi) => {
        // C4（ド）は A4 から9半音下
        const n = semi - 9;
        return { label: NOTE_NAMES[(semi + 12) % 12], freq: Math.round(440 * 2 ** (n / 12)) };
      }),
    []
  );

  return (
    <>
      {card(
        0,
        "周波数と音の高さ",
        "1秒間の波の数を変えて、波の形がどう変わるかを見ます。",
        <>
          <SliderField label="周波数" value={freq} onChange={setFreq} min={110} max={1760} step={1} unit=" Hz" />
          <div className="wave">
            {wave.map((v, i) => (
              <i key={i} style={{ height: `${20 + (v + 1) * 35}%` }} />
            ))}
          </div>
          <Formula>
            1周期の長さ(ms) ＝ 1秒（＝1,000 ms） ÷ 周波数（1秒間の波の数）　／　周波数が2倍になると、音は1オクターブ高くなる
          </Formula>
          <Steps
            items={[
              { label: "① 1秒間の波の数", value: `${freq} Hz`, note: "つまみで決めた周波数" },
              { label: "② 1秒を、その波の数で分ける", value: `1,000 ms ÷ ${freq}` },
              { label: "③ 波1つ分の長さ", value: `${fmt(1000 / freq, 3)} ms`, note: "波が短いほど、音は高くなる" },
              { label: "④ 基準の ラ（440Hz）と比べる", value: `${freq} ÷ 440 ＝ ${fmt(freq / 440, 2)} 倍` }
            ]}
          />
          <Results
            items={[
              { label: "周波数", value: `${freq} Hz`, note: "1秒間に波が何回くり返すか" },
              { label: "1周期の長さ", value: `${fmt(1000 / freq, 3)} ms`, note: "手順③。波1つ分にかかる時間" },
              { label: "音の高さ", value: freq < 262 ? "低い" : freq < 880 ? "中くらい" : "高い", note: "周波数が大きいほど高い音になる" },
              {
                label: "いちばん近い音階",
                value: note.name,
                note:
                  Math.abs(note.cents) <= 3
                    ? `ちょうど ${fmt(note.exact, 1)} Hz の音（ずれ ${note.cents} セント）`
                    : `本来は ${fmt(note.exact, 1)} Hz。いまは ${note.cents > 0 ? "少し高い" : "少し低い"}（ずれ ${note.cents} セント）`
              },
              { label: "基準音との比較", value: freq === 440 ? "ラ（A4）ちょうど" : `ラの音（440Hz）の ${fmt(freq / 440, 2)} 倍`, note: "手順④。2倍なら1オクターブ上、半分なら1オクターブ下" }
            ]}
          />
          <div className="scale-row">
            <span className="scale-label">音階のボタン（押すとその音の周波数になる）</span>
            <div className="scale-keys">
              {scaleKeys.map((k) => (
                <button
                  type="button"
                  key={k.label}
                  className={freq === k.freq ? "on" : ""}
                  onClick={() => setFreq(k.freq)}
                >
                  <b>{k.label}</b>
                  <em>{k.freq} Hz</em>
                </button>
              ))}
            </div>
            <em className="scale-note">
              1オクターブ上がると周波数はちょうど2倍。ラ（A4）440Hz の1つ上のラ（A5）は880Hzです。
              半音1つぶんは 2 の 12分の1 乗（約1.0595）倍になっています。
            </em>
          </div>
        </>
      )}

      {card(
        1,
        "標本化：一定間隔で波を測り、足りているかを確かめる",
        "1秒間に測る回数を変えて、点の細かさと、元の波を再現できるかを確かめます。",
        <>
          <SliderField label="標本化周波数（1秒間に測る回数）" value={sampleRate} onChange={setSampleRate} min={4000} max={96000} step={1000} unit=" Hz" />
          <div className="wave sampled">
            {Array.from({ length: sampleCount }, (_, i) => (
              <i key={i} style={{ height: `${25 + Math.abs(Math.sin((i / sampleCount) * Math.PI * 3)) * 60}%` }} />
            ))}
          </div>
          <Results
            items={[
              { label: "1秒間の測定回数", value: `${fmt(sampleRate, 0)} 回`, note: "つまみで決めた標本化周波数。この回数だけ波の高さを測る" },
              { label: "測定の間隔", value: `${fmt(1e6 / sampleRate, 2)} µs`, note: "1秒 ÷ 測定回数。この時間ごとに1点ずつ測っている" },
              { label: "1分間に測る回数", value: fmt(sampleRate * 60, 0), note: "1秒あたりの回数 × 60。60秒ぶんに増える点の数" }
            ]}
          />
          <NumberField label="元の音に含まれる最高周波数" value={maxFreq} onChange={setMaxFreq} min={100} max={48000} step={100} unit="Hz" />
          <Formula>標本化周波数 ≧ 最高周波数 × 2 が必要</Formula>
          <Results
            items={[
              { label: "必要な最小標本化周波数", value: `${fmt(maxFreq * 2, 0)} Hz`, note: "最高周波数 × 2。標本化定理が求める下限" },
              { label: "再現できる最高周波数", value: `${fmt(nyquist(sampleRate), 0)} Hz`, note: "いまの標本化周波数 ÷ 2。ここまでの高さの音を戻せる" },
              { label: "判定", value: sampleRate >= maxFreq * 2 ? "再現できる" : "本当はない低い音が混ざる（折り返し雑音）", warn: sampleRate < maxFreq * 2, note: "いまの標本化周波数が、必要な最小値に届いているか" }
            ]}
          />
          <Verdict ok={sampleRate >= maxFreq * 2}>
            {sampleRate >= maxFreq * 2
              ? "標本化定理を満たしています。"
              : "測る速さが足りません。本来なかった低い音（折り返し雑音）が現れます。"}
          </Verdict>
          <HintButton id="audio-1-1">
            なめらかに動く波を、一定の間隔でパシャパシャと写真に撮るようなものです。撮る回数が少ないと、速い波を見のがして「ゆっくりな波」と勘違いして記録してしまいます。扇風機の羽が速く回っているのに動画では止まって見えるのと同じ現象で、これを防ぐには元の音のいちばん高い周波数の2倍以上の速さで測る必要があります。
          </HintButton>
        </>
      )}

      {card(
        2,
        "量子化：波の高さを段階に丸める",
        "量子化ビット数を変えて、段階の細かさと誤差を確かめます。",
        <>
          <SliderField label="量子化ビット数" value={quantBits} onChange={setQuantBits} min={2} max={24} unit=" bit" />
          <Formula>
            段階数 ＝ 2の（量子化ビット数）乗　／　1段階の幅 ＝ いちばん大きい音の高さ ÷ 段階数
          </Formula>
          <Steps
            items={[
              { label: "① 量子化ビット数", value: `${quantBits} bit` },
              { label: "② 2を、そのビット数の回数だけかける", value: `2の${quantBits}乗 ＝ ${fmt(levels, 0)}`, note: "これが波の高さを分ける段数" },
              { label: "③ いちばん大きい音の高さを1として、段数で割る", value: `1 ÷ ${fmt(levels, 0)} ＝ ${fmt(1 / levels, 8)}`, note: "この幅より細かい変化は表せない" },
              { label: "④ 1ビット減らすと", value: `${fmt(levels / 2, 0)} 段階`, note: "段数は半分、1段階の幅は2倍になる" }
            ]}
          />
          <Results
            items={[
              { label: "表せる段階数", value: fmt(levels, 0), note: "手順②。この段数のどれかに波の高さを丸める" },
              { label: "1段階の細かさ（いちばん大きい音の高さを1としたとき）", value: fmt(1 / levels, 8), note: "手順③。丸めで生じる誤差（量子化誤差）の目安" },
              { label: "表せる音の大きさの幅（ダイナミックレンジ）の目安", value: `約 ${fmt(quantBits * 6, 0)} dB`, note: "1ビットあたりおよそ6dB。ビット数 × 6 で見積もる" }
            ]}
          />
          <HintButton id="audio-2-1">1ビット増やすごとに段階は2倍、表現できる音の強弱の幅はおよそ6dB広がります。</HintButton>
        </>
      )}

      {card(
        3,
        "非圧縮音声のデータ量を求める",
        "4つの数値を入力して、段階を追って容量を計算します。",
        <>
          <Row>
            <NumberField label="標本化周波数" value={sampleRate} onChange={setSampleRate} min={1000} max={192000} step={100} unit="Hz" />
            <NumberField label="量子化ビット数" value={quantBits} onChange={setQuantBits} min={1} max={32} unit="bit" />
          </Row>
          <Row>
            <NumberField label="チャネル数" value={channels} onChange={setChannels} min={1} max={6} unit="ch" hint="モノラル1・ステレオ2" />
            <NumberField label="時間" value={seconds} onChange={setSeconds} min={1} max={7200} unit="秒" />
          </Row>
          <Formula>データ量 ＝ 標本化周波数 × 量子化ビット数 ÷ 8 × チャネル数 × 秒数</Formula>
          <Steps
            items={[
              { label: "1秒あたりのビット数", value: `${fmt(sampleRate * quantBits * channels, 0)} bit` },
              { label: "1秒あたりのバイト数", value: `${fmt((sampleRate * quantBits * channels) / 8, 0)} B` },
              { label: `${seconds}秒分`, value: `${fmt(bytes, 0)} B` }
            ]}
          />
          <Results items={bytesRow(bytes)} />
          <details className="unit-note">
            <summary>問題文で「1MB＝1,000kB」と指定されたとき</summary>
            <Results items={bytesRowSI(bytes)} />
          </details>
          <Hint>教科書は 1KB＝1,024B で計算します。IPAの問題では 1MB＝1,000kB と指定されることがあるので、問題文を必ず確認しましょう。</Hint>
        </>
      )}

      {card(
        4,
        "音質のプリセットを比べる",
        "用途ごとの標準的な設定と、そのデータ量を比べます。",
        <>
          <Tabs value={preset} onChange={setPreset} options={Object.keys(presets).map((value) => ({ value, label: value }))} />
          <Formula>
            データ量 ＝ 標本化周波数 × 量子化ビット数 ÷ 8 × チャネル数 × 秒数（1分なら60秒）
          </Formula>
          <Steps
            items={[
              { label: "① 1秒あたりのビット数", value: `${fmt(pRate, 0)} × ${pBits} × ${pCh} ＝ ${fmt(pRate * pBits * pCh, 0)} bit` },
              { label: "② バイトに直す（÷8）", value: `${fmt((pRate * pBits * pCh) / 8, 0)} B`, note: "8ビットで1バイト" },
              { label: "③ 60秒分にする（×60）", value: `${fmt(audioBytes(pRate, pBits, pCh, 60), 0)} B` },
              { label: "④ MBに直す（÷1,024²）", value: `${fmt(audioBytes(pRate, pBits, pCh, 60) / 1024 ** 2, 2)} MB`, note: "教科書のきまり（1KB＝1,024B）で計算" }
            ]}
          />
          <Results
            items={[
              { label: "標本化周波数", value: `${fmt(pRate, 0)} Hz`, note: "1秒間に波の高さを測る回数" },
              { label: "量子化ビット数", value: `${pBits} bit`, note: `測った高さを ${fmt(2 ** pBits, 0)} 段階に丸める` },
              { label: "チャネル数", value: `${pCh} ch`, note: pCh === 1 ? "モノラル。1本ぶんだけ記録する" : "ステレオ。左右2本ぶんを記録するのでデータ量も2倍" },
              { label: "1分あたり", value: `${fmt(audioBytes(pRate, pBits, pCh, 60) / 1024 ** 2, 2)} MB`, note: `手順④。${pNote}` }
            ]}
          />
          <button type="button" className="apply-preset" onClick={() => { setSampleRate(pRate); setQuantBits(pBits); setChannels(pCh); }}>
            この設定を実験4の計算に入れる
          </button>
          <HintButton id="audio-4-1">
            音質を上げると、そのぶんデータ量も増えます。測る回数を2倍にすればデータも2倍、ステレオにすればさらに2倍です。写真の解像度を上げるとファイルが重くなるのと同じで、「きれいさ」と「軽さ」は必ず引っぱり合います。
          </HintButton>
        </>
      )}

      {card(
        5,
        "校内放送の音質を決める",
        "計算した容量を根拠に、設定を決めます。",
        <AreaField
          label="決めた設定と、その根拠"
          value={missionNote}
          onChange={onMissionNote}
          placeholder="例：言葉が聞き取れればよいので 16kHz・16bit・モノラルを採用。5分で約9.6MBに収まり、校内サーバの容量にも余裕がある。音楽を流す回は44.1kHz・ステレオに切り替える。"
          rows={4}
        />
      )}
    </>
  );
}

/* ========================================================================
 * D8 画像
 * ====================================================================== */
export function ImageLab({ card, missionNote, onMissionNote }: LabProps) {
  const [mixTab, setMixTab] = useState("rgb");
  const [artTab, setArtTab] = useState("mono");
  const [r, setR] = useState(255);
  const [g, setG] = useState(120);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);
  const [m, setM] = useState(80);
  const [y, setY] = useState(100);
  const [k, setK] = useState(0);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [colorBits, setColorBits] = useState(24);
  const [cmWidth, setCmWidth] = useState(25.4);
  const [cmHeight, setCmHeight] = useState(38.1);
  const [dpi, setDpi] = useState(600);
  const [monoArt, setMonoArt] = useState("00000000\n01111110\n01000000\n01000000\n01111100\n01000000\n01000000\n00000000");
  const [colorArt, setColorArt] = useState("0002000000\n0222220012\n0020020034\n0020020056\n0020020070\n0200002000\n0000220000\n0020000000\n0020000000\n0020020000\n0020200000\n0022002222\n0020000000\n0000000000\n0000000000");
  const [useCase, setUseCase] = useState("photo");

  const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).toUpperCase().padStart(2, "0");
  const rgbHex = `#${hex(r)}${hex(g)}${hex(b)}`;
  const cmyToRgb = {
    r: Math.round(255 * (1 - c / 100) * (1 - k / 100)),
    g: Math.round(255 * (1 - m / 100) * (1 - k / 100)),
    b: Math.round(255 * (1 - y / 100) * (1 - k / 100))
  };
  const bytes = imageBytes(width, height, colorBits);
  const dotW = dpiToDots(cmWidth, dpi);
  const dotH = dpiToDots(cmHeight, dpi);
  const scanBytes = imageBytes(dotW, dotH, 24);
  const palette = ["#111111", "#e5484d", "#f5d90a", "#d6409f", "#30a46c", "#00b8d9", "#3b82f6", "#ffffff"];
  const monoRows = monoArt.split("\n").map((row) => row.replace(/[^01]/g, ""));
  const colorRows = colorArt.split("\n").map((row) => row.replace(/[^0-7]/g, ""));
  const monoPixels = monoRows.reduce((sum, row) => sum + row.length, 0);
  /* この絵をランレングス法で圧縮したらどうなるか（D10の先取り） */
  const monoFlat = monoRows.join("");
  const monoRun = useMemo(() => runLength(monoFlat), [monoFlat]);
  const colorPixels = colorRows.reduce((sum, row) => sum + row.length, 0);
  const recommend = useCase === "photo" ? "JPEG / WebP（非可逆＝もとに完全には戻せない）" : useCase === "logo" ? "PNG / SVG（可逆＝もとに完全に戻せる・透過対応）" : "PNG（可逆＝もとに完全に戻せる）";

  return (
    <>
      {card(
        0,
        "光の三原色と色の三原色を混ぜ比べる",
        "画面の光を足していく混ぜ方と、インクで光を吸い取る混ぜ方を、タブで切り替えて見比べます。",
        <>
          <Tabs
            value={mixTab}
            onChange={setMixTab}
            options={[
              { value: "rgb", label: "光の三原色（加法混色）" },
              { value: "cmyk", label: "色の三原色（減法混色）" }
            ]}
          />
          {mixTab === "rgb" ? (
          <>
          <Row>
            <NumberField label="R（赤）" value={r} onChange={setR} min={0} max={255} />
            <NumberField label="G（緑）" value={g} onChange={setG} min={0} max={255} />
            <NumberField label="B（青）" value={b} onChange={setB} min={0} max={255} />
          </Row>
          <div className="color-preview" style={{ background: rgbHex }}>
            <span style={{ color: r * 0.299 + g * 0.587 + b * 0.114 > 140 ? "#111" : "#fff" }}>{rgbHex}</span>
          </div>
          <Formula>
            16進カラーコード ＝ R・G・B それぞれの値（0〜255）を16進数2けたに直し、R→G→Bの順に並べたもの
          </Formula>
          <Steps
            items={[
              { label: "① 3つの値を10進数で読む", value: `R ${r} ／ G ${g} ／ B ${b}`, note: "0が「その色の光を出さない」、255が「最大で出す」" },
              { label: "② それぞれを16進数2けたに直す", value: `${hex(r)} ／ ${hex(g)} ／ ${hex(b)}`, note: "255 ÷ 16 の商と余りを16進の2けたにする" },
              { label: "③ R→G→Bの順に並べる", value: rgbHex },
              { label: "④ Rだけ2進数8けたで書くと", value: <span className="mono">{r.toString(2).padStart(8, "0")}</span>, note: "1色あたり8ビット。3色で24ビット" }
            ]}
          />
          <Results
            items={[
              { label: "10進カラーコード", value: `${r}, ${g}, ${b}`, note: "手順①。各色の光の強さを0〜255で表した値" },
              { label: "16進カラーコード", value: rgbHex, note: "手順③。同じ3つの値を16進数で並べ直したもの" },
              { label: "2進数(2)（Rのみ）", value: <span className="mono">{r.toString(2).padStart(8, "0")}</span>, note: "手順④。実際に保存される0と1の並び" },
              { label: "表せる色数", value: "16,777,216 色", note: "2の24乗。各色8bit × 3色 ＝ 24bit だから" }
            ]}
          />
          <Hint>3つとも0なら黒（光を出していない）、3つとも255なら白。混ぜるほど明るくなるのが加法混色です。</Hint>
          </>
          ) : (
          <>
          <Row>
            <NumberField label="C（シアン）" value={c} onChange={setC} min={0} max={100} unit="%" />
            <NumberField label="M（マゼンタ）" value={m} onChange={setM} min={0} max={100} unit="%" />
            <NumberField label="Y（イエロー）" value={y} onChange={setY} min={0} max={100} unit="%" />
            <NumberField label="K（黒）" value={k} onChange={setK} min={0} max={100} unit="%" />
          </Row>
          <div className="color-preview" style={{ background: `rgb(${cmyToRgb.r},${cmyToRgb.g},${cmyToRgb.b})` }}>
            <span style={{ color: cmyToRgb.r * 0.299 + cmyToRgb.g * 0.587 + cmyToRgb.b * 0.114 > 140 ? "#111" : "#fff" }}>
              C{c} M{m} Y{y} K{k}
            </span>
          </div>
          <Formula>
            R ＝ 255 ×（1 − C）×（1 − K）　／　G ＝ 255 ×（1 − M）×（1 − K）　／　B ＝ 255 ×（1 − Y）×（1 − K）　（C・M・Y・Kは割合）
          </Formula>
          <Steps
            items={[
              { label: "① インクの量を割合に直す", value: `C ${c / 100} ／ M ${m / 100} ／ Y ${y / 100} ／ K ${k / 100}`, note: "100%なら1、0%なら0" },
              { label: "② 残る光の割合を出す（1 − 割合）", value: `${fmt(1 - c / 100, 2)} ／ ${fmt(1 - m / 100, 2)} ／ ${fmt(1 - y / 100, 2)}`, note: "インクが多いほど、跳ね返る光が減る" },
              { label: "③ 黒インクの分もさらにかける", value: `×${fmt(1 - k / 100, 2)}`, note: "Kが増えるほど、どの色も暗くなる" },
              { label: "④ 255をかけて画面のRGBに直す", value: `${cmyToRgb.r}, ${cmyToRgb.g}, ${cmyToRgb.b}` }
            ]}
          />
          <Results
            items={[
              { label: "画面での見え方（RGB換算）", value: `${cmyToRgb.r}, ${cmyToRgb.g}, ${cmyToRgb.b}`, note: "手順④。インクの色を、画面の光の値に置き換えたもの" },
              { label: "CMYすべて100%", value: "理論上は黒", note: "光をすべて吸い取る計算になる。実際は濁るのでKを足す" },
              { label: "CMYすべて0%", value: "紙の白", note: "インクを乗せないので、紙が返す光がそのまま見える" }
            ]}
          />
          <Hint>CMYすべてを0%にすると紙の白。混ぜるほど暗くなるのが減法混色です。</Hint>
          </>
          )}
          <HintButton id="image-0-1">
            絵の具は混ぜるほど暗くなります。絵の具は光を吸い取る（減らす）ので、混ぜるほど反射する光が減るからです。光を足していくRGBとは逆向きの考え方で、だから画面（光）と印刷（インク）では、同じ色を出すための数値がちがいます。
          </HintButton>
        </>
      )}

      {card(
        1,
        "画素数と1画素のビット数から容量を求める",
        "画素数と1画素あたりのビット数を変えて、非圧縮容量を計算します。",
        <>
          <Row>
            <NumberField label="横の画素数" value={width} onChange={setWidth} min={1} max={8000} unit="px" />
            <NumberField label="縦の画素数" value={height} onChange={setHeight} min={1} max={8000} unit="px" />
            <NumberField label="1画素あたり" value={colorBits} onChange={setColorBits} min={1} max={48} unit="bit" />
          </Row>
          <div className="preset-row">
            {[[1280, 720, "HD"], [1920, 1080, "フルHD"], [3840, 2160, "4K"], [7680, 4320, "8K"]].map(([w, h, name]) => (
              <button type="button" key={String(name)} onClick={() => { setWidth(Number(w)); setHeight(Number(h)); }}>
                {name} {w}×{h}
              </button>
            ))}
          </div>
          <Formula>データ量 ＝ 横 × 縦 × 1画素のビット数 ÷ 8</Formula>
          <Steps
            items={[
              { label: "総画素数", value: `${fmt(width * height, 0)} 画素` },
              { label: "表せる色数", value: `${fmt(2 ** Math.min(colorBits, 32), 0)} 色` },
              { label: "ビット数", value: `${fmt(width * height * colorBits, 0)} bit` }
            ]}
          />
          <Results items={bytesRow(bytes)} />
          <details className="unit-note">
            <summary>問題文で「1MB＝1,000kB」と指定されたとき</summary>
            <Results items={bytesRowSI(bytes)} />
          </details>
          <HintButton id="image-1-1">縦横をそれぞれ2倍にすると、画素数は4倍。データ量も4倍になります。教科書は 1KB＝1,024B で計算します。</HintButton>
        </>
      )}

      {card(
        2,
        "dpiから画素数を求める",
        "長さと解像度を入力して、スキャナで読み取ったときの容量を計算します。",
        <>
          <Row>
            <NumberField label="横の長さ" value={cmWidth} onChange={setCmWidth} step={0.1} min={1} max={200} unit="cm" />
            <NumberField label="縦の長さ" value={cmHeight} onChange={setCmHeight} step={0.1} min={1} max={200} unit="cm" />
            <NumberField label="解像度（dpi＝1インチに何ドット）" value={dpi} onChange={setDpi} min={72} max={2400} unit="dpi" />
          </Row>
          <Formula>ドット数 ＝ 長さ(cm) ÷ 2.54 × dpi</Formula>
          <Steps
            items={[
              { label: "横（インチ）", value: `${fmt(cmWidth / 2.54, 2)} inch` },
              { label: "横（ドット）", value: `${fmt(dotW, 0)} dot` },
              { label: "縦（ドット）", value: `${fmt(dotH, 0)} dot` },
              { label: "総画素数", value: `${fmt(dotW * dotH, 0)} 画素` }
            ]}
          />
          <Results items={bytesRow(scanBytes)} />
          <details className="unit-note">
            <summary>問題文で「1MB＝1,000kB」と指定されたとき</summary>
            <Results items={bytesRowSI(scanBytes)} />
          </details>
          <HintButton id="image-2-1">dpiは「1インチあたり」の数なので、cmのままかけると答えが合いません。必ず1インチ＝2.54cmで単位をそろえてから計算します。</HintButton>
        </>
      )}

      {card(
        3,
        "ドット絵を描いて、色数・データ量・縮み方を見る",
        "左に数字を打ち込むと、右に絵が出ます。1画素に何ビット使うかで色数とデータ量がどう変わるか、その絵がどれだけ縮むかまで見ます。",
        <>
          <Tabs
            value={artTab}
            onChange={setArtTab}
            options={[
              { value: "mono", label: "2値（白黒・1bit）" },
              { value: "color", label: "8色（3bit）" }
            ]}
          />
          {artTab === "mono" ? (
          <>
          <div className="art-split">
            <div className="art-source">
              <AreaField label="0と1で描く（改行で行を分ける）" value={monoArt} onChange={setMonoArt} rows={8} hint="0＝白 / 1＝黒" />
            </div>
            <div className="art-preview">
              <span className="art-caption">この0と1が、そのままこの絵になる</span>
              <div className="dot-art">
                {monoRows.map((row, ri) => (
                  <div key={ri}>
                    {row.split("").map((cell, ci) => (
                      <i key={ci} style={{ background: cell === "1" ? "#111111" : "#ffffff" }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Formula>データ量 ＝ マス数（総画素数） × 1画素あたりのビット数 ÷ 8</Formula>
          <Steps
            items={[
              { label: "① マス数を数える", value: `${monoPixels} 画素`, note: `${monoRows.length} 行ぶんの0と1を全部数えた` },
              { label: "② 1画素あたりのビット数", value: "1 bit", note: "白か黒の2通りなので、2の1乗で足りる" },
              { label: "③ かけてビット数を出す", value: `${monoPixels} × 1 ＝ ${monoPixels} bit` },
              { label: "④ バイトに直す（÷8）", value: `${fmt(monoPixels / 8, 3)} B` }
            ]}
          />
          <Results
            items={[
              { label: "総画素数", value: `${monoPixels} 画素`, note: "手順①。塗ったマスの数。これがかけ算の左側" },
              { label: "色情報", value: "1 bit", note: "手順②。白か黒の2値なので1ビットで足りる" },
              { label: "データ量", value: `${fmt(monoPixels / 8, 3)} B`, note: "手順④。マス数 × 1bit ÷ 8 の結果" }
            ]}
          />
          <Formula>
            ランレングス法：同じ色が何個続くかを並べる　→　圧縮率(%) ＝ 圧縮後のビット数 ÷ 圧縮前のビット数 × 100
          </Formula>
          <Results
            items={[
              { label: "連続のかたまり", value: `${monoRun.runs.length} 個`, note: `いちばん長い連続が ${monoRun.maxCount} 個 → その数を表すのに ${monoRun.countBits} bit 必要` },
              { label: "個数の並び", value: <span className="mono">{monoRun.runs.map((r) => r.count).join(", ")}</span>, note: "左上から右下へ数えた、同じ色が続いた個数" },
              { label: "圧縮後のビット数", value: `${monoRun.afterCountOnly} bit`, note: `圧縮前は ${monoFlat.length} bit（1画素1bit）` },
              { label: "圧縮率", value: `${fmt(compressionRate(monoRun.afterCountOnly, monoFlat.length), 1)} %`, warn: monoRun.afterCountOnly >= monoFlat.length, note: monoRun.afterCountOnly < monoFlat.length ? "縮んだ。大きなかたまりのある絵ほどよく縮む" : "増えてしまった。市松模様のように1マスおきに変わる絵は縮まない" }
            ]}
          />
          <Hint>
            同じ色が長く続く絵ほど、ランレングス法でよく縮みます。市松模様のように1マスおきに色が変わる絵を描くと、逆にデータ量が増えます。圧縮のしくみは D10 でくわしく扱います。
          </Hint>
          </>
          ) : (
          <>
          <div className="art-split">
            <div className="art-source">
              <AreaField label="0〜7で描く（改行で行を分ける）" value={colorArt} onChange={setColorArt} rows={10} hint="0黒 1赤 2黄 3マゼンタ 4緑 5シアン 6青 7白" />
            </div>
            <div className="art-preview">
              <span className="art-caption">数字を変えると、右の絵もその場で変わる</span>
              <div className="dot-art">
                {colorRows.map((row, ri) => (
                  <div key={ri}>
                    {row.split("").map((cell, ci) => (
                      <i key={ci} style={{ background: palette[Number(cell)] }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Formula>データ量 ＝ マス数（総画素数） × 1画素あたりのビット数 ÷ 8</Formula>
          <Steps
            items={[
              { label: "① マス数を数える", value: `${colorPixels} 画素`, note: `${colorRows.length} 行ぶんの0〜7を全部数えた` },
              { label: "② 1画素あたりのビット数", value: "3 bit", note: "8色を区別したいので、2の3乗＝8で足りる" },
              { label: "③ かけてビット数を出す", value: `${colorPixels} × 3 ＝ ${fmt(colorPixels * 3, 0)} bit` },
              { label: "④ バイトに直す（÷8）", value: `${fmt((colorPixels * 3) / 8, 2)} B` },
              { label: "⑤ フルカラー（24bit）にすると", value: `${colorPixels} × 24 ÷ 8 ＝ ${fmt(colorPixels * 3, 0)} B`, note: "1画素3B。8倍のデータ量になる" }
            ]}
          />
          <Results
            items={[
              { label: "総画素数", value: `${colorPixels} 画素`, note: "手順①。塗ったマスの数" },
              { label: "色情報", value: "3 bit", note: "手順②。8色＝2の3乗なので3ビット" },
              { label: "データ量", value: `${fmt((colorPixels * 3) / 8, 2)} B`, note: "手順④。マス数 × 3bit ÷ 8 の結果" },
              { label: "フルカラーなら", value: `${fmt(colorPixels * 3, 0)} B`, note: "手順⑤。24bit＝3B。同じ絵でも色数を増やすと8倍になる" }
            ]}
          />
          </>
          )}
          <HintButton id="image-3-1">
            1マス（1画素）に何ビット使うかで、表せる色数が決まります。1ビットなら2色、3ビットなら8色です。マス目のノートを1マスずつ塗って絵を描くのと同じで、マスが細かいほど、色数が多いほどきれいになりますが、そのぶんデータ量も増えます。
          </HintButton>
        </>
      )}

      {card(
        4,
        "用途から画像形式を選ぶ",
        "写真・ロゴ・図表で、向いている形式が変わることを確かめます。",
        <>
          <Tabs
            value={useCase}
            onChange={setUseCase}
            options={[
              { value: "photo", label: "行事写真" },
              { value: "logo", label: "透過ロゴ" },
              { value: "chart", label: "図表・文字" }
            ]}
          />
          <Results
            items={[
              { label: "推奨する形式", value: recommend, note: "下の3点を見比べて選んだ形式" },
              { label: "圧縮の種類", value: useCase === "photo" ? "非可逆（戻せない）" : "可逆（完全に戻せる）", note: useCase === "photo" ? "色が少し変わっても人の目には分からないので、思い切って捨てられる" : "線がにじむと一目で分かるので、1ビットも変えられない" },
              { label: "拡大したとき", value: useCase === "logo" ? "SVGなら荒れない" : "ふちがギザギザになる", note: useCase === "logo" ? "点と線を数式で持つため、どこまで拡大しても輪郭が滑らか" : "画素そのものが大きくなるため（ジャギー）" },
              { label: "背景を透明にできるか（透過）", value: useCase === "logo" ? "必要" : "いらない", note: useCase === "logo" ? "JPEGは透過にできないので候補から外れる" : "背景ごと表示してよいので、透過は判断材料にならない" }
            ]}
          />
          <Verdict ok>
            見分ける問いは3つ、「もとに完全に戻す必要があるか」「拡大して使うか」「背景を透明にするか」です。
            {useCase === "photo"
              ? "行事写真は、戻す必要がなく拡大もせず透過もいらないので、大きく縮められる非可逆のJPEG／WebPを選びます。"
              : useCase === "logo"
                ? "透過ロゴは、輪郭を保ったまま拡大し、背景も透明にしたいので、SVG（またはPNG）を選びます。"
                : "図表・文字は、線がにじむと読めなくなるので、完全に戻せる可逆のPNGを選びます。"}
          </Verdict>
          <HintButton id="image-4-1">
            写真は少しくらい色が変わっても人の目には分かりません。だから思い切って情報を捨てるJPEGが向いています。逆にロゴや図表は線がにじむと一目で分かるので、1ビットも変えないPNGを使います。下書きをそのまま出すか、清書して出すかを使い分けるのと同じ判断です。
          </HintButton>
        </>
      )}

      {card(
        5,
        "学校Web用に画像を書き出す",
        "形式と解像度を決めて、目標サイズに収まるかを説明します。",
        <AreaField
          label="決めた形式・解像度と、その根拠"
          value={missionNote}
          onChange={onMissionNote}
          placeholder="例：行事写真は表示幅1200pxに合わせてJPEG品質80で書き出し、約350kBに収める。ロゴはSVGで配置し、非対応環境用にPNGも用意する。元データは無圧縮で別に保存する。"
          rows={5}
        />
      )}
    </>
  );
}

/* ========================================================================
 * D9 動画
 * ====================================================================== */
export function VideoLab({ card, missionNote, onMissionNote }: LabProps) {
  const [fps, setFps] = useState(30);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [colorBits, setColorBits] = useState(24);
  const [minutes, setMinutes] = useState(10);
  const [ratio, setRatio] = useState(2);
  const [speed, setSpeed] = useState(50);
  const [deadline, setDeadline] = useState(30);

  const seconds = minutes * 60;
  const raw = videoBytes(width, height, colorBits, fps, seconds);
  const compressed = raw * (ratio / 100);
  const sendSeconds = transferSeconds(compressed, speed);
  const bandwidth = imageBytes(width, height, colorBits) * fps * 8;
  const fpsExamples: Record<number, string> = { 24: "映画", 30: "地デジ・ビデオカメラ", 60: "YouTube高フレームレート" };

  return (
    <>
      {card(
        0,
        "fpsを変えて動きの滑らかさを見る",
        "1秒あたりのコマ数と、1コマの表示時間の関係を確かめます。",
        <>
          <SliderField label="フレームレート" value={fps} onChange={setFps} min={5} max={120} unit=" fps" />
          <div className="frame-strip">
            {Array.from({ length: Math.min(24, fps) }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <Formula>
            1コマの表示時間(ms) ＝ 1秒（＝1,000 ms） ÷ fps　／　総コマ数 ＝ fps × 秒数
          </Formula>
          <Steps
            items={[
              { label: "① 1秒間に見せるコマ数", value: `${fps} 枚`, note: "これが fps（frames per second）" },
              { label: "② 1秒を、そのコマ数で分ける", value: `1,000 ms ÷ ${fps} ＝ ${fmt(1000 / fps, 2)} ms`, note: "1枚が画面に出ている時間" },
              { label: "③ 10分を秒に直す", value: "10 × 60 ＝ 600 秒" },
              { label: "④ コマ数 × 秒数", value: `${fps} × 600 ＝ ${fmt(fps * 600, 0)} 枚`, note: "10分の動画に必要な静止画の枚数" }
            ]}
          />
          <Results
            items={[
              { label: "1秒間のコマ数", value: `${fps} 枚`, note: "つまみで決めた fps" },
              { label: "1コマの表示時間", value: `${fmt(1000 / fps, 2)} ms`, note: "手順②。短いほど動きがなめらかになる" },
              { label: "10分間の総コマ数", value: fmt(fps * 600, 0), note: "手順④。この枚数ぶんの静止画を保存することになる" },
              { label: "代表例", value: fpsExamples[fps] ?? (fps < 24 ? "カクつきを感じる" : "滑らかに見える"), note: "24枚あたりから、人の目にはなめらかに見えはじめる" }
            ]}
          />
          <HintButton id="video-0-1">
            動画は、静止画をものすごい速さで次々に見せているだけです。パラパラ漫画のページをめくる速さが fps にあたります。めくるのが遅いとカクカクして見え、24枚以上あたりから人の目にはなめらかに見えはじめます。
          </HintButton>
        </>
      )}

      {card(
        1,
        "非圧縮動画のデータ量を求める",
        "1枚の画像の容量から、動画全体の容量を組み立てます。",
        <>
          <Row>
            <NumberField label="横" value={width} onChange={setWidth} min={1} max={8000} unit="px" />
            <NumberField label="縦" value={height} onChange={setHeight} min={1} max={8000} unit="px" />
            <NumberField label="色情報" value={colorBits} onChange={setColorBits} min={1} max={48} unit="bit" />
          </Row>
          <Row>
            <NumberField label="フレームレート" value={fps} onChange={setFps} min={1} max={120} unit="fps" />
            <NumberField label="長さ" value={minutes} onChange={setMinutes} min={1} max={180} unit="分" />
          </Row>
          <Formula>データ量 ＝ 横 × 縦 × 色情報 ÷ 8 × fps × 秒数</Formula>
          <Steps
            items={[
              { label: "1フレーム", value: `${fmt(imageBytes(width, height, colorBits) / 1024 ** 2, 2)} MB`, note: "D8で求めた画像1枚の容量と同じ式（横 × 縦 × 色情報 ÷ 8）" },
              { label: "1秒間", value: `${fmt((imageBytes(width, height, colorBits) * fps) / 1024 ** 2, 1)} MB` },
              { label: `${minutes}分間`, value: `${fmt(raw / 1024 ** 3, 2)} GB` }
            ]}
          />
          <Results items={bytesRow(raw)} />
          <details className="unit-note">
            <summary>問題文で「1MB＝1,000kB」と指定されたとき</summary>
            <Results items={bytesRowSI(raw)} />
          </details>
          <HintButton id="video-1-1">
            写真1枚分の容量に、1秒あたりの枚数と秒数をかけるだけです。ただし枚数がとても多いので、答えは一気にGB単位になります。フルHDの写真を1秒間に30枚、10分ぶん保存すると考えてみてください。だからこそ圧縮が絶対に必要になります。
          </HintButton>
        </>
      )}

      {card(
        2,
        "圧縮率を変えて現実的な容量にする",
        "圧縮後の割合を変えて、配信できる大きさにします。",
        <>
          <SliderField label="圧縮後の割合（元の何%か）" value={ratio} onChange={setRatio} min={1} max={100} unit=" %" />
          <Formula>
            圧縮後の容量 ＝ 非圧縮の容量 × 圧縮後の割合 ÷ 100　（＝ 非圧縮の容量 ÷「もとの何分の1か」）
          </Formula>
          <Steps
            items={[
              { label: "① 非圧縮の容量", value: `${fmt(raw / 1024 ** 3, 2)} GB`, note: "実験2で求めた、圧縮する前の大きさ" },
              { label: `② 圧縮後の割合をかける（× ${ratio} ÷ 100）`, value: `${fmt(raw / 1024 ** 3, 2)} × ${fmt(ratio / 100, 2)}` },
              { label: "③ 圧縮後の容量", value: `${fmt(compressed / 1024 ** 3, 3)} GB` },
              { label: "④ もとの何分の1か（100 ÷ 割合）", value: `100 ÷ ${ratio} ＝ ${fmt(100 / ratio, 1)} 分の1` },
              { label: `⑤ 1分あたりに直す（÷ ${minutes}分）`, value: `${fmt(compressed / minutes / 1024 ** 2, 1)} MB` }
            ]}
          />
          <Results
            items={[
              { label: "非圧縮", value: `${fmt(raw / 1024 ** 3, 2)} GB`, note: "手順①。コマを1枚ずつまるごと記録した場合の大きさ" },
              { label: "圧縮後", value: `${fmt(compressed / 1024 ** 3, 3)} GB`, note: "手順③。実際に保存・配信するファイルの大きさ" },
              { label: "もとの何分の1になったか", value: `${fmt(100 / ratio, 1)} 分の1`, note: "手順④。圧縮でどれだけ小さくできたか" },
              { label: "1分あたり", value: `${fmt(compressed / minutes / 1024 ** 2, 1)} MB`, note: "手順⑤。長さが変わったときの見積もりに使える" }
            ]}
          />
          <Hint>動画を圧縮する仕組み（H.264など）は、コマを1枚ずつまるごと記録せず、前のコマから変わった部分だけを記録します。そのため容量を大きく減らせます。</Hint>
        </>
      )}

      {card(
        3,
        "転送にかかる時間を求める",
        "容量をビットに直し、通信速度で割ります。",
        <>
          <SliderField label="実際に出る通信の速さ" value={speed} onChange={setSpeed} min={1} max={1000} unit=" Mbps" />
          <Formula>時間(秒) ＝ 容量(byte) × 8 ÷ 速度(bps)</Formula>
          <Steps
            items={[
              { label: "圧縮後の容量", value: `${fmt(compressed / 1024 ** 2, 1)} MB` },
              { label: "ビットに直す（×8）", value: `${fmt((compressed * 8) / 1e6, 1)} Mbit` },
              { label: `÷ ${speed} Mbps`, value: `${fmt(sendSeconds, 1)} 秒` },
              { label: "分に直すと", value: `${fmt(sendSeconds / 60, 2)} 分` }
            ]}
          />
          <Row>
            <NumberField label="締切までの残り時間" value={deadline} onChange={setDeadline} min={1} max={600} unit="分" />
          </Row>
          <Verdict ok={sendSeconds / 60 <= deadline}>
            {sendSeconds / 60 <= deadline
              ? `締切まで ${fmt(deadline - sendSeconds / 60, 1)} 分の余裕があります。`
              : `${fmt(sendSeconds / 60 - deadline, 1)} 分足りません。容量を減らすか、回線を変える必要があります。`}
          </Verdict>
          <HintButton id="video-3-1">
            容量の単位はバイト（B）、通信速度の単位はビット毎秒（bps）です。単位がちがうので、割る前に容量を8倍してビットにそろえます。長さをcmとインチのまま比べられないのと同じで、単位をそろえないと答えが8倍ずれます。
          </HintButton>
        </>
      )}

      {card(
        4,
        "配信に必要な回線の速さを求める",
        "1秒あたりのデータ量から、必要な回線速度を計算します。",
        <>
          <Formula>必要な回線の速さ(bps) ＝ 1秒あたりのデータ量(byte) × 8</Formula>
          <Results
            items={[
              { label: "非圧縮での必要帯域", value: `${fmt(bandwidth / 1e6, 1)} Mbps`, note: "1コマの容量 × fps × 8。圧縮しない場合に要る速さ" },
              { label: `圧縮後（${ratio}%）`, value: `${fmt((bandwidth * ratio) / 100 / 1e6, 2)} Mbps`, note: `非圧縮の必要帯域に、圧縮後の割合${ratio}%をかけた値` },
              { label: "現在の回線で足りるか", value: (bandwidth * ratio) / 100 / 1e6 <= speed ? "足りる" : "不足", warn: (bandwidth * ratio) / 100 / 1e6 > speed, note: `圧縮後の必要帯域と、実験4で決めた ${speed} Mbps を比べた` },
              { label: "画質を1段下げると", value: `${fmt((imageBytes(Math.round(width / 1.5), Math.round(height / 1.5), colorBits) * fps * 8 * ratio) / 100 / 1e6, 2)} Mbps`, note: "縦横をそれぞれ1.5分の1にしたときに要る速さ" }
            ]}
          />
          <Hint>電波の弱いところで動画の画質が勝手に下がるのは、送るデータ量を減らして、再生が止まらないようにしているからです。</Hint>
        </>
      )}

      {card(
        5,
        "授業動画の提出時間を見積もる",
        "計算結果をもとに、締切に間に合う手順を書きます。",
        <AreaField
          label="提出計画（容量・回線・所要時間・余裕）"
          value={missionNote}
          onChange={onMissionNote}
          placeholder="例：1080p・30fps・10分をH.264（元の2%）で書き出すと約1.1GB。校内Wi-Fiの実効50Mbpsで約3分。締切30分前に開始すれば余裕がある。失敗に備え720pの控えも用意する。"
          rows={5}
        />
      )}
    </>
  );
}

/* ========================================================================
 * D10 データの圧縮
 * ====================================================================== */
export function CompressLab({ card, missionNote, onMissionNote }: LabProps) {
  const [kind, setKind] = useState("lossless");
  const [before, setBefore] = useState(64);
  const [after, setAfter] = useState(52);
  const [runText, setRunText] = useState("AAAABBBBBAAA");
  const [huffText, setHuffText] = useState("AAAAAAAAAABBBBCCCDDEEF");

  const kinds: Record<string, [string, string, string, string]> = {
    lossless: ["可逆圧縮", "もとに戻せる", "ZIP・PNG・GIF・FLAC", "文書やプログラムのように、1ビットも変えてはいけないデータに使います。"],
    lossy: ["非可逆圧縮", "もとに戻せない", "JPEG・MP3・AAC", "写真や音楽のように、人が気づきにくい部分を捨ててよいデータに使います。そのぶん大きく減らせます。"]
  };

  const run = useMemo(() => runLength(runText.replace(/\s/g, "")), [runText]);
  const huff = useMemo(() => huffman(huffText), [huffText]);

  return (
    <>
      {card(
        0,
        "戻せる圧縮と、戻せない圧縮",
        "2つの圧縮を切り替えて、使いどころの違いを確かめます。",
        <>
          <Tabs
            value={kind}
            onChange={setKind}
            options={[
              { value: "lossless", label: "可逆圧縮" },
              { value: "lossy", label: "非可逆圧縮" }
            ]}
          />
          <div className="compress-flow">
            <div className="stage">
              <small>もとのデータ</small>
              <div className="bar full" />
              <b>100%</b>
            </div>
            <i>圧縮</i>
            <div className="stage">
              <small>圧縮後</small>
              <div className="bar" style={{ width: kind === "lossless" ? "60%" : "20%" }} />
              <b>{kind === "lossless" ? "60%" : "20%"}</b>
            </div>
            <i>展開</i>
            <div className="stage">
              <small>戻したデータ</small>
              <div className={`bar full ${kind === "lossy" ? "lossy" : ""}`} />
              <b>{kind === "lossless" ? "もとどおり" : "戻りきらない"}</b>
            </div>
          </div>
          <Results
            items={[
              { label: kinds[kind][0], value: kinds[kind][1], warn: kind === "lossy", note: "展開したとき、もとのデータと1ビットまで同じになるかどうか" },
              { label: "代表的な形式", value: kinds[kind][2], note: "この方式を使っているファイル形式" },
              { label: "圧縮率", value: kind === "lossless" ? "60%（あまり縮まない）" : "20%（よく縮む）", note: "圧縮後 ÷ 圧縮前 × 100。小さいほどよく縮んでいる" }
            ]}
          />
          <Verdict ok={kind === "lossless"}>
            選ぶ基準は1つ、「もとに完全に戻す必要があるか」です。1ビットも変えてはいけない文書やプログラムなら可逆圧縮、
            人が気づきにくい部分を捨ててよい写真や音楽なら非可逆圧縮を選びます。
            {kind === "lossless" ? "いま選んでいる可逆圧縮は、戻せるかわりに縮み方は控えめです。" : "いま選んでいる非可逆圧縮は、大きく縮むかわりに、もとには戻せません。"}
          </Verdict>
          <Hint>{kinds[kind][3]}</Hint>
        </>
      )}

      {card(
        1,
        "圧縮率を計算する",
        "圧縮前と圧縮後のデータ量を入れて、どれだけ縮んだかを求めます。",
        <>
          <Row>
            <NumberField label="圧縮前のデータ量" value={before} onChange={setBefore} min={1} max={1000000} unit="bit" />
            <NumberField label="圧縮後のデータ量" value={after} onChange={setAfter} min={1} max={1000000} unit="bit" />
          </Row>
          <Formula>圧縮率(%) ＝ 圧縮後のデータ量 ÷ 圧縮前のデータ量 × 100</Formula>
          <Results
            items={[
              { label: "圧縮率", value: `${fmt(compressionRate(after, before), 1)} %`, warn: after > before, note: "圧縮後 ÷ 圧縮前 × 100。小さいほどよく縮んでいる" },
              { label: "減った量", value: `${fmt(before - after, 0)} bit`, note: "圧縮前から圧縮後を引いた、消せたビット数" },
              { label: "何分の1になったか", value: `${fmt(before / Math.max(1, after), 2)} 分の1`, note: "圧縮前 ÷ 圧縮後。数が大きいほどよく縮んでいる" },
              { label: "判定", value: after > before ? "かえって増えている" : after === before ? "変わらない" : "縮んでいる", warn: after >= before, note: "圧縮後が圧縮前より小さくなっているかどうか" }
            ]}
          />
          <Hint>圧縮率の数値は、小さいほどよく縮んでいます。100%を超えたら、圧縮したのに増えてしまったということです。</Hint>
        </>
      )}

      {card(
        2,
        "ランレングス法で文字列を圧縮する",
        "同じ文字の連続を、その個数に置き換えます。文字を変えて試しましょう。",
        <>
          <TextField label="文字列を入力" value={runText} onChange={setRunText} hint="AとBだけにすると教科書の例になります" mono />
          <div className="run-view">
            {run.runs.map((r, i) => (
              <span key={i}>
                <b>{r.char}</b>
                <i>{r.count}</i>
              </span>
            ))}
          </div>
          <Steps
            items={[
              { label: "文字の種類", value: `${run.kinds} 種類`, note: `1文字 ${run.symbolBits} bit` },
              { label: "圧縮前", value: `${run.before} bit`, note: `${run.symbolBits} × ${run.chars}文字` },
              { label: "連続のかたまり", value: `${run.runs.length} 個`, note: `いちばん長い連続が ${run.maxCount} 個 → その数を表すのに ${run.countBits} bit 必要` },
              { label: "圧縮後（個数だけ）", value: `${run.afterCountOnly} bit`, note: `${run.countBits} × ${run.runs.length}` }
            ]}
          />
          <Results
            items={[
              { label: "圧縮率（個数だけ書く方法）", value: `${fmt(run.rateCountOnly, 1)} %`, warn: run.rateCountOnly >= 100, note: run.alternating ? "2種類が交互なので記号を省ける" : "この方式が使えるのは2種類が交互のときだけ" },
              { label: "圧縮率（文字と個数の両方を書く方法）", value: `${fmt(run.rateWithSymbol, 1)} %`, warn: run.rateWithSymbol >= 100, note: "3種類以上ならこちら" },
              { label: "置きかえた結果（文字＋個数）", value: <span className="mono">{run.runs.map((r) => `${r.char}${r.count}`).join("")}</span>, note: "連続のかたまりごとに、文字とその個数を並べたもの" }
            ]}
          />
          <Hint>
            「ABABABAB」のように1文字ずつ変わる文字列を入れると、圧縮率が100%を超えます。ランレングス法が効くのは、
            同じ値が長く続くデータだけです。
          </Hint>
          <HintButton id="compress-2-1">
            個数を記録するのに何ビット必要かは、いちばん長い連続の個数で決まります。連続が最大7個なら3ビット（0〜7）で足ります。教室の出席番号が40番までなら2けたで済むのと同じで、いちばん大きい数さえ入ればいいのです。
          </HintButton>
        </>
      )}

      

      {card(
        3,
        "ハフマン符号化で文字列を圧縮する",
        "よく出る文字ほど短い符号になります。文字の偏りを変えて試しましょう。",
        <>
          <TextField label="文字列を入力" value={huffText} onChange={setHuffText} mono hint="同じ文字を増やすと、より縮みます" />
          {huff ? (
            <>
              <DataTable
                head={["文字", "出現回数", "この文字に決まった0と1の並び", "ビット数", "合計"]}
                rows={huff.table.map((r) => [
                  r.char,
                  `${r.count} 回`,
                  <span key={r.char} className="mono">{r.code}</span>,
                  `${r.bits} bit`,
                  `${r.total} bit`
                ])}
              />
              <Steps
                items={[
                  { label: "文字の種類", value: `${huff.kinds} 種類`, note: `同じ長さなら1文字 ${huff.fixedBits} bit` },
                  { label: "圧縮前", value: `${huff.before} bit` },
                  { label: "圧縮後", value: `${huff.after} bit` }
                ]}
              />
              <Results
                items={[
                  { label: "圧縮率", value: `${fmt(huff.rate, 1)} %`, warn: huff.rate >= 100, note: "符号の合計ビット数 ÷ 圧縮前のビット数 × 100" },
                  { label: "いちばん短い符号", value: `${Math.min(...huff.table.map((r) => r.bits))} bit`, note: "いちばん多く出る文字についた" },
                  { label: "いちばん長い符号", value: `${Math.max(...huff.table.map((r) => r.bits))} bit`, note: "いちばん少ない文字についた" }
                ]}
              />
              <Hint>
                すべての文字が同じ回数なら、ハフマン符号化してもほとんど縮みません。出現回数のかたよりが大きいほど効果が出ます。
                JPEGやZIPの内部でも、この考え方が使われています。
              </Hint>
            </>
          ) : (
            <Verdict ok={false}>文字を入力してください。</Verdict>
          )}
        </>
      )}

      {card(
        4,
        "配布する教材データの圧縮方法を決める",
        "資料の種類ごとに、どの圧縮を使うかを決めます。",
        <AreaField
          label="決めた方法と、その根拠"
          value={missionNote}
          onChange={onMissionNote}
          placeholder="例：文章のPDFは1文字も変えられないのでZIP（可逆）。行事の写真はJPEG（非可逆・品質80）で約1/10に。説明音声はAAC（非可逆）。いずれも元データは無圧縮で別に保存しておく。"
          rows={5}
        />
      )}
    </>
  );
}

export const digitalLabs: Record<string, (props: LabProps) => ReactNode> = {
  feature: FeatureLab,
  base: BaseLab,
  negative: NegativeLab,
  real: RealLab,
  logic: LogicLab,
  computer: ComputerLab,
  text: TextLab,
  audio: AudioLab,
  image: ImageLab,
  video: VideoLab,
  compress: CompressLab
};
