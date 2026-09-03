// 情報Ⅰ Digital Lab（2・3年次） - 型定義
// 岡田メソッドExcelシート（兵庫県立明石南高等学校 岡田）の章立てに対応

export type QuestionLevel = "基礎" | "共通テスト" | "ITパスポート" | "基本情報";

export type Question = {
  id: string;
  q: string;
  choices: string[];
  answer: number;
  explanation: string;
  level: QuestionLevel;
  /** IPA過去問などの出典。オリジナル問題は undefined */
  source?: string;
  /** 問題文に図が必要なとき、その図の名前。app/lib/question-figures.tsx に対応する図がある */
  figure?: QuestionFigureName;
};

/** 確認問題に添える図の名前 */
export type QuestionFigureName = "memory-fetch";

export type Term = {
  word: string;
  meaning: string;
};

export type MissionStep = {
  /** 図解カードの見出し */
  label: string;
  /** その手順で何をするか */
  detail: string;
};

export type Mission = {
  title: string;
  body: string;
  /** 応用ミッションの手順を図解するための3ステップ */
  steps: MissionStep[];
};

export type Area = "デジタル";

/** つまずいたときの立て直し方。ダッシュボードの弱点カードに表示する */
export type Remedy = {
  /** この単元でつまずく人に共通する原因 */
  stumble: string;
  /** 何をすれば理解できるようになるか（順番に3つ） */
  actions: string[];
};

export type Lesson = {
  id: string;
  no: string;
  area: Area;
  title: string;
  subtitle: string;
  concepts: string[];
  /** 教科書の該当箇所。日本文教出版「情報Ⅰ ADVANCED」(116-902) の章・節で書く */
  textbook: string;
  /** ITパスポート試験シラバス Ver.6.5（令和8年1月適用）の分類 */
  itpassport: string;
  /** 学習時間の目安（分） */
  minutes: number;
  /** 用語集（赤シート学習に対応する重要語句） */
  terms: Term[];
  /** 「〜を理解する◯つのステップ」 */
  steps: string[];
  /** 実験ごとの理論解説。配列の長さ＝実験数 */
  theory: string[];
  /** 応用ミッション（実験の最後に配置） */
  mission: Mission;
  /** 正答率が低かったときに表示する学び直しの手順 */
  remedy: Remedy;
  questions: Question[];
};

/** 1問ごとの最終結果。Excelで集計しやすいように日本語のまま出力する */
export type QuestionResult = "1回目で正解" | "2回目で正解" | "不正解" | "2回目待ち";

export type Submission = {
  /** 1回目に選んだ選択肢の番号（0始まり） */
  answers: number[];
  /** 2回目に選んだ選択肢の番号。1回目が正解、またはまだ挑戦していない場合は -1 */
  retries: number[];
  /** 1回目で正解した問題数 */
  correct: number;
  /** 2回目で正解した問題数 */
  secondCorrect: number;
  /** 得点。1回目正解＝1点、2回目正解＝0.5点、不正解＝0点 */
  score: number;
  /** 問題ごとの結果 */
  results: QuestionResult[];
  submittedAt: string;
  /** 最後に2回目の解答をした時刻 */
  retriedAt?: string;
};

export type Done = Record<string, boolean>;

export type Perspective = {
  /** 知識・技能：確認問題＋重要語句の得点率 */
  knowledge: number;
  /** 思考・判断・表現：実験の実施率 */
  thinking: number;
  /** 主体的に学習に取り組む態度：単元の完走率70％＋ふり返り申告率30％ */
  attitude: number;
};

/** こころ（主体性）の内訳。素点と100点換算の両方を持つ */
export type AttitudePart = { done: number; max: number; rate: number };

/**
 * 実験ごとの理解度の申告。生徒には点数を見せない。
 * 5=完全に理解しテストで解ける / 4=8割程度 / 3=半分 / 2=3割程度 / 1=理解できていない / 0=未申告
 */
export type UnderstandingLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** 理解度ボタンの並び。label だけを画面に出し、score は出さない */
export const UNDERSTANDING_CHOICES: { score: 1 | 2 | 3 | 4 | 5; label: string; detail: string }[] = [
  { score: 5, label: "完全に理解した", detail: "テストで出ても自分で解ける" },
  { score: 4, label: "だいたい分かった", detail: "8割ぐらいは説明できる" },
  { score: 3, label: "半分ぐらい", detail: "分かった所と、あやしい所が半々" },
  { score: 2, label: "少しだけ", detail: "3割ぐらい。まだ人に説明できない" },
  { score: 1, label: "まだ分からない", detail: "もう一度やり直したい" }
];

/** 分野ごとの成績。このサイトはデジタル分野のみ、100点満点で出す */
export type AreaScore = {
  area: Area;
  /** その分野の総合点（100点満点） */
  totalScore: number;
  perspective: Perspective;
  /** 確認問題の素点（0.5刻み） */
  quizScore: number;
  /** その分野の確認問題数＝満点 */
  quizMax: number;
  firstCorrect: number;
  secondCorrect: number;
  /** 重要語句の素点（0.5刻み） */
  wordScore: number;
  /** 重要語句の満点＝語数 */
  wordMax: number;
  /** 重要語句を1回目で正解した数 */
  wordFirst: number;
  /** 重要語句を2回目で正解した数 */
  wordSecond: number;
  /** 知識・技能の素点＝確認問題＋重要語句 */
  knowledgeScore: number;
  /** 知識・技能の満点 */
  knowledgeMax: number;
  experimentDone: number;
  experimentMax: number;
  /** 理解度の申告点の合計（1実験あたり最大5点。未申告は0点） */
  understandingScore: number;
  /** 理解度の満点＝実験数×5 */
  understandingMax: number;
  /** 理解度を申告した実験の数 */
  understandingAnswered: number;
  completedLessons: number;
  lessonCount: number;
  /** こころの内訳：ふり返りの申告 */
  reflection: AttitudePart;
  /** こころの内訳：単元の完走 */
  clear: AttitudePart;
  /** かせいだGの累計（使ってもここは減らない） */
  earned: number;
};

export type Summary = {
  /** 総合点。デジタル分野100点満点 */
  totalScore: number;
  /** 総合点の満点（分野数×100） */
  totalMax: number;
  /** 全体を1つとみなしたときの観点別の到達度（％） */
  perspective: Perspective;
  /** 確認問題の素点（1回目正解＝1点、2回目正解＝0.5点） */
  quizScore: number;
  /** 1回目で正解した問題数 */
  quizCorrect: number;
  /** 2回目で正解した問題数 */
  quizSecondCorrect: number;
  quizMax: number;
  /** 重要語句の素点（0.5刻み） */
  wordScore: number;
  /** 重要語句の満点＝語数 */
  wordMax: number;
  /** 重要語句を1回目で正解した数 */
  wordFirst: number;
  /** 重要語句を2回目で正解した数 */
  wordSecond: number;
  /** 知識・技能の素点＝確認問題＋重要語句 */
  knowledgeScore: number;
  /** 知識・技能の満点 */
  knowledgeMax: number;
  experimentDone: number;
  experimentMax: number;
  /** 理解度の申告点の合計（1実験あたり最大5点。未申告は0点） */
  understandingScore: number;
  /** 理解度の満点＝実験数×5 */
  understandingMax: number;
  /** 理解度を申告した実験の数 */
  understandingAnswered: number;
  completedLessons: number;
  lessonCount: number;
  /** こころの内訳：ふり返りの申告 */
  reflection: AttitudePart;
  /** こころの内訳：単元の完走 */
  clear: AttitudePart;
  /** かせいだGの累計（使ってもここは減らない） */
  earned: number;
  /** つかったGの累計（ヒント代） */
  spent: number;
  /** 分野ごとの成績（それぞれ100点満点） */
  areas: AreaScore[];
};

/** 成績処理に必要な最低限だけを取り出した、分野別テストの1行 */
export type ExamRow = {
  studentCode: string;
  grade: number | null;
  classNo: number | null;
  seat: number | null;
  area: Area;
  kind: string;
  setId: string;
  score: number;
  max: number;
  rate: number;
  knowledge: string;
  thinking: string;
  startedAt: string;
  finishedAt: string;
  elapsedSeconds: number;
};

/** こころ（主体性）の出力。素点と100点換算の両方を出す */
export type AttitudeReport = {
  total: { reflection: AttitudePart; clear: AttitudePart; score100: number };
  byArea: { area: Area; reflection: AttitudePart; clear: AttitudePart; score100: number }[];
  weight: { clear: number; reflection: number };
};

export type StudentRecord = {
  version: 6;
  exportedAt?: string;
  studentCode: string;
  drafts: Record<string, number[]>;
  submissions: Record<string, Submission>;
  experiments: Record<string, boolean>;
  /** 実験ごとの理解度の申告（1〜5）。キーは experiments と同じ `${lessonId}-${index}` */
  understanding: Record<string, UnderstandingLevel>;
  /** 重要語句テストの入力（送信前） */
  wordDrafts: Record<string, string[]>;
  /** 重要語句テストの記録 */
  wordSubmissions: Record<string, unknown>;
  /** 応用ミッションの自由記述 */
  missionNotes: Record<string, string>;
  /** 買ったヒント */
  boughtHints: Record<string, boolean>;
  /** 最後に開いた単元 */
  lastLesson: string;
  /** そうびの中で覚え直して集めた語。キーは語句そのもの。得点には影響しない */
  practiced: Record<string, boolean>;
  /** G の収支。成績には使いません */
  coins: { earned: number; spent: number; balance: number; hintsBought: string[]; level: number };
  /** 主体的に学習に取り組む態度 */
  attitude: AttitudeReport;
  summary: Summary;
  /** 分野別テストの結果。成績処理はまずこの exams を見れば足りる */
  exams: ExamRow[];
  /** 分野別テストの詳細（単元別・観点別・問題ごとの正誤） */
  examDetails: unknown[];
};
