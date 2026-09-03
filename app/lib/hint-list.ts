// 有料ヒントの一覧（37個：実験のヒント26 ＋ 重要語句の最初の1文字11）。
// 中身は出しません。「どの単元のどの実験にヒントがあるか」だけを持ちます。

export type HintEntry = {
  /** ヒント1つ1つを見分ける名前 */
  id: string;
  lessonId: string;
  /** 実験の番号（0始まり。最後は応用ミッション） */
  index: number;
  /** その実験の見出し */
  title: string;
  /** 実験のヒント／重要語句テストの「最初の1文字」 */
  kind: "実験" | "語句";
};

const experimentHints: HintEntry[] = [
  // v31: もともと常時表示だったヒントのうち、解き方を先に言っているものを有料にした12個
  { id: "feature-3-1", lessonId: "feature", index: 3, title: "情報量の単位と、必要なビット数", kind: "実験" },
  { id: "base-1-1", lessonId: "base", index: 1, title: "割り算をくり返して2進数にする", kind: "実験" },
  { id: "real-2-2", lessonId: "real", index: 2, title: "小数点をそろえてから、32ビットの浮動小数点に分解する", kind: "実験" },
  { id: "computer-2-1", lessonId: "computer", index: 2, title: "クロック周波数から命令の実行回数を求める", kind: "実験" },
  { id: "text-3-1", lessonId: "text", index: 3, title: "文字データ量を計算する", kind: "実験" },
  { id: "audio-2-1", lessonId: "audio", index: 2, title: "量子化：波の高さを段階に丸める", kind: "実験" },
  { id: "image-1-1", lessonId: "image", index: 1, title: "画素数と1画素のビット数から容量を求める", kind: "実験" },
  { id: "image-2-1", lessonId: "image", index: 2, title: "dpiから画素数を求める", kind: "実験" },
  { id: "base-4-1", lessonId: "base", index: 4, title: "けたをずらす：0で埋めるシフトと、符号を残すシフト", kind: "実験" },
  { id: "negative-1-1", lessonId: "negative", index: 1, title: "1の補数から2の補数までを、ひと続きで作る", kind: "実験" },
  { id: "negative-2-1", lessonId: "negative", index: 2, title: "10進数を、マイナスも表せるビットの並びにする", kind: "実験" },
  { id: "real-2-1", lessonId: "real", index: 2, title: "小数点をそろえてから、32ビットの浮動小数点に分解する", kind: "実験" },
  { id: "logic-0-1", lessonId: "logic", index: 0, title: "7種類のゲートを、スイッチ・真理値表・電気回路の3つの見方で確かめる", kind: "実験" },
  { id: "logic-2-1", lessonId: "logic", index: 2, title: "半加算器と全加算器を組み立てて、ちがいを見る", kind: "実験" },
  { id: "computer-3-1", lessonId: "computer", index: 3, title: "記憶装置の速さと容量を比べる", kind: "実験" },
  { id: "text-1-1", lessonId: "text", index: 1, title: "符号化方式でバイト数を比べる", kind: "実験" },
  { id: "text-2-1", lessonId: "text", index: 2, title: "文字化けを再現する", kind: "実験" },
  { id: "audio-1-1", lessonId: "audio", index: 1, title: "標本化：一定間隔で波を測り、足りているかを確かめる", kind: "実験" },
  { id: "audio-4-1", lessonId: "audio", index: 4, title: "音質のプリセットを比べる", kind: "実験" },
  { id: "image-0-1", lessonId: "image", index: 0, title: "光の三原色と色の三原色を混ぜ比べる", kind: "実験" },
  { id: "image-3-1", lessonId: "image", index: 3, title: "ドット絵を描いて、色数・データ量・縮み方を見る", kind: "実験" },
  { id: "image-4-1", lessonId: "image", index: 4, title: "用途から画像形式を選ぶ", kind: "実験" },
  { id: "video-0-1", lessonId: "video", index: 0, title: "fpsを変えて動きの滑らかさを見る", kind: "実験" },
  { id: "video-1-1", lessonId: "video", index: 1, title: "非圧縮動画のデータ量を求める", kind: "実験" },
  { id: "video-3-1", lessonId: "video", index: 3, title: "転送にかかる時間を求める", kind: "実験" },
  { id: "compress-2-1", lessonId: "compress", index: 2, title: "ランレングス法で文字列を圧縮する", kind: "実験" },
];

/** 重要語句テストの「最初の1文字」。単元ごとに1つ買うと、その単元の5語ぶん出る */
const wordHints: HintEntry[] = [
  { id: "word-feature", lessonId: "feature", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-base", lessonId: "base", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-negative", lessonId: "negative", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-real", lessonId: "real", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-logic", lessonId: "logic", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-computer", lessonId: "computer", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-text", lessonId: "text", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-audio", lessonId: "audio", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-image", lessonId: "image", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-video", lessonId: "video", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
  { id: "word-compress", lessonId: "compress", index: -2, title: "重要語句の最初の1文字（5語ぶん）", kind: "語句" },
];

export const hintList: HintEntry[] = [...experimentHints, ...wordHints];

/** 重要語句の「最初の1文字」のID */
export const wordHintId = (lessonId: string) => `word-${lessonId}`;
