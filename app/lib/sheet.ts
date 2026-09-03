// ブラウザの中だけで動く、小さな表計算。
//
// 本物のExcelではありませんが、「関数名」と「範囲の指定」を打ちこんで
// 答えが出るところまでは同じように練習できます。
//
// 使える形
//   =SUM(B2:B11)        関数と範囲
//   =AVERAGE(B2:B11)*2  計算と組み合わせ
//   =B2+B3              セルどうしの計算
//   =COUNTIF(C2:C11,">=60")   条件つきの数え上げ
//
// 使えない形（この練習では出しません）
//   絶対参照（$）、複数シート、IF、VLOOKUP など

export type SheetData = {
  /** 見出しの行。A列・B列…の順 */
  header: string[];
  /** 2行目以降の中身。数値でも文字でもよい */
  rows: (number | string)[][];
};

export type SheetEval = { ok: true; value: number | string } | { ok: false; error: string };

const COLUMNS = "ABCDEFGHIJKLMN";

/** "B3" → { col: 1, row: 2 }（0始まり） */
const parseRef = (text: string) => {
  const m = /^([A-N])(\d+)$/.exec(text.toUpperCase());
  if (!m) return null;
  return { col: COLUMNS.indexOf(m[1]), row: Number(m[2]) - 1 };
};

/** 表の中身を1つ取り出す。1行目は見出しなので row=0 が見出しになる */
export const cellValue = (data: SheetData, col: number, row: number): number | string => {
  if (row === 0) return data.header[col] ?? "";
  const line = data.rows[row - 1];
  if (!line) return "";
  const v = line[col];
  return v === undefined ? "" : v;
};

/* ============================================================
 * 式を読み取る
 * ========================================================== */

type Token = { kind: "num" | "op" | "name" | "ref" | "range" | "str" | "paren" | "comma"; text: string };

const tokenize = (src: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let t = "";
      while (i < src.length && /[0-9.]/.test(src[i])) t += src[i++];
      tokens.push({ kind: "num", text: t });
      continue;
    }
    if (c === '"') {
      let t = "";
      i++;
      while (i < src.length && src[i] !== '"') t += src[i++];
      i++;
      tokens.push({ kind: "str", text: t });
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      let t = "";
      while (i < src.length && /[A-Za-z0-9_.]/.test(src[i])) t += src[i++];
      // B2:B11 のような範囲
      if (src[i] === ":" && /^[A-Na-n]\d+$/.test(t)) {
        let t2 = "";
        i++;
        while (i < src.length && /[A-Za-z0-9]/.test(src[i])) t2 += src[i++];
        tokens.push({ kind: "range", text: `${t}:${t2}` });
        continue;
      }
      if (/^[A-Na-n]\d+$/.test(t)) tokens.push({ kind: "ref", text: t });
      else tokens.push({ kind: "name", text: t.toUpperCase() });
      continue;
    }
    if ("+-*/^".includes(c)) {
      tokens.push({ kind: "op", text: c });
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      tokens.push({ kind: "paren", text: c });
      i++;
      continue;
    }
    if (c === "," || c === "、") {
      tokens.push({ kind: "comma", text: "," });
      i++;
      continue;
    }
    throw new Error(`「${c}」は使えない記号です`);
  }
  return tokens;
};

/* ---------- 統計の計算 ---------- */

const numbersOnly = (values: (number | string)[]) =>
  values.map((v) => (typeof v === "number" ? v : Number(String(v).replace(/,/g, "")))).filter((v) => Number.isFinite(v));

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const mode = (xs: number[]) => {
  const map = new Map<number, number>();
  xs.forEach((v) => map.set(v, (map.get(v) ?? 0) + 1));
  let best = NaN;
  let bestCount = 1;
  map.forEach((count, v) => {
    if (count > bestCount || (count === bestCount && v < best)) {
      best = v;
      bestCount = count;
    }
  });
  return best;
};

const variance = (xs: number[], sample: boolean) => {
  const m = mean(xs);
  const n = sample ? xs.length - 1 : xs.length;
  if (n <= 0) return NaN;
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / n;
};

const correl = (xs: number[], ys: number[]) => {
  const n = Math.min(xs.length, ys.length);
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
};

/** ">=60" や "男" のような条件に合うかどうか */
const matches = (value: number | string, cond: string) => {
  const m = /^(>=|<=|<>|>|<|=)?(.*)$/.exec(cond.trim());
  const op = m?.[1] ?? "=";
  const target = m?.[2] ?? "";
  const num = Number(target);
  if (Number.isFinite(num) && target !== "") {
    const v = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(v)) return false;
    switch (op) {
      case ">=":
        return v >= num;
      case "<=":
        return v <= num;
      case ">":
        return v > num;
      case "<":
        return v < num;
      case "<>":
        return v !== num;
      default:
        return v === num;
    }
  }
  const v = String(value);
  return op === "<>" ? v !== target : v === target;
};

/* ---------- 関数の一覧 ---------- */

export const SHEET_FUNCTIONS = [
  "SUM",
  "AVERAGE",
  "MEDIAN",
  "MODE.SNGL",
  "MAX",
  "MIN",
  "COUNT",
  "COUNTA",
  "COUNTIF",
  "STDEV.P",
  "STDEV.S",
  "VAR.P",
  "VAR.S",
  "CORREL",
  "ROUND",
  "ABS",
  "SQRT"
] as const;

/* ---------- 評価 ---------- */

export const evaluateFormula = (data: SheetData, formula: string): SheetEval => {
  const src = formula.trim();
  if (!src) return { ok: false, error: "式が空です" };
  if (!src.startsWith("=")) return { ok: false, error: "式は「=」から始めます（例: =SUM(B2:B11)）" };

  let tokens: Token[];
  try {
    tokens = tokenize(src.slice(1));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  const rangeValues = (text: string): (number | string)[] => {
    const [a, b] = text.split(":");
    const ra = parseRef(a);
    const rb = parseRef(b);
    if (!ra || !rb) throw new Error(`「${text}」は範囲として読めません`);
    const out: (number | string)[] = [];
    for (let r = Math.min(ra.row, rb.row); r <= Math.max(ra.row, rb.row); r++) {
      for (let c = Math.min(ra.col, rb.col); c <= Math.max(ra.col, rb.col); c++) {
        out.push(cellValue(data, c, r));
      }
    }
    return out;
  };

  /** 関数の引数。範囲・数値・文字のどれか */
  type Arg = { values: (number | string)[]; raw: number | string | null };

  const parseArg = (): Arg => {
    const t = peek();
    if (t && t.kind === "range") {
      take();
      return { values: rangeValues(t.text), raw: null };
    }
    if (t && t.kind === "str") {
      take();
      return { values: [t.text], raw: t.text };
    }
    const v = expr();
    return { values: [v], raw: v };
  };

  const callFunction = (name: string): number => {
    if (!peek() || peek().kind !== "paren" || peek().text !== "(") throw new Error(`${name} のうしろに ( がありません`);
    take();
    const args: Arg[] = [];
    if (peek() && peek().kind === "paren" && peek().text === ")") {
      take();
    } else {
      for (;;) {
        args.push(parseArg());
        const t = take();
        if (!t) throw new Error(") が足りません");
        if (t.kind === "comma") continue;
        if (t.kind === "paren" && t.text === ")") break;
        throw new Error("引数の区切りが読めません");
      }
    }
    const flat = args.flatMap((a) => a.values);
    const nums = numbersOnly(flat);
    switch (name) {
      case "SUM":
        return nums.reduce((a, b) => a + b, 0);
      case "AVERAGE":
        if (!nums.length) throw new Error("平均を求める数値がありません");
        return mean(nums);
      case "MEDIAN":
        return median(nums);
      case "MODE.SNGL":
      case "MODE":
        return mode(nums);
      case "MAX":
        return Math.max(...nums);
      case "MIN":
        return Math.min(...nums);
      case "COUNT":
        return nums.length;
      case "COUNTA":
        return flat.filter((v) => String(v) !== "").length;
      case "COUNTIF": {
        if (args.length < 2) throw new Error("COUNTIF は 範囲, 条件 の2つが必要です");
        const cond = String(args[1].raw ?? args[1].values[0] ?? "");
        return args[0].values.filter((v) => matches(v, cond)).length;
      }
      case "STDEV.P":
      case "STDEVP":
        return Math.sqrt(variance(nums, false));
      case "STDEV.S":
      case "STDEV":
        return Math.sqrt(variance(nums, true));
      case "VAR.P":
      case "VARP":
        return variance(nums, false);
      case "VAR.S":
      case "VAR":
        return variance(nums, true);
      case "CORREL": {
        if (args.length < 2) throw new Error("CORREL は 範囲, 範囲 の2つが必要です");
        return correl(numbersOnly(args[0].values), numbersOnly(args[1].values));
      }
      case "ROUND": {
        const digits = Number(args[1]?.raw ?? 0);
        const p = 10 ** digits;
        return Math.round(nums[0] * p) / p;
      }
      case "ABS":
        return Math.abs(nums[0]);
      case "SQRT":
        return Math.sqrt(nums[0]);
      default:
        throw new Error(`${name} という関数は、この練習では使えません`);
    }
  };

  const primary = (): number => {
    const t = take();
    if (!t) throw new Error("式が途中で終わっています");
    if (t.kind === "num") return Number(t.text);
    if (t.kind === "op" && t.text === "-") return -primary();
    if (t.kind === "op" && t.text === "+") return primary();
    if (t.kind === "ref") {
      const r = parseRef(t.text);
      if (!r) throw new Error(`「${t.text}」はセルとして読めません`);
      const v = cellValue(data, r.col, r.row);
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) throw new Error(`${t.text.toUpperCase()} は数値ではありません`);
      return n;
    }
    if (t.kind === "range") {
      // 範囲を単独で書いた場合は合計とみなさず、エラーにする
      throw new Error("範囲だけでは計算できません。SUM や AVERAGE などの関数で囲みます");
    }
    if (t.kind === "name") return callFunction(t.text);
    if (t.kind === "paren" && t.text === "(") {
      const v = expr();
      const close = take();
      if (!close || close.text !== ")") throw new Error(") が足りません");
      return v;
    }
    throw new Error(`「${t.text}」がここには置けません`);
  };

  const power = (): number => {
    let left = primary();
    while (peek() && peek().kind === "op" && peek().text === "^") {
      take();
      left = left ** primary();
    }
    return left;
  };

  const term = (): number => {
    let left = power();
    while (peek() && peek().kind === "op" && (peek().text === "*" || peek().text === "/")) {
      const op = take().text;
      const right = power();
      left = op === "*" ? left * right : left / right;
    }
    return left;
  };

  function expr(): number {
    let left = term();
    while (peek() && peek().kind === "op" && (peek().text === "+" || peek().text === "-")) {
      const op = take().text;
      const right = term();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  try {
    const value = expr();
    if (pos < tokens.length) throw new Error("式のうしろに、読み取れない文字が残っています");
    if (!Number.isFinite(value)) return { ok: false, error: "計算できませんでした。範囲や条件を確かめてください" };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
};

/** 式の中で実際に使われている関数名を取り出す（採点で「関数を使ったか」を見るため） */
export const functionsUsed = (formula: string): string[] => {
  const found = new Set<string>();
  const re = /([A-Za-z][A-Za-z0-9_.]*)\s*\(/g;
  let m;
  while ((m = re.exec(formula))) found.add(m[1].toUpperCase());
  return [...found];
};
