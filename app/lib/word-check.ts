// 重要語句テストの照合。
//
// 打ち方のちがいで×にしないことを最優先にしています。
// 全角・半角、英字の大小、カタカナの長音、スペースや中黒は、照合の前にそろえます。

import type { WordItem } from "./words";

/** 照合用にそろえる。ここでそろえたちがいは、すべて正解あつかいになる */
export const normalizeWord = (value: string) =>
  value
    // 全角英数字・記号 → 半角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[（）]/g, (c) => (c === "（" ? "(" : ")"))
    // 半角カタカナ → 全角（濁点は先に合成しておく）
    .normalize("NFKC")
    // 英字は小文字にそろえる
    .toLowerCase()
    // 空白・中黒・記号のゆれを落とす
    .replace(/[\s　・･,、,.。/／\-−ー―‐_]/g, "")
    // 「々」や括弧書きは無視する
    .replace(/[()]/g, "");

/** 1文字だけ違う、入れかわっている、1文字多い／少ない → 「おしい」 */
export const isClose = (a: string, b: string) => {
  if (a === b) return false;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  // レーベンシュタイン距離が1かどうかだけ見る
  if (la === lb) {
    let diff = 0;
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) diff += 1;
    if (diff === 1) return true;
    // 隣どうしの入れかわり
    if (diff === 2) {
      for (let i = 0; i < la - 1; i++) {
        if (a[i] !== b[i] && a[i] === b[i + 1] && a[i + 1] === b[i]) return true;
      }
    }
    return false;
  }
  const [shortText, longText] = la < lb ? [a, b] : [b, a];
  for (let i = 0; i <= shortText.length; i++) {
    if (shortText.slice(0, i) + longText[i] + shortText.slice(i) === longText) return true;
  }
  return false;
};

export type WordVerdict = "correct" | "close" | "wrong" | "empty";

/** 入力を採点する */
export const checkWord = (item: WordItem, input: string): WordVerdict => {
  const typed = normalizeWord(input);
  if (!typed) return "empty";
  const accepted = [item.answer, ...item.alt].map(normalizeWord);
  if (accepted.includes(typed)) return "correct";
  if (accepted.some((a) => isClose(a, typed))) return "close";
  return "wrong";
};

/** 間違えたときに出す、最初の1文字 */
export const firstLetter = (item: WordItem) => item.answer.slice(0, 1);

/**
 * 答えの形（文字の種類と文字数）を短い日本語にする。
 * 「カタカナ3文字」のように出して、何を答えればよいかを分かりやすくするために使う。
 */
export const answerShape = (answer: string): string => {
  const chars = [...answer];
  const n = chars.length;
  const kind = (c: string) => {
    if (/[ァ-ヺー・]/.test(c)) return "カタカナ";
    if (/[ぁ-ゖ]/.test(c)) return "ひらがな";
    if (/[一-鿿々]/.test(c)) return "漢字";
    if (/[A-Za-z]/.test(c)) return "アルファベット";
    if (/[0-9]/.test(c)) return "数字";
    return "記号";
  };
  const order = ["漢字", "ひらがな", "カタカナ", "アルファベット", "数字"];
  const kinds = order.filter((k) => chars.some((c) => kind(c) === k));
  if (kinds.length === 1) {
    return kinds[0] === "漢字" ? `漢字${n}字` : `${kinds[0]}${n}文字`;
  }
  if (kinds.length === 2) return `${kinds[0]}と${kinds[1]}で${n}文字`;
  return `全部で${n}文字`;
};
