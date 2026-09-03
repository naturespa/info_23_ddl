// G（ゴールド）とレベル、そして「こころ」の計算。
//
// 決めごと
//   ・実験を1つ終える          … 1G（応用の自由記述が空欄のときは 0G）
//   ・確認問題に1回目で正解     … 2G
//   ・確認問題に2回目で正解     … 1G
//   ・重要語句に1回目で正解     … 2G ／ 2回目 … 1G（確認問題と同じ）
//   ・単元をぜんぶ終える        … 3G
//   ・はじめの持ち金            … 0G
//   ・ヒントを1つ開く          … 5G（一度買えば、そのあとはいつでも見られる）
//
// レベルは「かせいだGの累計」で決まります（使ってもレベルは下がりません）。
// 最大50。序盤は軽く、終盤ほど重くしてあります。
// かせげるGの上限は656G（実験103＋確認問題153問×2＋重要語句95語×2＋単元完走19×3）。
// Lv50に必要なのは620Gなので、ほぼ全部を1回目で正解できた生徒がLv50に届きます。
// 目安：デジタル分野を完璧に終えた時点（382G）でLv38、2回目正解ばかりでも（408G）Lv39。

export const COIN = {
  /** 実験1つ */
  experiment: 1,
  /** 応用ミッションで自由記述が空欄のとき */
  experimentBlank: 0,
  /** 確認問題・重要語句：1回目で正解 */
  first: 2,
  /** 確認問題・重要語句：2回目で正解 */
  second: 1,
  /** 単元をぜんぶ終える */
  lessonClear: 3,
  /** ヒント1つ */
  hint: 5,
  /** はじめの持ち金 */
  start: 0
} as const;

export const MAX_LEVEL = 50;

/** Lv1→Lv2、Lv2→Lv3 … Lv49→Lv50 に必要なG（49段）。合計620G */
export const LEVEL_STEPS = [
  3, 4, 5, 5, 5, 6, 6, 6, 7, 7,
  8, 8, 8, 9, 9, 9, 10, 10, 10, 11,
  11, 11, 12, 12, 13, 13, 13, 14, 14, 14,
  15, 15, 15, 16, 16, 16, 17, 17, 17, 18,
  18, 19, 20, 20, 21, 21, 21, 22, 23
];

/** そのレベルに上がるまでにかせぐ累計G */
export const LEVEL_AT: number[] = LEVEL_STEPS.reduce<number[]>((acc, step) => {
  acc.push((acc[acc.length - 1] ?? 0) + step);
  return acc;
}, []);

export type LevelState = {
  level: number;
  /** 次のレベルまであと何G。最大レベルなら 0 */
  toNext: number;
  /** いまのレベルの中でどこまで進んだか（0〜1）。最大レベルなら 1 */
  ratio: number;
  /** 最大レベルに届いたか */
  maxed: boolean;
};

/** かせいだGの累計から、レベルと次のレベルまでの残りを求める */
export const levelOf = (earned: number): LevelState => {
  let level = 1;
  for (const at of LEVEL_AT) if (earned >= at) level += 1;
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, toNext: 0, ratio: 1, maxed: true };
  const from = level === 1 ? 0 : LEVEL_AT[level - 2];
  const to = LEVEL_AT[level - 1];
  return {
    level,
    toNext: Math.max(0, to - earned),
    ratio: Math.min(1, Math.max(0, (earned - from) / (to - from))),
    maxed: false
  };
};

/* ============================================================
 * 主体的に学習に取り組む態度（こころ）
 * ========================================================== */

/**
 * 完走率70％＋ふり返り申告率30％。
 * 「どの段階を選んだか」は使いません。正直に選んでも点が下がらないようにするためです。
 */
export const ATTITUDE_WEIGHT = { clear: 0.7, reflection: 0.3 } as const;

export type AttitudePart = { done: number; max: number; rate: number };

export const part = (done: number, max: number): AttitudePart => ({
  done,
  max,
  rate: max ? Math.round((done / max) * 1000) / 10 : 0
});

export const attitudeScore = (reflection: AttitudePart, clear: AttitudePart) =>
  Math.round((clear.rate * ATTITUDE_WEIGHT.clear + reflection.rate * ATTITUDE_WEIGHT.reflection) * 10) / 10;

/* ============================================================
 * 依頼の手ごわさ（★）
 * ========================================================== */

/** 単元ごとの★。生徒に「どれから受けるか」を選ばせるための目安 */
export const DIFFICULTY: Record<string, 1 | 2 | 3> = {
  feature: 1,
  base: 2,
  negative: 2,
  real: 3,
  logic: 2,
  computer: 2,
  text: 1,
  audio: 2,
  image: 2,
  video: 2,
  compress: 2,
  organize: 1,
  center: 1,
  spread: 2,
  normal: 3,
  relation: 2,
  simulation: 2,
  test: 3,
  timeseries: 2
};
