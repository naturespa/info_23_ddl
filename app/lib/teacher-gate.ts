// 教員用の番号（0001〜0005 など）でログインするときの、合いことばの確認。
//
// なぜ必要か
//   4桁番号だけだと、生徒が 0001 と打てば先生の画面に入れてしまう。
//   分野別テストの教員用セットも開けてしまうので、番号のほかに
//   先生しか知らないパスワードを1つ足す。
//
// どうやって確かめるか
//   パスワードそのものは、どこにも置かない。
//   生成キットが作った「照合用の値」だけを teacher-gate.json に置く。
//
//     照合用の値 ＝ PBKDF2-SHA256（パスワード, 塩, 31万回）
//
//   打たれたパスワードを同じ手順で計算し、値が一致したときだけ通す。
//   31万回の繰り返しを挟んであるので、この値から元のパスワードを
//   総当たりで割り出すのは現実的ではない。
//
// 大事なこと
//   これは「うっかり入れてしまう」のを防ぐ鍵であって、金庫ではない。
//   本気で調べれば回避はできるので、成績の正式な保管場所にはしないこと。

const PBKDF2_ITERATIONS = 310_000;
const encoder = new TextEncoder();

export type TeacherGate = {
  /** PBKDF2 の塩（base64） */
  salt: string;
  /** 照合用の値（base64） */
  hash: string;
  iterations: number;
};

const fromBase64 = (text: string) => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

/** 前後の空白・全角空白を落とす（板書を写すときの事故を防ぐ） */
export const normalizeTeacherPassword = (value: string) => value.replace(/[\s　]+/g, "");

/** パスワードと塩から、照合用の値を作る */
const derive = async (password: string, salt: Uint8Array, iterations: number) => {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    material,
    256
  );
  return toBase64(new Uint8Array(bits));
};

export type GateResult =
  | { state: "ok" }
  | { state: "wrong" }
  /** teacher-gate.json が置かれていない ＝ 鍵をかけていない運用 */
  | { state: "none" }
  | { state: "error" };

/**
 * 教員用パスワードを確かめる。
 * teacher-gate.json が無い場合は "none" を返す（古い配置でも先生が締め出されないように）。
 */
export const checkTeacherPassword = async (basePath: string, password: string): Promise<GateResult> => {
  let gate: TeacherGate;
  try {
    const res = await fetch(`${basePath}/teacher-gate.json`, { cache: "no-store" });
    if (!res.ok) return { state: "none" };
    gate = (await res.json()) as TeacherGate;
    if (!gate?.salt || !gate?.hash) return { state: "none" };
  } catch {
    return { state: "none" };
  }
  try {
    const got = await derive(
      normalizeTeacherPassword(password),
      fromBase64(gate.salt),
      gate.iterations ?? PBKDF2_ITERATIONS
    );
    return got === gate.hash ? { state: "ok" } : { state: "wrong" };
  } catch {
    return { state: "error" };
  }
};

/** この端末で、教員用の確認を済ませたことを覚えておくキー */
export const teacherUnlockKey = (code: string) => `joho-ddl-teacher-ok:${code}`;
