// 情報Ⅰ Digital Lab（2・3年次） - 計算ライブラリ
// すべての実験の数値計算をここに集約する。UIからは純関数として呼び出す。

/* ============================================================
 * 共通ユーティリティ
 * ========================================================== */

export const fmt = (value: number, digits = 1) =>
  Number.isFinite(value) ? value.toLocaleString("ja-JP", { maximumFractionDigits: digits }) : "-";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** 半角/全角どちらで打っても数値列として読む */
export const parseNumbers = (raw: string): number[] =>
  raw
    .replace(/[０-９．，－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .split(/[\s,、\n\t]+/)
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));

/** 0と1だけを取り出してビット列にする */
export const parseBits = (raw: string, maxLength = 32): string =>
  raw.replace(/[^01]/g, "").slice(0, maxLength);

export const padBits = (bits: string, length: number) => bits.padStart(length, "0").slice(-length);

/* ============================================================
 * D1 基数変換・加算・シフト演算
 * ========================================================== */

/** 10進数（小数可）を指定基数の文字列にする */
export const toBase = (value: number, base: number, fractionDigits = 8): string => {
  if (!Number.isFinite(value)) return "-";
  const negative = value < 0;
  const abs = Math.abs(value);
  const intPart = Math.floor(abs);
  let fraction = abs - intPart;
  let out = intPart.toString(base).toUpperCase();
  if (fraction > 0) {
    out += ".";
    for (let i = 0; i < fractionDigits && fraction > 1e-12; i++) {
      fraction *= base;
      const digit = Math.floor(fraction);
      out += digit.toString(base).toUpperCase();
      fraction -= digit;
    }
  }
  return (negative ? "-" : "") + out;
};

/** 指定基数の文字列（小数可）を10進数にする */
export const fromBase = (text: string, base: number): number | null => {
  const clean = text.trim().replace(/[０-９Ａ-Ｆａ-ｆ．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!clean) return null;
  const negative = clean.startsWith("-");
  const body = negative ? clean.slice(1) : clean;
  const [intText, fracText = ""] = body.split(".");
  const digits = "0123456789ABCDEF".slice(0, base);
  let value = 0;
  for (const char of intText.toUpperCase()) {
    const index = digits.indexOf(char);
    if (index < 0) return null;
    value = value * base + index;
  }
  let scale = 1 / base;
  for (const char of fracText.toUpperCase()) {
    const index = digits.indexOf(char);
    if (index < 0) return null;
    value += index * scale;
    scale /= base;
  }
  return negative ? -value : value;
};

/** 2進数の筆算加算。桁ごとの繰り上がりも返す */
export const binaryAdd = (a: string, b: string, width = 8) => {
  const x = padBits(parseBits(a), width);
  const y = padBits(parseBits(b), width);
  const sum: string[] = [];
  const carries: string[] = [];
  let carry = 0;
  for (let i = width - 1; i >= 0; i--) {
    const total = Number(x[i]) + Number(y[i]) + carry;
    sum.unshift(String(total % 2));
    carry = total >= 2 ? 1 : 0;
    carries.unshift(String(carry));
  }
  return {
    a: x,
    b: y,
    sum: sum.join(""),
    carries: carries.join(""),
    overflow: carry === 1,
    full: (carry ? "1" : "") + sum.join(""),
    decimalA: parseInt(x, 2),
    decimalB: parseInt(y, 2),
    decimalSum: parseInt(x, 2) + parseInt(y, 2)
  };
};

export type ShiftKind = "logical" | "arithmetic";
export type ShiftDir = "left" | "right";

/** 論理シフト・算術シフト。空いたビットに入る値が変わる */
export const shiftBits = (bits: string, width: number, dir: ShiftDir, count: number, kind: ShiftKind) => {
  const source = padBits(parseBits(bits), width);
  const sign = source[0];
  let out = source;
  for (let i = 0; i < count; i++) {
    if (dir === "left") {
      out = out.slice(1) + "0";
    } else {
      const fill = kind === "arithmetic" ? sign : "0";
      out = fill + out.slice(0, -1);
    }
  }
  const before = kind === "arithmetic" ? signedValue(source) : parseInt(source, 2);
  const after = kind === "arithmetic" ? signedValue(out) : parseInt(out, 2);
  return { before: source, after: out, beforeValue: before, afterValue: after };
};

/* ============================================================
 * D2 補数（負の数の表現）
 * ========================================================== */

export const onesComplement = (bits: string) =>
  bits
    .split("")
    .map((bit) => (bit === "0" ? "1" : "0"))
    .join("");

export const twosComplement = (bits: string, width = 8) => {
  const source = padBits(parseBits(bits), width);
  const flipped = onesComplement(source);
  const added = binaryAdd(flipped, padBits("1", width), width);
  return { source, flipped, result: added.sum, carry: added.overflow };
};

/** 2の補数表現のビット列を符号付き10進数として読む */
export const signedValue = (bits: string) => {
  const width = bits.length;
  const raw = parseInt(bits, 2);
  return bits[0] === "1" ? raw - 2 ** width : raw;
};

/** 10進数を指定ビット幅の2の補数表現にする。範囲外なら null */
export const toSignedBits = (value: number, width = 8): string | null => {
  const min = -(2 ** (width - 1));
  const max = 2 ** (width - 1) - 1;
  if (!Number.isInteger(value) || value < min || value > max) return null;
  const raw = value < 0 ? value + 2 ** width : value;
  return padBits(raw.toString(2), width);
};

/** n進法の補数（例：10の補数）。次の桁になるまでに必要な数 */
export const radixComplement = (value: number, base: number, digits: number) =>
  base ** digits - value;

/* ============================================================
 * D3 実数（固定小数点・浮動小数点）
 * ========================================================== */

/** IEEE754 単精度（32bit）に分解する */
export const toFloat32 = (value: number) => {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value);
  const raw = view.getUint32(0);
  const bits = raw.toString(2).padStart(32, "0");
  const sign = bits.slice(0, 1);
  const exponent = bits.slice(1, 9);
  const mantissa = bits.slice(9);
  const exponentValue = parseInt(exponent, 2);
  return {
    bits,
    sign,
    exponent,
    mantissa,
    exponentValue,
    /** 実際の指数 ＝ 格納値 − 127（バイアス） */
    realExponent: exponentValue === 0 ? -126 : exponentValue - 127,
    stored: view.getFloat32(0),
    /** 元の値との差（丸め誤差） */
    error: view.getFloat32(0) - value
  };
};

/** 正規化：-10.25 → 符号 / 1.xxxx / 指数 の形にほどく */
export const normalizeBinary = (value: number, fractionDigits = 12) => {
  const negative = value < 0;
  const abs = Math.abs(value);
  if (abs === 0) return { negative, mantissa: "0", exponent: 0, binary: "0" };
  const binary = toBase(abs, 2, fractionDigits);
  const [intPart, fracPart = ""] = binary.split(".");
  let exponent: number;
  let digits: string;
  if (intPart !== "0") {
    exponent = intPart.length - 1;
    digits = (intPart + fracPart).replace(/^0+/, "");
  } else {
    const firstOne = fracPart.indexOf("1");
    exponent = -(firstOne + 1);
    digits = fracPart.slice(firstOne);
  }
  return {
    negative,
    binary,
    exponent,
    /** 1.xxxx の形の仮数 */
    mantissa: digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits
  };
};

/* ============================================================
 * D4 論理回路・加算器
 * ========================================================== */

export type Gate = "NOT" | "AND" | "OR" | "NAND" | "NOR" | "XOR" | "XNOR";

export const gateOutput = (gate: Gate, a: boolean, b: boolean): boolean => {
  switch (gate) {
    case "NOT":
      return !a;
    case "AND":
      return a && b;
    case "OR":
      return a || b;
    case "NAND":
      return !(a && b);
    case "NOR":
      return !(a || b);
    case "XOR":
      return a !== b;
    default:
      return a === b;
  }
};

/** 教科書の表記。論理積は「・」、論理和は「＋」、否定は上線（ここでは NOT で示す） */
export const gateFormula: Record<Gate, string> = {
  NOT: "F ＝ NOT A",
  AND: "F ＝ A・B",
  OR: "F ＝ A＋B",
  NAND: "F ＝ NOT(A・B)",
  NOR: "F ＝ NOT(A＋B)",
  XOR: "F ＝ A・NOT(B) ＋ NOT(A)・B",
  XNOR: "F ＝ NOT( A・NOT(B) ＋ NOT(A)・B )"
};

/** NANDゲートだけで他のゲートを作る組み立て方 */
export const nandRecipe: Record<Gate, { steps: string[]; count: number }> = {
  NOT: { steps: ["A と A を NAND に入れる"], count: 1 },
  AND: { steps: ["A・B を NAND に入れる", "その出力を NOT（NAND）に通す"], count: 2 },
  OR: { steps: ["A を NOT（NAND）にする", "B を NOT（NAND）にする", "2つの出力を NAND に入れる"], count: 3 },
  NAND: { steps: ["そのまま NAND を1つ使う"], count: 1 },
  NOR: { steps: ["OR を NAND 3つで作る", "その出力を NOT（NAND）に通す"], count: 4 },
  XOR: { steps: ["A・B の NAND を求める（これを C とする）", "A と C の NAND を求める", "B と C の NAND を求める", "2つの出力を NAND に入れる"], count: 4 },
  XNOR: { steps: ["XOR を NAND 4つで作る", "その出力を NOT（NAND）に通す"], count: 5 }
};

/** NANDゲートだけで組んだ回路の出力（正しく等価になっているかの検算用） */
export const nandOnly = (gate: Gate, a: boolean, b: boolean): boolean => {
  const nand = (x: boolean, y: boolean) => !(x && y);
  switch (gate) {
    case "NOT":
      return nand(a, a);
    case "AND":
      return nand(nand(a, b), nand(a, b));
    case "OR":
      return nand(nand(a, a), nand(b, b));
    case "NAND":
      return nand(a, b);
    case "NOR": {
      const or = nand(nand(a, a), nand(b, b));
      return nand(or, or);
    }
    case "XOR": {
      const c = nand(a, b);
      return nand(nand(a, c), nand(b, c));
    }
    default: {
      const c = nand(a, b);
      const xor = nand(nand(a, c), nand(b, c));
      return nand(xor, xor);
    }
  }
};

/** 10進数を2で割り続けて余りを並べる、教科書の変換手順 */
export const divisionLadder = (value: number, base = 2) => {
  const rows: { dividend: number; quotient: number; remainder: number }[] = [];
  let n = Math.max(0, Math.floor(value));
  if (n === 0) return { rows: [{ dividend: 0, quotient: 0, remainder: 0 }], digits: "0" };
  while (n > 0) {
    const quotient = Math.floor(n / base);
    rows.push({ dividend: n, quotient, remainder: n % base });
    n = quotient;
  }
  const digits = rows
    .map((r) => r.remainder.toString(base).toUpperCase())
    .reverse()
    .join("");
  return { rows, digits };
};

/** 半加算器：XORで和、ANDで桁上がり */
export const halfAdder = (x: boolean, y: boolean) => ({
  s: x !== y,
  c: x && y
});

/** 全加算器：半加算器2つ＋ORで構成 */
export const fullAdder = (x: boolean, y: boolean, ci: boolean) => {
  const first = halfAdder(x, y);
  const second = halfAdder(first.s, ci);
  return { s: second.s, co: first.c || second.c, inner: { first, second } };
};

/** 全加算器を並べた nビット加算器 */
export const rippleAdder = (a: string, b: string, width: number) => {
  const x = padBits(parseBits(a), width);
  const y = padBits(parseBits(b), width);
  const stages: { x: number; y: number; ci: number; s: number; co: number }[] = [];
  let carry = false;
  for (let i = width - 1; i >= 0; i--) {
    const result = fullAdder(x[i] === "1", y[i] === "1", carry);
    stages.unshift({ x: Number(x[i]), y: Number(y[i]), ci: Number(carry), s: Number(result.s), co: Number(result.co) });
    carry = result.co;
  }
  return { x, y, stages, sum: stages.map((s) => s.s).join(""), carryOut: carry };
};

/* ============================================================
 * D5 コンピュータの構成と性能
 * ========================================================== */

/** クロック周波数(GHz)とCPI から MIPS を求める */
export const toMips = (clockGHz: number, cpi: number) => (clockGHz * 1000) / Math.max(0.01, cpi);

/** 1命令の実行時間（ナノ秒） */
export const instructionTimeNs = (clockGHz: number, cpi: number) => cpi / Math.max(0.001, clockGHz);

/** キャッシュのヒット率から実効アクセス時間を求める */
export const effectiveAccess = (hitRate: number, cacheNs: number, mainNs: number) =>
  hitRate * cacheNs + (1 - hitRate) * mainNs;

/* ============================================================
 * D6 文字の表現
 * ========================================================== */

export const asciiInfo = (char: string) => {
  const code = char.codePointAt(0) ?? 0;
  return {
    char,
    dec: code,
    hex: code.toString(16).toUpperCase().padStart(2, "0"),
    bin: code.toString(2).padStart(8, "0"),
    ascii: code < 128
  };
};

export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

/** Shift_JIS の概算バイト数（ASCIIと半角カナは1、それ以外は2） */
export const sjisBytes = (text: string) =>
  Array.from(text).reduce((sum, char) => {
    const code = char.codePointAt(0) ?? 0;
    const half = code < 0x80 || (code >= 0xff61 && code <= 0xff9f);
    return sum + (half ? 1 : 2);
  }, 0);

/** UTF-16 の概算バイト数（サロゲートペアは4） */
export const utf16Bytes = (text: string) => text.length * 2;

/** nビットで表せる文字の種類数 */
export const charVariations = (bits: number) => 2 ** bits;

/* ============================================================
 * D7/D8/D9 音声・画像・動画のデータ量
 * ========================================================== */

/** 非圧縮音声のバイト数 ＝ 標本化周波数 × 量子化bit ÷ 8 × ch × 秒 */
export const audioBytes = (sampleRateHz: number, bits: number, channels: number, seconds: number) =>
  (sampleRateHz * bits * channels * seconds) / 8;

/** 標本化定理：再現できる最高周波数は標本化周波数の半分 */
export const nyquist = (sampleRateHz: number) => sampleRateHz / 2;

/** 非圧縮画像のバイト数 ＝ 縦 × 横 × 色情報bit ÷ 8 */
export const imageBytes = (width: number, height: number, colorBits: number) =>
  (width * height * colorBits) / 8;

/** cm と dpi から画素数を求める（1inch = 2.54cm） */
export const dpiToDots = (cm: number, dpi: number) => (cm / 2.54) * dpi;

/** 非圧縮動画のバイト数 ＝ 1フレームのバイト数 × fps × 秒 */
export const videoBytes = (
  width: number,
  height: number,
  colorBits: number,
  fps: number,
  seconds: number
) => imageBytes(width, height, colorBits) * fps * seconds;

/** バイト数を KB/MB/GB に段階表示（1000進 と 1024進 の両方） */
export const byteSteps = (bytes: number) => ({
  bytes,
  kb: bytes / 1000,
  mb: bytes / 1000 ** 2,
  gb: bytes / 1000 ** 3,
  kib: bytes / 1024,
  mib: bytes / 1024 ** 2,
  gib: bytes / 1024 ** 3
});

/** データ量(byte)と通信速度(Mbps)から転送時間(秒)を求める */
export const transferSeconds = (bytes: number, mbps: number) => (bytes * 8) / (mbps * 1_000_000);

/** 必要な帯域幅(bps) */
export const requiredBps = (bytesPerSecond: number) => bytesPerSecond * 8;

/* ============================================================
 * A1/A2 度数分布・代表値・四分位数
 * ========================================================== */

export type Summary = {
  values: number[];
  n: number;
  sum: number;
  mean: number;
  median: number;
  modes: number[];
  min: number;
  max: number;
  range: number;
  q1: number;
  q2: number;
  q3: number;
  iqr: number;
  qd: number;
  variance: number;
  sd: number;
  /** 不偏分散（n-1で割る） */
  uVariance: number;
  uSd: number;
  lowerFence: number;
  upperFence: number;
  outliers: number[];
};

/** Excel の QUARTILE.INC と同じ線形補間で四分位数を求める */
export const quartileInc = (sorted: number[], quart: 0 | 1 | 2 | 3 | 4): number => {
  const n = sorted.length;
  if (!n) return NaN;
  if (n === 1) return sorted[0];
  const position = (quart / 4) * (n - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (position - lower) * (sorted[upper] - sorted[lower]);
};

export const summarize = (input: number[] | string): Summary | null => {
  const values = Array.isArray(input) ? [...input] : parseNumbers(input);
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const uVariance = n > 1 ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : NaN;
  const counts = new Map<number, number>();
  sorted.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const maxCount = Math.max(...counts.values());
  const modes = maxCount > 1 ? [...counts.entries()].filter(([, c]) => c === maxCount).map(([v]) => v) : [];
  const q1 = quartileInc(sorted, 1);
  const q2 = quartileInc(sorted, 2);
  const q3 = quartileInc(sorted, 3);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  return {
    values: sorted,
    n,
    sum,
    mean,
    median: q2,
    modes,
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    q1,
    q2,
    q3,
    iqr,
    qd: iqr / 2,
    variance,
    sd: Math.sqrt(variance),
    uVariance,
    uSd: Math.sqrt(uVariance),
    lowerFence,
    upperFence,
    outliers: sorted.filter((v) => v < lowerFence || v > upperFence)
  };
};

/** 度数分布表を作る */
export const histogram = (values: number[], binWidth: number, start?: number) => {
  if (!values.length || binWidth <= 0) return [];
  const min = start ?? Math.floor(Math.min(...values) / binWidth) * binWidth;
  const max = Math.max(...values);
  const bins: { from: number; to: number; mid: number; count: number; relative: number }[] = [];
  for (let from = min; from <= max; from += binWidth) {
    const to = from + binWidth;
    const count = values.filter((v) => v >= from && v < to + (to > max ? 1e-9 : 0)).length;
    bins.push({ from, to, mid: (from + to) / 2, count, relative: count / values.length });
  }
  // 最大値が最終階級の上限と一致する場合を拾う
  const covered = bins.reduce((a, b) => a + b.count, 0);
  if (covered < values.length && bins.length) bins[bins.length - 1].count += values.length - covered;
  return bins.map((b) => ({ ...b, relative: b.count / values.length }));
};

/** 加重平均 */
export const weightedMean = (values: number[], weights: number[]) => {
  const n = Math.min(values.length, weights.length);
  let top = 0;
  let bottom = 0;
  for (let i = 0; i < n; i++) {
    top += values[i] * weights[i];
    bottom += weights[i];
  }
  return bottom === 0 ? NaN : top / bottom;
};

/** 幾何平均（変化率の平均） */
export const geometricMean = (values: number[]) => {
  if (!values.length || values.some((v) => v <= 0)) return NaN;
  return Math.exp(values.reduce((a, v) => a + Math.log(v), 0) / values.length);
};

/** 調和平均（単位あたりの量の平均） */
export const harmonicMean = (values: number[]) => {
  if (!values.length || values.some((v) => v === 0)) return NaN;
  return values.length / values.reduce((a, v) => a + 1 / v, 0);
};

/* ============================================================
 * A3/A4 標準化・偏差値・正規分布
 * ========================================================== */

export const zScore = (value: number, mean: number, sd: number) => (value - mean) / (sd || 1);
export const tScore = (value: number, mean: number, sd: number) => 50 + 10 * zScore(value, mean, sd);

/** 正規分布の確率密度（Excel の NORM.DIST(..., FALSE)） */
export const normalPdf = (x: number, mean = 0, sd = 1) =>
  Math.exp(-((x - mean) ** 2) / (2 * sd ** 2)) / (sd * Math.sqrt(2 * Math.PI));

/** 誤差関数（Abramowitz & Stegun 7.1.26 相当の高精度版） */
const erf = (x: number): number => {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.5 * ax);
  const y =
    t *
    Math.exp(
      -ax * ax -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return sign * (1 - y);
};

/** 正規分布の累積確率（Excel の NORM.DIST(..., TRUE)） */
export const normalCdf = (x: number, mean = 0, sd = 1) =>
  0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));

/** 二項分布の確率 */
export const binomialPmf = (n: number, k: number, p: number) => {
  if (k < 0 || k > n) return 0;
  let logC = 0;
  for (let i = 1; i <= k; i++) logC += Math.log(n - k + i) - Math.log(i);
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
};

/* ============================================================
 * A5 相関・回帰
 * ========================================================== */

export const covariance = (xs: number[], ys: number[]) => {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (xs[i] - mx) * (ys[i] - my);
  return sum / n;
};

export const correlation = (xs: number[], ys: number[]) => {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  const sx = summarize(xs.slice(0, n));
  const sy = summarize(ys.slice(0, n));
  if (!sx || !sy || sx.sd === 0 || sy.sd === 0) return NaN;
  return covariance(xs, ys) / (sx.sd * sy.sd);
};

/** 最小二乗法による回帰直線 y = ax + b */
export const regression = (xs: number[], ys: number[]) => {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const sx = summarize(xs.slice(0, n))!;
  const sy = summarize(ys.slice(0, n))!;
  if (sx.variance === 0) return null;
  const a = covariance(xs, ys) / sx.variance;
  const b = sy.mean - a * sx.mean;
  const r = correlation(xs, ys);
  return { a, b, r, r2: r * r };
};

export const correlationLabel = (r: number) => {
  const abs = Math.abs(r);
  if (!Number.isFinite(r)) return "判定できません";
  const strength = abs >= 0.7 ? "強い" : abs >= 0.4 ? "やや強い" : abs >= 0.2 ? "弱い" : "ほとんどない";
  if (abs < 0.2) return "相関はほとんどない";
  return `${strength}${r > 0 ? "正" : "負"}の相関`;
};

/* ============================================================
 * A7 仮説検定（Z検定・t検定・カイ二乗検定）
 * ========================================================== */

const gammaLn = (x: number): number => {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2,
    -0.5395239384953e-5
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
};

/** 正則不完全ベータ関数（連分数展開） */
const betacf = (a: number, b: number, x: number): number => {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
};

const betaInc = (a: number, b: number, x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
};

/** t分布の累積確率 P(T <= t) */
export const tCdf = (t: number, df: number): number => {
  if (df <= 0) return NaN;
  const x = df / (df + t * t);
  const p = 0.5 * betaInc(df / 2, 0.5, x);
  return t > 0 ? 1 - p : p;
};

/** t検定の両側p値 */
export const tTwoSidedP = (t: number, df: number) => 2 * (1 - tCdf(Math.abs(t), df));

/** t分布の確率密度 */
export const tPdf = (t: number, df: number) =>
  Math.exp(gammaLn((df + 1) / 2) - gammaLn(df / 2)) /
  Math.sqrt(df * Math.PI) /
  (1 + (t * t) / df) ** ((df + 1) / 2);

/** t分布の臨界値。two=true なら両側、false なら片側 */
export const tCritical = (df: number, alpha = 0.05, two = true) => {
  const target = two ? 1 - alpha / 2 : 1 - alpha;
  let low = 0;
  let high = 400;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (tCdf(mid, df) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

/** 標準正規分布の臨界値。two=true なら両側、false なら片側 */
export const zCritical = (alpha = 0.05, two = true) => {
  const target = two ? 1 - alpha / 2 : 1 - alpha;
  let low = 0;
  let high = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (normalCdf(mid) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

/** 正則不完全ガンマ関数 P(a, x) */
const gammaP = (a: number, x: number): number => {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 300; n++) {
      ap++;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a));
  }
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaLn(a)) * h;
};

/** カイ二乗分布の上側確率（Excel の CHISQ.DIST.RT） */
export const chiSquareP = (chi2: number, df: number) => (chi2 <= 0 ? 1 : 1 - gammaP(df / 2, chi2 / 2));

/** 1標本 Z検定（母標準偏差が既知） */
export const zTest = (values: number[], mu0: number, sigma: number) => {
  const s = summarize(values);
  if (!s || sigma <= 0) return null;
  const se = sigma / Math.sqrt(s.n);
  const z = (s.mean - mu0) / se;
  const oneSided = 1 - normalCdf(Math.abs(z));
  return { n: s.n, mean: s.mean, se, z, pOne: oneSided, pTwo: 2 * oneSided };
};

/** 1標本 t検定（母分散が未知） */
export const tTest1 = (values: number[], mu0: number) => {
  const s = summarize(values);
  if (!s || s.n < 2) return null;
  const se = s.uSd / Math.sqrt(s.n);
  const t = (s.mean - mu0) / se;
  const df = s.n - 1;
  return { n: s.n, mean: s.mean, uSd: s.uSd, se, t, df, pTwo: tTwoSidedP(t, df), pOne: tTwoSidedP(t, df) / 2 };
};

/** 対応のある t検定（同じ人の前後比較） */
export const tTestPaired = (a: number[], b: number[]) => {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const diff = Array.from({ length: n }, (_, i) => a[i] - b[i]);
  const result = tTest1(diff, 0);
  return result ? { ...result, diff } : null;
};

/** 対応のない t検定（Welch法：分散が等しいと仮定しない） */
export const tTestWelch = (a: number[], b: number[]) => {
  const sa = summarize(a);
  const sb = summarize(b);
  if (!sa || !sb || sa.n < 2 || sb.n < 2) return null;
  const se = Math.sqrt(sa.uVariance / sa.n + sb.uVariance / sb.n);
  const t = (sa.mean - sb.mean) / se;
  const df =
    (sa.uVariance / sa.n + sb.uVariance / sb.n) ** 2 /
    ((sa.uVariance / sa.n) ** 2 / (sa.n - 1) + (sb.uVariance / sb.n) ** 2 / (sb.n - 1));
  return { meanA: sa.mean, meanB: sb.mean, se, t, df, pTwo: tTwoSidedP(t, df) };
};

/** 2×2 クロス集計表の独立性の検定 */
export const chiSquareTest = (table: number[][]) => {
  const rows = table.length;
  const cols = table[0]?.length ?? 0;
  if (!rows || !cols) return null;
  const rowSums = table.map((row) => row.reduce((a, b) => a + b, 0));
  const colSums = Array.from({ length: cols }, (_, j) => table.reduce((a, row) => a + row[j], 0));
  const total = rowSums.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const expected = table.map((row, i) => row.map((_, j) => (rowSums[i] * colSums[j]) / total));
  let chi2 = 0;
  table.forEach((row, i) =>
    row.forEach((observed, j) => {
      const e = expected[i][j];
      if (e > 0) chi2 += (observed - e) ** 2 / e;
    })
  );
  const df = (rows - 1) * (cols - 1);
  // 調整済み標準化残差
  const residuals = table.map((row, i) =>
    row.map((observed, j) => {
      const e = expected[i][j];
      const denominator = Math.sqrt(e * (1 - rowSums[i] / total) * (1 - colSums[j] / total));
      return denominator === 0 ? 0 : (observed - e) / denominator;
    })
  );
  return { expected, chi2, df, p: chiSquareP(chi2, df), rowSums, colSums, total, residuals };
};

/** t分布による母平均の信頼区間 */
export const confidenceInterval = (values: number[], level = 0.95) => {
  const s = summarize(values);
  if (!s || s.n < 2) return null;
  const df = s.n - 1;
  const se = s.uSd / Math.sqrt(s.n);
  // 両側 level の臨界t値を二分法で求める
  const target = 1 - (1 - level) / 2;
  let low = 0;
  let high = 100;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (tCdf(mid, df) < target) low = mid;
    else high = mid;
  }
  const tCritical = (low + high) / 2;
  const margin = tCritical * se;
  return { mean: s.mean, se, df, tCritical, margin, lower: s.mean - margin, upper: s.mean + margin };
};

/* ============================================================
 * A6 乱数・シミュレーション
 * ========================================================== */

/** 再現できる擬似乱数（seed を変えると系列が変わる） */
export const seededRandom = (seed: number) => {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
};

export const rollDice = (times: number, seed: number, faces = 6) => {
  const random = seededRandom(seed);
  const counts = new Array(faces).fill(0);
  for (let i = 0; i < times; i++) counts[Math.floor(random() * faces)]++;
  return counts.map((count, index) => ({
    face: index + 1,
    count,
    relative: times ? count / times : 0,
    theory: 1 / faces
  }));
};

/** モンテカルロ法で円周率を近似する */
export const monteCarloPi = (points: number, seed: number) => {
  const random = seededRandom(seed);
  let inside = 0;
  const samples: { x: number; y: number; inside: boolean }[] = [];
  for (let i = 0; i < points; i++) {
    const x = random();
    const y = random();
    const hit = x * x + y * y <= 1;
    if (hit) inside++;
    if (samples.length < 400) samples.push({ x, y, inside: hit });
  }
  return { inside, points, pi: points ? (4 * inside) / points : 0, samples };
};

/* ============================================================
 * A8 時系列
 * ========================================================== */

export const movingAverage = (values: number[], window: number, centered = true) =>
  values.map((_, index) => {
    if (window < 1) return null;
    const half = Math.floor(window / 2);
    const start = centered ? index - half : index - window + 1;
    const end = start + window;
    if (start < 0 || end > values.length) return null;
    return values.slice(start, end).reduce((a, b) => a + b, 0) / window;
  });

/** 線形トレンド（年 → 値の回帰直線） */
export const trendLine = (values: number[]) => {
  const xs = values.map((_, index) => index);
  return regression(xs, values);
};

/* ============================================================
 * D10 データの圧縮
 * ========================================================== */

/** 圧縮率(%) ＝ 圧縮後のデータ量 ÷ 圧縮前のデータ量 × 100 */
export const compressionRate = (after: number, before: number) =>
  before === 0 ? NaN : (after / before) * 100;

/** 同じ文字が連続する部分をまとめる（ランレングス法） */
export const runLength = (text: string) => {
  const chars = Array.from(text);
  const runs: { char: string; count: number }[] = [];
  for (const char of chars) {
    const last = runs[runs.length - 1];
    if (last && last.char === char) last.count += 1;
    else runs.push({ char, count: 1 });
  }
  const kinds = new Set(chars).size;
  const symbolBits = Math.max(1, Math.ceil(Math.log2(Math.max(2, kinds))));
  const maxCount = runs.length ? Math.max(...runs.map((r) => r.count)) : 0;
  const countBits = Math.max(1, Math.ceil(Math.log2(maxCount + 1)));
  const before = symbolBits * chars.length;
  /** 記号と個数の両方を記録する方式 */
  const afterWithSymbol = (symbolBits + countBits) * runs.length;
  /** 2種類が交互に現れると決めておき、個数だけを記録する方式 */
  const afterCountOnly = countBits * runs.length;
  const alternating = kinds <= 2 && runs.every((run, index) => index === 0 || run.char !== runs[index - 1].char);
  return {
    runs,
    chars: chars.length,
    kinds,
    symbolBits,
    countBits,
    maxCount,
    before,
    afterWithSymbol,
    afterCountOnly,
    alternating,
    rateWithSymbol: compressionRate(afterWithSymbol, before),
    rateCountOnly: compressionRate(afterCountOnly, before)
  };
};

type HuffNode = {
  weight: number;
  char?: string;
  left?: HuffNode;
  right?: HuffNode;
};

/** ハフマン符号化。出現頻度の高い文字ほど短い符号になる */
export const huffman = (text: string) => {
  const chars = Array.from(text).filter((c) => c.trim() !== "");
  if (!chars.length) return null;
  const freq = new Map<string, number>();
  chars.forEach((c) => freq.set(c, (freq.get(c) ?? 0) + 1));
  const kinds = freq.size;
  const fixedBits = Math.max(1, Math.ceil(Math.log2(Math.max(2, kinds))));
  const before = fixedBits * chars.length;

  if (kinds === 1) {
    const only = [...freq.keys()][0];
    return {
      table: [{ char: only, count: chars.length, code: "0", bits: 1, total: chars.length }],
      kinds,
      fixedBits,
      before,
      after: chars.length,
      rate: compressionRate(chars.length, before)
    };
  }

  // 重みの小さい2つを繰り返し結合してハフマン木を作る
  let nodes: HuffNode[] = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([char, weight]) => ({ char, weight }));
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.weight - b.weight);
    const left = nodes.shift()!;
    const right = nodes.shift()!;
    nodes.push({ weight: left.weight + right.weight, left, right });
  }
  const codes = new Map<string, string>();
  const walk = (node: HuffNode, prefix: string) => {
    if (node.char !== undefined) {
      codes.set(node.char, prefix || "0");
      return;
    }
    if (node.left) walk(node.left, prefix + "0");
    if (node.right) walk(node.right, prefix + "1");
  };
  walk(nodes[0], "");

  const table = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([char, count]) => {
      const code = codes.get(char) ?? "";
      return { char, count, code, bits: code.length, total: code.length * count };
    });
  const after = table.reduce((sum, row) => sum + row.total, 0);
  return { table, kinds, fixedBits, before, after, rate: compressionRate(after, before) };
};
