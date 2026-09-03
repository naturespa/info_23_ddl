// 使える4桁番号の名簿（2・3年次 デジタル分野版）。
//
// ここに載っていない番号は入力できません。打ち間違いで、別の人の記録に
// 上書きしてしまう事故を防ぐためのものです。
//
//   4桁の読み方 … 1けた目＝学年、2けた目＝組、3〜4けた目＝出席番号
//   例 2407 … 2年4組7番 ／ 3818 … 3年8組18番
//
// 番号を増やすとき（転入生など）は、下の STUDENT_CODES か TEACHER_SEATS に足してください。

/** 2年次の生徒番号 */
export const GRADE2_CODES = ["2407", "2433", "2504", "2513", "2537"];

/** 3年次の生徒番号 */
export const GRADE3_CODES = [
  "3110",
  "3120",
  "3323",
  "3421",
  "3506",
  "3531",
  "3703",
  "3709",
  "3711",
  "3713",
  "3715",
  "3818",
  "3825",
  "3826",
  "3832",
  "3833"
];

/** 生徒の番号（2年 + 3年） */
export const studentCodes = [...GRADE2_CODES, ...GRADE3_CODES];

/**
 * 教員用の番号。生徒には配りません。
 *
 *   0001・0002 … 先生2名分。分野別テストでは「教員用の共通セット」が開きます
 */
export const TEACHER_SEATS = ["0001", "0002"];

/**
 * デモ・動作確認用の番号。
 *
 * 研修や公開授業で、その場の人に画面を触ってもらうための番号です。
 *   ・入るときは教員用パスワードが必要（生徒が 8008 を見つけても入れない）
 *   ・触った記録はいっさい保存しない（再読み込みすれば、まっさらに戻る）
 *   ・分野別テストは、デモ専用の短いセット（20問・10分）が開く
 */
export const DEMO_CODE = "8008";

export const TEACHER_CODES = [...TEACHER_SEATS, DEMO_CODE];

/** デモ用の番号か */
export const isDemoCode = (code: string) => code === DEMO_CODE;

const studentSet = new Set(studentCodes);
const teacherSet = new Set(TEACHER_CODES);

export const isTeacherCode = (code: string) => teacherSet.has(code);
export const isStudentCode = (code: string) => studentSet.has(code);

/** その番号を使ってよいか */
export const isAllowedCode = (code: string) => studentSet.has(code) || teacherSet.has(code);

/** 画面に出す、その番号の読み方 */
export const describeCode = (code: string) => {
  if (code === DEMO_CODE) return "デモ・動作確認用の番号";
  if (teacherSet.has(code)) {
    const n = TEACHER_SEATS.indexOf(code);
    return n >= 0 ? `教員用の番号（${n + 1}人目）` : "試し用の番号です";
  }
  if (!studentSet.has(code)) return "";
  const grade = Number(code[0]);
  const cls = Number(code[1]);
  const seat = Number(code.slice(2));
  return `${grade}年${cls}組${seat}番`;
};

/** 名簿にある組の一覧（分野別テストのファイルを探すときに使う） */
export const CLASS_NOS = Array.from(new Set(studentCodes.map((code) => Number(code[1])))).sort(
  (a, b) => a - b
);

/**
 * 分野別テストで使う組。
 * 教員用の番号は、教員用セットが無いときだけ1組の問題を開く。
 */
export const examClassOf = (code: string): number | null => {
  if (teacherSet.has(code)) return 1;
  if (!studentSet.has(code)) return null;
  const cls = Number(code[1]);
  return Number.isFinite(cls) ? cls : null;
};
