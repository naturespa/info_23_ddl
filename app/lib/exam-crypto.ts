// 問題そのものを暗号化して配布するための処理。
//
// なぜ暗号化するのか:
//   このサイトは公開の静的サイトなので、ブラウザに送ったものはすべて読めてしまう。
//   問題文をそのまま置くと、生徒はテスト前にソースを開いて問題と正解を全部読める。
//   そこで問題は暗号文で置き、先生が当日に言うパスワードで初めて復号できるようにする。
//
// 使っているもの:
//   鍵の作成 PBKDF2-SHA256（繰り返し 310,000回）
//   暗号化   AES-GCM 256bit（改ざんも検知できる）
//   どちらもブラウザ標準の WebCrypto なので、外部ライブラリは要らない。

import type { EncryptedBundle, ExamQuestion } from "./exam-types";

const PBKDF2_ITERATIONS = 310_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const fromBase64 = (text: string) => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** パスワードと塩から、AES-GCM の鍵をつくる */
const deriveKey = async (password: string, salt: Uint8Array, iterations: number) => {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

/**
 * 問題を暗号化する。ビルド前に先生の手元で1回だけ実行し、
 * できた暗号文だけをリポジトリに上げる（平文は絶対に上げない）。
 */
export const encryptQuestions = async (
  questions: ExamQuestion[],
  password: string,
  meta: Pick<EncryptedBundle, "setId" | "area" | "classNo" | "kind">
): Promise<EncryptedBundle> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    encoder.encode(JSON.stringify(questions))
  );
  return {
    ...meta,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
    iterations: PBKDF2_ITERATIONS
  };
};

/**
 * パスワードで問題を取り出す。
 * パスワードが違えば AES-GCM の検証に失敗するので、null が返る。
 */
export const decryptQuestions = async (bundle: EncryptedBundle, password: string): Promise<ExamQuestion[] | null> => {
  try {
    const key = await deriveKey(password, fromBase64(bundle.salt), bundle.iterations ?? PBKDF2_ITERATIONS);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(bundle.iv) as unknown as BufferSource },
      key,
      fromBase64(bundle.data) as unknown as BufferSource
    );
    return JSON.parse(decoder.decode(plain)) as ExamQuestion[];
  } catch {
    // パスワード違い、または暗号文が壊れている
    return null;
  }
};

/**
 * 追試のパスワード。基本パスワードに生徒の4桁番号を混ぜるので、
 * 誰かに漏れても、その生徒の番号でしか開かない。
 */
export const makeupPassword = (basePassword: string, studentCode: string) => `${basePassword}#${studentCode}`;

/** 入力されたパスワードの前後の空白と全角空白を落とす（貼り付け事故を防ぐ） */
export const normalizePassword = (value: string) => value.replace(/[\s　]+/g, "");
