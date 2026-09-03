"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ExamView } from "./exam";
import { Experiments } from "./experiments";
import { QuestionFigure } from "./lib/question-figures";
import { experimentCount, lessons } from "./lib/lessons";
import type { Area, ExamRow, Lesson, QuestionResult, Submission, StudentRecord, Summary, UnderstandingLevel } from "./lib/types";
import { COIN, DIFFICULTY, attitudeScore, levelOf, part } from "./lib/progress";
import { WordQuiz, gradeWords, type WordSubmission } from "./lib/word-quiz";
import { WORDS_PER_LESSON, words, wordsOf } from "./lib/words";
import { checkWord } from "./lib/word-check";
import type { WordItem } from "./lib/words";
import { hintList } from "./lib/hint-list";
import { DEMO_CODE, describeCode, isAllowedCode, isDemoCode, isTeacherCode } from "./lib/roster";
import { PasswordField } from "./lib/password-field";
import { checkTeacherPassword, teacherUnlockKey } from "./lib/teacher-gate";
import { UNDERSTANDING_CHOICES } from "./lib/types";
import type { ExamResult } from "./lib/exam-types";
import { classOf, gradeOf, seatOf } from "./lib/exam-types";
import { formatElapsed } from "./lib/exam-runtime";
import { HintShopContext } from "./lib/ui";

/** 静的書き出しのときの公開パス。GitHub Pages では /info1_ddl_public が前につく */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const STORAGE_PREFIX = "joho-ddl-public-v2:";
/** 確定した4桁番号を覚えておくキー。次に開いたときも同じ番号で続きから始める */
const ACTIVE_KEY = "joho-ddl-public-active";
/** 分野別テストの結果を置くキー */
const EXAM_RESULTS_KEY = (code: string) => `joho-ddl-exam-results:${code}`;

const AREAS: Area[] = ["デジタル"];

/** 1回目正解＝1点、2回目正解＝0.5点、不正解＝0点 */
const FIRST_POINT = 1;
const SECOND_POINT = 0.5;

/** 小数第1位まで（0.5刻みの得点を見やすく丸める） */
const point = (value: number) => Math.round(value * 10) / 10;

/**
 * 保存されている解答から、問題ごとの結果と得点を組み立て直す。
 * 旧バージョン（2回目の記録がない）の保存データもここで読めるようにしている。
 */
const gradeSubmission = (lesson: Lesson, saved: Partial<Submission> | undefined): Submission | undefined => {
  if (!saved || !Array.isArray(saved.answers)) return undefined;
  const answers = lesson.questions.map((_, i) => saved.answers?.[i] ?? -1);
  const retries = lesson.questions.map((_, i) => saved.retries?.[i] ?? -1);
  const results: QuestionResult[] = lesson.questions.map((question, i) => {
    if (answers[i] === question.answer) return "1回目で正解";
    if (retries[i] === -1) return "2回目待ち";
    return retries[i] === question.answer ? "2回目で正解" : "不正解";
  });
  const correct = results.filter((r) => r === "1回目で正解").length;
  const secondCorrect = results.filter((r) => r === "2回目で正解").length;
  return {
    answers,
    retries,
    correct,
    secondCorrect,
    score: point(correct * FIRST_POINT + secondCorrect * SECOND_POINT),
    results,
    submittedAt: saved.submittedAt ?? new Date().toISOString(),
    ...(saved.retriedAt ? { retriedAt: saved.retriedAt } : {})
  };
};

/** 分野別テストの結果を読み書きする。分野ごとに最新の1回だけ残す */
const loadExamResults = (code: string): ExamResult[] => {
  // デモ用の番号は、前回の結果を持ち越さない
  if (isDemoCode(code)) return [];
  try {
    const raw = localStorage.getItem(EXAM_RESULTS_KEY(code));
    return raw ? (JSON.parse(raw) as ExamResult[]) : [];
  } catch {
    return [];
  }
};

const saveExamResults = (code: string, results: ExamResult[]) => {
  // デモ用の番号は、何も書き残さない
  if (isDemoCode(code)) return;
  try {
    localStorage.setItem(EXAM_RESULTS_KEY(code), JSON.stringify(results));
  } catch {
    /* 保存できない環境では黙って続行する */
  }
};

const normalizeStudentCode = (value: string) =>
  value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, "")
    .slice(0, 4);

const todayNumber = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
};

export default function Home() {
  /** 確定した番号。確定するまでは空文字 */
  const [studentCode, setStudentCode] = useState("");
  /** 入力中の番号（まだ確定していない） */
  const [codeDraft, setCodeDraft] = useState("");
  /** 教員用の番号のときに入れてもらう合いことば */
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [teacherBusy, setTeacherBusy] = useState(false);
  /** 教員用のリセット（確認中かどうか／終わった直後かどうか） */
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [active, setActive] = useState("home");
  const [drafts, setDrafts] = useState<Record<string, number[]>>({});
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [experiments, setExperiments] = useState<Record<string, boolean>>({});
  /** 実験ごとの理解度の申告（1〜5）。生徒には点数を見せない */
  const [understanding, setUnderstanding] = useState<Record<string, UnderstandingLevel>>({});
  const [loaded, setLoaded] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  /** 「学習を終了」を押したあとの確認中フラグ */
  const [endConfirm, setEndConfirm] = useState(false);
  /** 分野別テストの結果（分野ごとに最新の1回） */
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  /** 重要語句テストの入力（送信前） */
  const [wordDrafts, setWordDrafts] = useState<Record<string, string[]>>({});
  /** 重要語句テストの記録 */
  const [wordSubmissions, setWordSubmissions] = useState<Record<string, WordSubmission>>({});
  /** 応用ミッションの自由記述 */
  const [missionNotes, setMissionNotes] = useState<Record<string, string>>({});
  /** 買ったヒント。キーは `${lessonId}-${実験番号}-${そのカードの中の何番目か}` */
  const [boughtHints, setBoughtHints] = useState<Record<string, boolean>>({});
  /** 最後に開いた単元。「つづきから」で戻る先 */
  const [lastLesson, setLastLesson] = useState("");
  /** そうびの中で打ち直して覚えた語。得点は動かさず、集めたかどうかだけが変わる */
  const [practiced, setPracticed] = useState<Record<string, boolean>>({});
  /** そうびで打ちこみ中の文字（保存しない） */
  const [termDraft, setTermDraft] = useState<Record<string, string>>({});

  const current = lessons.find((lesson) => lesson.id === active);

  const summary = useMemo<Summary>(() => {
    /** 単元の集合をまとめて集計する。分野ごとにも、全体にも同じ式を使う */
    const tally = (group: Lesson[]) => {
      let quizScore = 0;
      let firstCorrect = 0;
      let secondCorrect = 0;
      let quizMax = 0;
      let experimentDone = 0;
      let experimentMax = 0;
      let understandingScore = 0;
      let understandingAnswered = 0;
      let completedLessons = 0;
      let wordScore = 0;
      let wordMax = 0;
      let wordFirst = 0;
      let wordSecond = 0;
      let earned = 0;
      group.forEach((lesson) => {
        const submission = submissions[lesson.id];
        quizMax += lesson.questions.length;
        if (submission) {
          quizScore += submission.score;
          firstCorrect += submission.correct;
          secondCorrect += submission.secondCorrect;
          earned += submission.correct * COIN.first + submission.secondCorrect * COIN.second;
        }
        // 重要語句
        const wordSub = wordSubmissions[lesson.id];
        wordMax += WORDS_PER_LESSON;
        if (wordSub) {
          wordScore += wordSub.score;
          wordFirst += wordSub.correct;
          wordSecond += wordSub.secondCorrect;
          earned += wordSub.correct * COIN.first + wordSub.secondCorrect * COIN.second;
        }
        const expTotal = experimentCount(lesson);
        const missionIndex = expTotal - 1;
        // 応用ミッションの自由記述が空欄のときは 0.5個ぶん・0G
        const blankMission = !((missionNotes[lesson.id] ?? "").trim());
        let doneHere = 0;
        for (let i = 0; i < expTotal; i++) {
          if (!experiments[`${lesson.id}-${i}`]) continue;
          const half = i === missionIndex && blankMission;
          doneHere += half ? 0.5 : 1;
          earned += half ? COIN.experimentBlank : COIN.experiment;
        }
        experimentMax += expTotal;
        experimentDone += doneHere;
        for (let i = 0; i < expTotal; i++) {
          const level = understanding[`${lesson.id}-${i}`] ?? 0;
          understandingScore += level;
          if (level > 0) understandingAnswered += 1;
        }
        // 完走＝実験を全部やり、確認問題と重要語句の両方で2回目待ちが残っていないこと
        const allExp = Array.from({ length: expTotal }, (_, i) => experiments[`${lesson.id}-${i}`]).every(Boolean);
        const quizDone = !!submission && !submission.results.includes("2回目待ち");
        const wordDone = !!wordSub && !wordSub.results.includes("2回目待ち");
        if (allExp && quizDone && wordDone) {
          completedLessons += 1;
          earned += COIN.lessonClear;
        }
      });
      // 知識・技能は「確認問題＋重要語句」
      const knowledgeScore = quizScore + wordScore;
      const knowledgeMax = quizMax + wordMax;
      const knowledge = knowledgeMax ? Math.round((knowledgeScore / knowledgeMax) * 100) : 0;
      const thinking = experimentMax ? Math.round((experimentDone / experimentMax) * 100) : 0;
      const reflection = part(understandingAnswered, experimentMax);
      const clear = part(completedLessons, group.length);
      const attitude = attitudeScore(reflection, clear);
      return {
        totalScore: Math.round(knowledge * 0.6 + thinking * 0.4),
        perspective: { knowledge, thinking, attitude },
        quizScore: point(quizScore),
        firstCorrect,
        secondCorrect,
        quizMax,
        wordScore: point(wordScore),
        wordMax,
        wordFirst,
        wordSecond,
        knowledgeScore: point(knowledgeScore),
        knowledgeMax,
        experimentDone: point(experimentDone),
        experimentMax,
        understandingScore,
        understandingMax: experimentMax * 5,
        understandingAnswered,
        completedLessons,
        lessonCount: group.length,
        earned,
        reflection,
        clear
      };
    };

    const whole = tally(lessons);
    const areas = AREAS.map((area) => ({ area, ...tally(lessons.filter((lesson) => lesson.area === area)) }));
    return {
      // 総合点は、分野ごとの100点を足した200点満点
      totalScore: areas.reduce((sum, area) => sum + area.totalScore, 0),
      totalMax: areas.length * 100,
      perspective: whole.perspective,
      quizScore: whole.quizScore,
      quizCorrect: whole.firstCorrect,
      quizSecondCorrect: whole.secondCorrect,
      quizMax: whole.quizMax,
      wordScore: whole.wordScore,
      wordMax: whole.wordMax,
      wordFirst: whole.wordFirst,
      wordSecond: whole.wordSecond,
      knowledgeScore: whole.knowledgeScore,
      knowledgeMax: whole.knowledgeMax,
      experimentDone: whole.experimentDone,
      experimentMax: whole.experimentMax,
      understandingScore: whole.understandingScore,
      understandingMax: whole.understandingMax,
      understandingAnswered: whole.understandingAnswered,
      completedLessons: whole.completedLessons,
      lessonCount: whole.lessonCount,
      earned: whole.earned,
      /** つかったG。かせいだGを超えないようにする（値段を変えたときの数え直し対策） */
      spent: Math.min(whole.earned, Object.values(boughtHints).filter(Boolean).length * COIN.hint),
      reflection: whole.reflection,
      clear: whole.clear,
      areas
    };
  }, [submissions, experiments, understanding, wordSubmissions, missionNotes, boughtHints]);

  /** 成績ページのダッシュボード用に、単元別・難易度別の理解度を集計する */
  const analysis = useMemo(() => {
    const perLesson = lessons.map((lesson) => {
      const submission = submissions[lesson.id];
      const total = lesson.questions.length;
      const correct = submission?.correct ?? 0;
      const score = submission?.score ?? 0;
      const rate = submission ? Math.round((score / total) * 100) : null;
      const wrong = submission
        ? lesson.questions
            .map((question, index) => ({
              question,
              index,
              picked: submission.answers[index],
              retried: submission.retries[index],
              result: submission.results[index]
            }))
            .filter((row) => row.result !== "1回目で正解")
        : [];
      const expTotal = experimentCount(lesson);
      const expDone = Array.from({ length: expTotal }, (_, i) => experiments[`${lesson.id}-${i}`]).filter(Boolean).length;
      const state: "none" | "good" | "warn" | "bad" =
        rate === null ? "none" : rate >= 80 ? "good" : rate >= 60 ? "warn" : "bad";
      return { lesson, submitted: !!submission, total, correct, score, rate, wrong, expDone, expTotal, state };
    });

    const levels = ["基礎", "共通テスト", "ITパスポート", "基本情報"] as const;
    const byLevel = levels.map((level) => {
      let score = 0;
      let correct = 0;
      let total = 0;
      perLesson.forEach((row) => {
        if (!row.submitted) return;
        const submission = submissions[row.lesson.id]!;
        row.lesson.questions.forEach((question, index) => {
          if (question.level !== level) return;
          total += 1;
          if (submission.results[index] === "1回目で正解") {
            correct += 1;
            score += FIRST_POINT;
          } else if (submission.results[index] === "2回目で正解") {
            score += SECOND_POINT;
          }
        });
      });
      return { level, correct, score: point(score), total, rate: total ? Math.round((score / total) * 100) : null };
    });

    const answered = perLesson.filter((row) => row.submitted);
    const weak = answered.filter((row) => (row.rate ?? 100) < 80).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0)).slice(0, 3);
    const strong = answered.filter((row) => (row.rate ?? 0) >= 80);
    const basic = byLevel[0];
    const applied = byLevel.slice(1).reduce(
      (acc, row) => ({ score: acc.score + row.score, total: acc.total + row.total }),
      { score: 0, total: 0 }
    );
    const appliedRate = applied.total ? Math.round((applied.score / applied.total) * 100) : null;
    const untouched = perLesson.filter((row) => row.expDone === 0 && !row.submitted).length;

    /** 集計結果から、事実だけを根拠にした短い講評を組み立てる */
    const verdicts: string[] = [];
    if (!answered.length) {
      verdicts.push("まだ確認問題が1つも送信されていません。どの単元でもよいので1つ送信すると、ここに得意と弱点が表示されます。");
    } else {
      const totalCorrect = answered.reduce((a, b) => a + b.correct, 0);
      const totalSecond = answered.reduce((a, b) => a + b.lesson.questions.length - b.correct - b.wrong.filter((w) => w.result !== "2回目で正解").length, 0);
      const totalAsked = answered.reduce((a, b) => a + b.total, 0);
      verdicts.push(
        `送信した${answered.length}単元で、${totalAsked}問中${totalCorrect}問を1回目で正解しています（${Math.round((totalCorrect / totalAsked) * 100)}%）。` +
          (totalSecond > 0 ? `さらに${totalSecond}問を2回目で正解しました。` : "")
      );
      if (basic.rate !== null && appliedRate !== null && basic.rate - appliedRate >= 20) {
        verdicts.push(`用語や定義（基礎${basic.rate}%）は入っていますが、計算や判断を求める問題（${appliedRate}%）で落としています。手順を実験でたどり直すのが近道です。`);
      } else if (basic.rate !== null && appliedRate !== null && appliedRate - basic.rate >= 20) {
        verdicts.push(`計算問題（${appliedRate}%）は解けていますが、用語の問題（基礎${basic.rate}%）で落としています。各単元の重要語句を開いて確認しましょう。`);
      }
      const weakLowExp = weak.filter((row) => row.expDone < row.expTotal / 2);
      if (weakLowExp.length) {
        verdicts.push(`弱点の単元のうち${weakLowExp.length}つは、実験もまだ半分以下しか触れていません。読むより先に、手を動かすほうが効きます。`);
      }
      if (strong.length) {
        verdicts.push(`${strong.length}単元が8割を超えています。ここは自信を持って先へ進んで大丈夫です。`);
      }
    }

    return { perLesson, byLevel, weak, strong, answered, untouched, verdicts };
  }, [submissions, experiments, understanding]);

  // 前回この端末で確定した番号があれば、そのまま続きから始める
  useEffect(() => {
    setLoaded(true);
    try {
      const saved = normalizeStudentCode(localStorage.getItem(ACTIVE_KEY) ?? "");
      // 名簿から外れた番号（名簿を入れかえたときなど）では、続きから始めない。
      // デモ用の番号も、開き直すたびに番号の入力からやり直す。
      if (saved.length === 4 && isAllowedCode(saved) && !isDemoCode(saved)) {
        setStudentCode(saved);
        setCodeDraft(saved);
        loadRecord(saved);
        setExamResults(loadExamResults(saved));
      }
    } catch {
      /* 読めない環境では、番号の入力から始める */
    }
    // 初回マウントのときだけ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 保存とJSON出力で使う、記録の中身を1か所で組み立てる */
  const buildRecord = (): StudentRecord => ({
    version: 6,
    studentCode,
    drafts,
    submissions,
    experiments,
    understanding,
    wordDrafts,
    wordSubmissions,
    missionNotes,
    boughtHints,
    lastLesson,
    practiced,
    coins: {
      earned: summary.earned,
      spent: summary.spent,
      balance: summary.earned - summary.spent,
      hintsBought: Object.keys(boughtHints).filter((k) => boughtHints[k]),
      level: levelOf(summary.earned).level
    },
    attitude: {
      total: {
        reflection: summary.reflection,
        clear: summary.clear,
        score100: summary.perspective.attitude
      },
      byArea: summary.areas.map((a) => ({
        area: a.area,
        reflection: a.reflection,
        clear: a.clear,
        score100: a.perspective.attitude
      })),
      weight: { clear: 0.7, reflection: 0.3 }
    },
    summary,
    exams: examRows,
    examDetails: examResults
  });

  useEffect(() => {
    if (!loaded || studentCode.length !== 4) return;
    // デモ用の番号は、この端末に何も書き残さない（次の人にまっさらで渡すため）
    if (isDemoCode(studentCode)) return;
    const record: StudentRecord = buildRecord();
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${studentCode}`, JSON.stringify(record));
    } catch {
      /* 保存できない環境では黙って続行する */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, studentCode, drafts, submissions, experiments, understanding, summary, examResults, wordDrafts, wordSubmissions, missionNotes, boughtHints, lastLesson, practiced]);

  /**
   * 実験カードを統合・削除した版を挟むと、`${単元}-${実験番号}` のキーがずれる。
   * いま存在するカードのぶんだけを残して、古いキーは捨てる。
   */
  const pickLiveCards = <T,>(saved: Record<string, T> | undefined): Record<string, T> => {
    if (!saved) return {};
    const live: Record<string, T> = {};
    for (const [key, value] of Object.entries(saved)) {
      const at = key.lastIndexOf("-");
      const lesson = lessons.find((l) => l.id === key.slice(0, at));
      const index = Number(key.slice(at + 1));
      if (lesson && Number.isInteger(index) && index >= 0 && index <= lesson.theory.length) live[key] = value;
    }
    return live;
  };

  /** 買ったヒントも、いまの一覧にあるIDだけを残す */
  const pickLiveHints = (saved: Record<string, boolean> | undefined): Record<string, boolean> => {
    if (!saved) return {};
    const ids = new Set(hintList.map((h) => h.id));
    return Object.fromEntries(Object.entries(saved).filter(([id, on]) => on && ids.has(id)));
  };

  /** 保存済みの記録を読み出す。旧バージョンのデータもここで採点し直す */
  const loadRecord = (code: string) => {
    try {
      // デモ用の番号は、保存されたものを読まない＝いつもまっさらから始まる
      const saved = (isDemoCode(code)
        ? {}
        : JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${code}`) ?? "{}")) as Partial<StudentRecord>;
      const restored: Record<string, Submission> = {};
      lessons.forEach((lesson) => {
        const graded = gradeSubmission(lesson, saved.submissions?.[lesson.id] as Partial<Submission> | undefined);
        if (graded) restored[lesson.id] = graded;
      });
      setDrafts(saved.drafts ?? {});
      setSubmissions(restored);
      setExperiments(pickLiveCards(saved.experiments));
      setUnderstanding(pickLiveCards(saved.understanding));
      const restoredWords: Record<string, WordSubmission> = {};
      lessons.forEach((lesson) => {
        const graded = gradeWords(lesson.id, saved.wordSubmissions?.[lesson.id] as Partial<WordSubmission> | undefined);
        if (graded) restoredWords[lesson.id] = graded;
      });
      setWordDrafts(saved.wordDrafts ?? {});
      setWordSubmissions(restoredWords);
      setMissionNotes(saved.missionNotes ?? {});
      setBoughtHints(pickLiveHints(saved.boughtHints));
      setLastLesson(saved.lastLesson ?? "");
      setPracticed(saved.practiced ?? {});
      setExamResults(loadExamResults(code));
    } catch {
      setDrafts({});
      setSubmissions({});
      setExperiments({});
      setUnderstanding({});
      setWordDrafts({});
      setWordSubmissions({});
      setMissionNotes({});
      setBoughtHints({});
      setLastLesson("");
      setPracticed({});
    }
  };

  /** 入力中の番号に、このブラウザの記録があるかを見て、確認画面に出す内容を決める */
  /** 入力中の番号が名簿にあるか */
  const codeAllowed = codeDraft.length === 4 && isAllowedCode(codeDraft);

  const draftPreview = useMemo(() => {
    if (codeDraft.length !== 4 || !loaded || !isAllowedCode(codeDraft)) return null;
    try {
      const saved = (isDemoCode(codeDraft)
        ? null
        : JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${codeDraft}`) ?? "null")) as StudentRecord | null;
      if (!saved) return { found: false, lessons: 0, experiments: 0 };
      return {
        found: true,
        lessons: Object.keys(saved.submissions ?? {}).length,
        experiments: Object.values(saved.experiments ?? {}).filter(Boolean).length
      };
    } catch {
      return { found: false, lessons: 0, experiments: 0 };
    }
  }, [codeDraft, loaded]);

  /** 番号を確定する。確定するともう変えられない */
  const confirmCode = async () => {
    // 名簿にない番号では始められない
    if (!isAllowedCode(codeDraft)) return;
    if (codeDraft.length !== 4) return;

    // 教員用の番号は、番号だけでは入れない。合いことばを確かめる。
    // 一度通った端末では、次から聞き直さない。
    if (isTeacherCode(codeDraft)) {
      let already = false;
      try {
        // デモ用の番号は「一度通ったら次から省略」をしない。
        // 貸し出した端末に鍵が開いたまま残らないよう、毎回きく。
        already = !isDemoCode(codeDraft) && localStorage.getItem(teacherUnlockKey(codeDraft)) === "ok";
      } catch {
        already = false;
      }
      if (!already) {
        if (!teacherPassword.trim()) {
          setTeacherError("教員用のパスワードを入れてください。");
          return;
        }
        setTeacherBusy(true);
        setTeacherError("");
        const verdict = await checkTeacherPassword(basePath, teacherPassword);
        setTeacherBusy(false);
        if (verdict.state === "wrong") {
          setTeacherError("教員用のパスワードが違います。");
          return;
        }
        if (verdict.state === "error") {
          setTeacherError("確認できませんでした。もう一度試してください。");
          return;
        }
        // "none"（鍵をかけていない配置）と "ok" はどちらも通す
        if (verdict.state === "ok" && !isDemoCode(codeDraft)) {
          try {
            localStorage.setItem(teacherUnlockKey(codeDraft), "ok");
          } catch {
            /* 保存できない環境では、次回また聞くだけなので黙って続行する */
          }
        }
      }
    }

    setTeacherPassword("");
    setTeacherError("");
    setStudentCode(codeDraft);
    loadRecord(codeDraft);
    setExamResults(loadExamResults(codeDraft));
    // デモ用の番号は「次に開いたときの続き」にもしない
    if (isDemoCode(codeDraft)) return;
    try {
      localStorage.setItem(ACTIVE_KEY, codeDraft);
    } catch {
      /* 保存できない環境では黙って続行する */
    }
  };

  const choose = (lesson: Lesson, questionIndex: number, choiceIndex: number) => {
    if (submissions[lesson.id]) return;
    setDrafts((prev) => {
      const next = [...(prev[lesson.id] ?? Array(lesson.questions.length).fill(-1))];
      next[questionIndex] = choiceIndex;
      return { ...prev, [lesson.id]: next };
    });
  };

  const submitLesson = (lesson: Lesson) => {
    const answers = drafts[lesson.id] ?? [];
    if (answers.length !== lesson.questions.length || answers.some((a) => a === -1 || a === undefined)) return;
    const graded = gradeSubmission(lesson, { answers, submittedAt: new Date().toISOString() });
    if (graded) setSubmissions((prev) => ({ ...prev, [lesson.id]: graded }));
  };

  /** 1回目に間違えた問題だけ、もう1回だけ選び直せる */
  const retry = (lesson: Lesson, questionIndex: number, choiceIndex: number) => {
    const submission = submissions[lesson.id];
    if (!submission) return;
    if (submission.results[questionIndex] !== "2回目待ち") return;
    const retries = [...submission.retries];
    retries[questionIndex] = choiceIndex;
    const graded = gradeSubmission(lesson, { ...submission, retries, retriedAt: new Date().toISOString() });
    if (graded) setSubmissions((prev) => ({ ...prev, [lesson.id]: graded }));
  };

  /** 成績処理用の1行にまとめる（クラス・分野・本試験か追試か・点数） */
  const examRows: ExamRow[] = examResults.map((r) => ({
    studentCode,
    grade: gradeOf(studentCode),
    classNo: classOf(studentCode),
    seat: seatOf(studentCode),
    area: r.area,
    kind: r.kind,
    setId: r.setId,
    score: r.score,
    max: r.max,
    rate: Math.round((r.score / r.max) * 100),
    // 観点別は「点／満点」で出す。観点別評価にそのまま使えるようにするため
    knowledge: (() => {
      const v = r.byViewpoint.find((x) => x.key === "知識・技能");
      return v ? `${v.points ?? v.correct}/${v.maxPoints ?? v.total}` : "0/0";
    })(),
    thinking: (() => {
      const v = r.byViewpoint.find((x) => x.key === "思考・判断・表現");
      return v ? `${v.points ?? v.correct}/${v.maxPoints ?? v.total}` : "0/0";
    })(),
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    elapsedSeconds: r.elapsedSeconds
  }));

  /** テストの採点が終わったら受け取る。同じ分野・同じ種類の結果は上書きする */
  const acceptExamResult = (result: ExamResult) => {
    setExamResults((prev) => {
      const same = prev.find((r) => r.setId === result.setId && r.finishedAt === result.finishedAt);
      if (same) return prev;
      // デジタル分野のみなので、並べ替えは種類（本試験・追試など）だけで足りる
      const next = [...prev.filter((r) => !(r.area === result.area && r.kind === result.kind)), result].sort(
        (a, b) => a.kind.localeCompare(b.kind)
      );
      saveExamResults(studentCode, next);
      return next;
    });
  };

  /** いま持っているG */
  /**
   * のこりのG。ヒントの値段を変えたあとは、過去に買ったぶんが今の値段で計算し直されるので、
   * かせいだGを超えることがある。マイナスは出さない。
   */
  const balance = Math.max(0, summary.earned - summary.spent);
  const level = levelOf(summary.earned);

  /** そうびで語句を打ちこむ。正しければ、その場で集める（得点は動かさない） */
  const tryTerm = (key: string, item: WordItem | undefined, value: string) => {
    setTermDraft((prev) => ({ ...prev, [key]: value }));
    if (item && checkWord(item, value) === "correct") {
      setPracticed((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    }
  };

  /** ヒントを1つ買う。足りなければ何もしない */
  const buyHint = (id: string) => {
    if (balance < COIN.hint || boughtHints[id]) return;
    setBoughtHints((prev) => ({ ...prev, [id]: true }));
  };

  /** 重要語句テストを送信する */
  const submitWords = (lessonId: string, next: WordSubmission) =>
    setWordSubmissions((prev) => ({ ...prev, [lessonId]: next }));

  /** 理解度を選ぶと、その実験を「やった」として記録し、理解度も同時に残す */
  const markExperiment = (lessonId: string, index: number, level: UnderstandingLevel) => {
    const key = `${lessonId}-${index}`;
    setExperiments((prev) => ({ ...prev, [key]: true }));
    setUnderstanding((prev) => ({ ...prev, [key]: level }));
  };

  /** 重要語句テストで正解して手に入れた語 */
  const wonWords = useMemo(() => {
    const set = new Set<string>();
    lessons.forEach((lesson) => {
      const sub = wordSubmissions[lesson.id];
      if (!sub) return;
      wordsOf(lesson.id).forEach((w, i) => {
        const r = sub.results[i];
        if (r === "1回目で正解" || r === "2回目で正解") set.add(w.answer);
      });
    });
    return set;
  }, [wordSubmissions]);

  /** テストで取った語＋そうびで覚え直した語。★がつくのはこの集合 */
  const collectedWords = useMemo(() => {
    const set = new Set(wonWords);
    Object.keys(practiced).forEach((key) => {
      if (practiced[key]) set.add(key);
    });
    return set;
  }, [wonWords, practiced]);

  /** 用語集にある語の総数 */
  const allTermCount = lessons.reduce((sum, lesson) => sum + lesson.terms.length, 0);
  /** 買ったヒントの数 */
  const boughtCount = Object.values(boughtHints).filter(Boolean).length;

  /** 画面を切りかえる。単元なら「最後に開いた単元」としておぼえる */
  const openView = (id: string) => {
    if (lessons.some((lesson) => lesson.id === id)) setLastLesson(id);
    setActive(id);
  };

  /** その単元を討伐したか（実験ぜんぶ＋確認問題も語句も2回目まで終えた） */
  const clearedLesson = (lesson: Lesson) => {
    const expTotal = experimentCount(lesson);
    const allExp = Array.from({ length: expTotal }, (_, i) => experiments[`${lesson.id}-${i}`]).every(Boolean);
    const quiz = submissions[lesson.id];
    const word = wordSubmissions[lesson.id];
    return (
      allExp &&
      !!quiz &&
      !quiz.results.includes("2回目待ち") &&
      !!word &&
      !word.results.includes("2回目待ち")
    );
  };

  const lessonProgress = (lesson: Lesson) =>
    Array.from({ length: experimentCount(lesson) }, (_, i) => experiments[`${lesson.id}-${i}`]).filter(Boolean).length;

  const exportJson = () => {
    if (studentCode.length !== 4) return;
    const record: StudentRecord = {
      ...buildRecord(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${studentCode}_ddl_${todayNumber()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  /**
   * 学習を終了して、番号の入力からやり直せる状態に戻す。
   * 共用パソコンで次の人に渡すための機能なので、押し間違いを防ぐため2段階にしている。
   * 記録そのものは消えないので、同じ番号を入れ直せば続きから再開できる。
   */
  /**
   * 教員用の番号でだけ使える、記録の消去。
   *
   * 何を消すか
   *   ・その番号の学習記録（実験・確認問題・重要語句・G・レベル・ふり返り）
   *   ・その番号の分野別テストの結果
   *   ・その番号の分野別テストの途中経過（未提出のもの・残り時間もふくむ）
   *
   * 何を消さないか
   *   ・他の番号（生徒）の記録には、いっさい触れません
   *   ・画面の見え方（背景色・文字色・表示倍率）の設定
   *   ・教員用ログインを通した記録
   */
  const resetMyRecord = () => {
    const code = studentCode;
    if (!isTeacherCode(code)) return;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${code}`);
      localStorage.removeItem(EXAM_RESULTS_KEY(code));
      // 途中経過は「joho-ddl-exam:<番号>:<セットID>」の形。その番号のぶんだけ消す
      const prefix = `joho-ddl-exam:${code}:`;
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* 消せない環境では、画面の中身だけ初期化する */
    }
    setDrafts({});
    setSubmissions({});
    setExperiments({});
    setUnderstanding({});
    setWordDrafts({});
    setWordSubmissions({});
    setMissionNotes({});
    setBoughtHints({});
    setExamResults([]);
    setLastLesson("");
    setPracticed({});
    setResetConfirm(false);
    setResetDone(true);
    window.setTimeout(() => setResetDone(false), 6000);
  };

  const endLearning = () => {
    setStudentCode("");
    setCodeDraft("");
    setEndConfirm(false);
    setExamResults([]);
    setDrafts({});
    setSubmissions({});
    setExperiments({});
    setUnderstanding({});
    setWordDrafts({});
    setWordSubmissions({});
    setMissionNotes({});
    setBoughtHints({});
    setLastLesson("");
    setPracticed({});
    setActive("home");
    try {
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* 消せない環境では黙って続行する */
    }
  };

  /** 実験カードの共通枠。理論 → 操作 → 記録ボタン の順に並べる */
  const renderCard = (lesson: Lesson) => {
    const last = lesson.theory.length;
    return (index: number, title: string, goal: string, body: ReactNode): ReactNode => {
      const key = `${lesson.id}-${index}`;
      const done = !!experiments[key];
      const picked = understanding[key] ?? 0;
      const isMission = index === last;
      const label = isMission ? "応用" : `実験${index + 1}`;
      return (
        <article className={`experiment-card ${isMission ? "application-card" : ""}`} key={key}>
          <div className="experiment-heading">
            <span>{isMission ? "応用" : `実験 ${index + 1}`}</span>
            <div>
              <h2>{title}</h2>
              <p>{goal}</p>
            </div>
          </div>
          {isMission ? (
            <div className="mission-box">
              <b>応用ミッション</b>
              <p>{lesson.mission.body}</p>
              <div className="mission-steps">
                {lesson.mission.steps.map((item, i) => (
                  <div className="mission-step" key={item.label}>
                    <span>手順 {i + 1}</span>
                    <b>{item.label}</b>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="theory-box">
              <b>理論</b>
              <ul>
                {lesson.theory[index].split("\n").map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="experiment-body">{body}</div>
          <div className={`understand-bar ${done ? "recorded" : ""}`}>
            <b>
              {label}：どこまで分かった？
              <em>選ぶと記録されます。あとから選び直せます</em>
            </b>
            <div className="understand-choices">
              {UNDERSTANDING_CHOICES.map((choice) => (
                <button
                  type="button"
                  key={choice.score}
                  className={`understand-btn ${picked === choice.score ? "on" : ""}`}
                  aria-pressed={picked === choice.score}
                  onClick={() => markExperiment(lesson.id, index, choice.score)}
                >
                  <span>{choice.label}</span>
                  <em>{choice.detail}</em>
                </button>
              ))}
            </div>
          </div>
        </article>
      );
    };
  };

  return (
    <main>
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>
      <header className="topbar">
        <button className="brand" onClick={() => setActive("home")}>
          情報Ⅰ Digital Lab <small>2・3年次</small>
        </button>
        {studentCode.length === 4 && (
          <div className="purse" title="いま持っているG">
            <span className="purse-lv">Lv {level.level}</span>
            <span className="purse-g">
              <b>{balance}</b> G
            </span>
          </div>
        )}
        <nav className="nav">
          <button onClick={() => setActive("home")}>依頼掲示板</button>
          {studentCode.length === 4 && <button onClick={() => setActive("exam")}>分野別テスト</button>}
          <button onClick={() => setActive("results")}>ステータス</button>
          {studentCode.length === 4 &&
            (endConfirm ? (
              <>
                <button className="danger" onClick={endLearning}>
                  休む（記録は残ります）
                </button>
                <button onClick={() => setEndConfirm(false)}>やめる</button>
              </>
            ) : (
              <button onClick={() => setEndConfirm(true)}>宿屋で休む</button>
            ))}
        </nav>
      </header>

      <div className="shell" id="main" tabIndex={-1}>
        {/* デモ用の番号のときは、記録が残らないことをはっきり知らせる */}
        {isDemoCode(studentCode) && (
          <div className="demo-banner" role="status">
            <b>デモ・動作確認モード</b>
            <span>
              この番号（{DEMO_CODE}）で触った内容は<b>いっさい保存されません</b>。
              画面を再読み込みすると、まっさらな状態に戻ります。分野別テストは<b>デモ用の20問・10分</b>です。
            </span>
          </div>
        )}
        {active === "home" && (
          <>
            <section className="board">
              <div className="board-head">
                <div className="board-title">
                  <span className="board-eyebrow">依頼掲示板</span>
                  <h1>
                    受けたい依頼を選べ。
                    <em>残り {lessons.length - summary.completedLessons} 件</em>
                  </h1>
                  <p>討伐すると報酬が出る。★が多いほど手ごわいが、実入りもいい。</p>
                  {studentCode.length !== 4 && (
                  <div className="code-entry">
                    <div className="lookup">
                      <label>
                        4桁番号
                        <input
                          inputMode="numeric"
                          value={codeDraft}
                          onChange={(e) => setCodeDraft(normalizeStudentCode(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmCode();
                          }}
                          placeholder="例: 1205"
                          autoComplete="off"
                        />
                      </label>
                      <div
                        className={`status-pill ${codeDraft.length === 4 && !codeAllowed ? "ng" : ""}`}
                        role="status"
                        aria-live="polite"
                      >
                        {codeDraft.length !== 4
                          ? "半角数字4桁を入力"
                          : codeAllowed
                            ? describeCode(codeDraft)
                            : "この番号は使えません"}
                      </div>
                    </div>

                    {codeDraft.length === 4 && !codeAllowed && (
                      <div className="code-confirm ng">
                        <p className="code-ask">
                          <b>{codeDraft}</b> は名簿にありません。
                        </p>
                        <p className="code-note">
                          使えるのは、先生が名簿に登録した番号だけです（学年1けた＋組1けた＋出席番号2けた。
                          3年8組18番なら <b>3818</b>）。打ち間違いがないか確かめてください。
                        </p>
                        <div className="code-actions">
                          <button className="ghost" onClick={() => setCodeDraft("")}>
                            入力し直す
                          </button>
                        </div>
                      </div>
                    )}

                    {codeDraft.length === 4 && codeAllowed && draftPreview && (
                      <div className="code-confirm">
                        <p className="code-ask">
                          <b>{codeDraft}</b>（{describeCode(codeDraft)}）ですね？
                        </p>
                        <p className="code-note">
                          {draftPreview.found
                            ? `このブラウザに ${codeDraft} の記録があります（確認問題 ${draftPreview.lessons}単元送信済み・実験 ${draftPreview.experiments}個）。続きから始めます。`
                            : `このブラウザに ${codeDraft} の記録はありません。新しく始めます。`}
                        </p>
                        <p className="code-warn">
                          確定すると、番号を変えられなくなります。間違いがないか確かめてください。
                        </p>

                        {/* 教員用の番号は、番号だけでは入れない。合いことばをもう1つ確かめる。 */}
                        {isTeacherCode(codeDraft) && (
                          <div className="teacher-gate">
                            <p className="teacher-gate-lead">
                              これは<b>教員用の番号</b>です。先生用のパスワードを入れてください。
                            </p>
                            <PasswordField
                              label="教員用パスワード"
                              hint="先生だけが知っているもの"
                              value={teacherPassword}
                              onChange={(v) => {
                                setTeacherPassword(v);
                                setTeacherError("");
                              }}
                              onEnter={confirmCode}
                              placeholder="教員用パスワード"
                              note="打った文字は ● で伏せています。確かめたいときは「表示」を押してください。"
                            />
                            {teacherError && <div className="verdict ng">{teacherError}</div>}
                          </div>
                        )}

                        <div className="code-actions">
                          <button className="primary" onClick={confirmCode} disabled={teacherBusy}>
                            {teacherBusy ? "確認しています…" : `はい、${codeDraft} で始める`}
                          </button>
                          <button className="ghost" onClick={() => setCodeDraft("")}>
                            入力し直す
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>

                {studentCode.length === 4 && (
                  <div className="board-me">
                    <div className="me-ring">
                      <strong>{level.level}</strong>
                      <span>Lv</span>
                      <i style={{ width: `${Math.round(level.ratio * 100)}%` }} />
                    </div>
                    <div className="me-body">
                      <div className="me-head">
                        <b>No.{studentCode} の記録</b>
                        <span className="me-g">{balance} G</span>
                      </div>
                      <p className="me-next">
                        {level.maxed ? "最高レベルに到達している。" : `つぎのレベルまで あと ${level.toNext}G。`}
                      </p>
                      <p className="me-next">
                        討伐済 {summary.completedLessons}/{summary.lessonCount}件 ・ 総合点 {summary.totalScore}/
                        {summary.totalMax}
                      </p>
                      <div className="me-gauges">
                        {[
                          { key: "power", name: "ちから", value: summary.perspective.knowledge },
                          { key: "wisdom", name: "かしこさ", value: summary.perspective.thinking },
                          { key: "heart", name: "こころ", value: summary.perspective.attitude }
                        ].map((g) => (
                          <div className={`me-gauge g-${g.key}`} key={g.key}>
                            <span>{g.name}</span>
                            <div className="gauge-bar">
                              <i style={{ width: `${g.value}%` }} />
                            </div>
                            <b>{g.value}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {(["デジタル"] as const).map((area) => {
              const areaLessons = lessons.filter((lesson) => lesson.area === area);
              const cleared = areaLessons.filter((lesson) => clearedLesson(lesson)).length;
              return (
                <div className="board-area" key={area}>
                  <div className="board-area-head">
                    <h2>{area}分野の依頼</h2>
                    <span>
                      討伐済 {cleared}/{areaLessons.length}件
                    </span>
                  </div>
                  <div className="quest-grid">
                    {areaLessons.map((lesson) => {
                      const expTotal = experimentCount(lesson);
                      const expDone = lessonProgress(lesson);
                      const quiz = submissions[lesson.id];
                      const word = wordSubmissions[lesson.id];
                      const done = clearedLesson(lesson);
                      const started = expDone > 0 || !!quiz || !!word;
                      const star = DIFFICULTY[lesson.id] ?? 2;
                      const reward =
                        expTotal * COIN.experiment +
                        lesson.questions.length * COIN.first +
                        WORDS_PER_LESSON * COIN.first +
                        COIN.lessonClear;
                      return (
                        <button
                          className={`quest ${done ? "done" : started ? "doing" : ""}`}
                          key={lesson.id}
                          onClick={() => openView(lesson.id)}
                        >
                          <span className="quest-pin" aria-hidden="true" />
                          <div className="quest-head">
                            <b className="quest-no">{lesson.no}</b>
                            <span className="quest-sep" aria-hidden="true">／</span>
                            <span className={`quest-state ${done ? "done" : started ? "doing" : ""}`}>
                              {done ? "討伐済" : started ? "受注中" : "受注可"}
                            </span>
                          </div>
                          <h3>{lesson.title}</h3>
                          <div className="quest-meta">
                            <span className="quest-star" aria-label={`手ごわさ ${star}`}>
                              {"★".repeat(star)}
                              <i>{"★".repeat(3 - star)}</i>
                            </span>
                            <span className="quest-reward">報酬 {reward}G</span>
                          </div>
                          <div className="quest-meter">
                            <div className="quest-bar">
                              <i style={{ width: `${(expDone / expTotal) * 100}%` }} />
                            </div>
                            <em>
                              実験 {expDone}/{expTotal}
                            </em>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </section>
          </>
        )}

        {current && (
          <section className="workspace">
            <button className="back" onClick={() => setActive("home")}>
              依頼掲示板へ戻る
            </button>
            <div className="lesson-hero">
              <div>
                <h1>
                  {current.no} {current.title}
                </h1>
                <p>{current.subtitle}</p>
                <div className="tags">
                  {current.concepts.map((concept) => (
                    <span key={concept}>{concept}</span>
                  ))}
                </div>
                <div className="muted small refs">
                  <b>教科書</b>
                  <span>{current.textbook}</span>
                  <b>ITパスポート</b>
                  <span>{current.itpassport}</span>
                  <b>学習時間</b>
                  <span>目安 {current.minutes}分</span>
                </div>
              </div>
              <div className="lesson-status">
                <span>
                  実験 {lessonProgress(current)}/{experimentCount(current)}
                </span>
                <span>
                  確認問題 {submissions[current.id] ? `${submissions[current.id].correct}/${current.questions.length}` : "未送信"}
                </span>
              </div>
            </div>

            <section className="steps-box">
              <h2>
                {current.title}を理解する{current.steps.length}つのステップ
              </h2>
              <ol>
                {current.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </section>

            <section className="terms-box">
              <button type="button" className="terms-toggle" onClick={() => setShowTerms(!showTerms)}>
                重要語句 {current.terms.length}語 {showTerms ? "を閉じる" : "を開く"}
              </button>
              {showTerms && (
                <dl>
                  {current.terms.map((term) => (
                    <div key={term.word}>
                      <dt>{term.word}</dt>
                      <dd>{term.meaning}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <HintShopContext.Provider
              value={{
                balance,
                price: COIN.hint,
                bought: (id) => !!boughtHints[id],
                buy: buyHint
              }}
            >
              <Experiments
                lessonId={current.id}
                card={renderCard(current)}
                missionNote={missionNotes[current.id] ?? ""}
                onMissionNote={(value) => setMissionNotes((prev) => ({ ...prev, [current.id]: value }))}
              />

              <WordQuiz
                lessonId={current.id}
                submission={wordSubmissions[current.id]}
                draft={wordDrafts[current.id] ?? wordsOf(current.id).map(() => "")}
                onDraft={(next) => setWordDrafts((prev) => ({ ...prev, [current.id]: next }))}
                onSubmit={(next) => submitWords(current.id, next)}
              />
            </HintShopContext.Provider>

            <section className="quiz">
              <h2>確認問題 {current.questions.length}問</h2>
              <p className="muted small">
                共通テスト・ITパスポート・基本情報技術者の出題範囲に対応しています。出典のある問題は問題文の下に表示されます。
              </p>
              {current.questions.map((question, index) => {
                const submitted = submissions[current.id];
                const result = submitted?.results[index];
                // 1回目に間違えて、まだ2回目を選んでいない状態
                const awaiting = result === "2回目待ち";
                const first = submitted ? submitted.answers[index] : (drafts[current.id]?.[index] ?? -1);
                const second = submitted ? submitted.retries[index] : -1;
                const selected = awaiting ? first : second >= 0 ? second : first;
                // 2回目待ちのあいだは、正解も解説もまだ見せない
                const resolved = !!submitted && !awaiting;
                return (
                  <article className={`question ${awaiting ? "retry-open" : ""}`} key={question.id}>
                    <h3>
                      <span className={`level level-${question.level}`}>{question.level}</span>
                      Q{index + 1}. {question.q}
                      {result && result !== "2回目待ち" && (
                        <span className={`result-tag ${result === "1回目で正解" ? "first" : result === "2回目で正解" ? "second" : "miss"}`}>
                          {result}
                          {result === "2回目で正解" ? "（0.5点）" : result === "1回目で正解" ? "（1点）" : "（0点）"}
                        </span>
                      )}
                    </h3>
                    {question.figure && <QuestionFigure name={question.figure} />}
                    {question.source && <p className="source">出典: {question.source}</p>}
                    {awaiting && (
                      <p className="retry-banner">
                        1回目は不正解でした。<b>もう1回だけ選べます</b>（2回目で正解すると0.5点）。よく読んで選び直しましょう。
                      </p>
                    )}
                    <div className="choices" role="radiogroup" aria-label={`${index + 1}問目の選択肢`}>
                      {question.choices.map((choice, choiceIndex) => {
                        const isFirstPick = !!submitted && first === choiceIndex;
                        const isSecondPick = second === choiceIndex;
                        return (
                          <button
                            key={choice}
                            role="radio"
                            aria-checked={awaiting ? isSecondPick : selected === choiceIndex}
                            // 未送信なら自由に選べる。2回目待ちのあいだは、1回目に選んだ選択肢以外を押せる
                            disabled={submitted ? !awaiting || isFirstPick : false}
                            className={[
                              !submitted && selected === choiceIndex ? "selected" : "",
                              resolved && question.answer === choiceIndex ? "correct" : "",
                              resolved && selected === choiceIndex && question.answer !== choiceIndex ? "wrong" : "",
                              resolved && isFirstPick && question.answer !== choiceIndex ? "wrong tried" : "",
                              awaiting && isFirstPick ? "wrong tried" : "",
                              isSecondPick ? "second-pick" : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => (awaiting ? retry(current, index, choiceIndex) : choose(current, index, choiceIndex))}
                          >
                            {String.fromCharCode(65 + choiceIndex)}. {choice}
                            {isFirstPick && question.answer !== choiceIndex && <em className="pick-tag">1回目に選んだ</em>}
                            {resolved && isSecondPick && <em className="pick-tag">2回目に選んだ</em>}
                          </button>
                        );
                      })}
                    </div>
                    {resolved && (
                      <div className="feedback">
                        {result === "1回目で正解"
                          ? "1回目で正解。"
                          : result === "2回目で正解"
                            ? "2回目で正解。半分の0.5点です。"
                            : "2回とも不正解。"}{" "}
                        {question.explanation}
                      </div>
                    )}
                  </article>
                );
              })}
              {!submissions[current.id] ? (
                <button
                  className="primary"
                  disabled={(drafts[current.id] ?? []).filter((a) => a >= 0).length !== current.questions.length}
                  onClick={() => submitLesson(current)}
                >
                  {current.questions.length}問の解答を送信して得点を確定
                </button>
              ) : (
                (() => {
                  const submission = submissions[current.id]!;
                  const waiting = submission.results.filter((r) => r === "2回目待ち").length;
                  return (
                    <div className="notice">
                      {waiting > 0 ? (
                        <>
                          あと <b>{waiting}問</b> が2回目の解答待ちです。上の赤い枠の問題を選び直すと得点が確定します。
                        </>
                      ) : (
                        <>
                          この単元の得点は <b>{submission.score}</b> / {current.questions.length}点です（1回目正解 {submission.correct}問、
                          2回目正解 {submission.secondCorrect}問）。記録はこのブラウザに保存されています。
                        </>
                      )}
                    </div>
                  );
                })()
              )}
            </section>

          </section>
        )}

        {active === "terms" && (
          <section className="workspace">
            <button className="back" onClick={() => setActive("results")}>
              ステータスへ戻る
            </button>
            <h1>そうび ── 重要語句</h1>
            <p className="muted">
              全{allTermCount}語。<b>★のついた{words.length}語</b>は、その単元の重要語句テストで正解すると出てきます。
              テストで取れなかった語も、<b>ここで打ち直せば集まります</b>（得点は変わりません）。
              いま <b>{collectedWords.size} / {words.length}</b> 集めました。単元名を押すと、その単元へ移動します。
            </p>
            <div className="collect-bar">
              <i style={{ width: `${Math.round((collectedWords.size / words.length) * 100)}%` }} />
            </div>
            {lessons.map((lesson) => {
              const testWords = new Set(wordsOf(lesson.id).map((w) => w.answer));
              return (
                <div className="term-block" key={lesson.id}>
                  <button className="term-head" type="button" onClick={() => openView(lesson.id)}>
                    <b>{lesson.no}</b>
                    <span>{lesson.title}</span>
                    <em>
                      {lesson.terms.length}語 ／ 集めた{" "}
                      {wordsOf(lesson.id).filter((w) => collectedWords.has(w.answer)).length} /{" "}
                      {wordsOf(lesson.id).length}
                    </em>
                  </button>
                  <dl className="term-list">
                    {lesson.terms.map((term) => {
                      // かっこ書きを外した見出し語でも照合する
                      // 「母平均 μ」「帰無仮説 H0」のように、うしろに記号がついた見出し語でも照合する
                      const bare = term.word
                        .replace(/[(（].*?[)）]/g, "")
                        .replace(/\s+[A-Za-zμσα-ωΑ-Ω][A-Za-z0-9]*\s*$/, "")
                        .trim();
                      const onTest = testWords.has(term.word) || testWords.has(bare);
                      const answer = testWords.has(term.word) ? term.word : bare;
                      const got = onTest && collectedWords.has(answer);
                      const hidden = onTest && !got;
                      const key = answer;
                      const item = hidden ? wordsOf(lesson.id).find((x) => x.answer === answer) : undefined;
                      const verdict = item ? checkWord(item, termDraft[key] ?? "") : "empty";
                      return (
                        <div key={term.word} className={`${onTest ? "on-test" : ""} ${got ? "got" : ""} ${hidden ? "hidden-word" : ""}`}>
                          <dt>
                            {onTest && <i aria-label={got ? "集めました" : "まだ集めていません"}>{got ? "★" : "☆"}</i>}
                            {hidden ? <span className="masked">？ ？ ？</span> : term.word}
                          </dt>
                          <dd>{term.meaning}</dd>
                          {hidden && (
                            <div className="term-try">
                              <input
                                value={termDraft[key] ?? ""}
                                onChange={(e) => tryTerm(key, item, e.target.value)}
                                placeholder="思い出して打ってみる"
                                spellCheck={false}
                                autoComplete="off"
                                aria-label={`${term.meaning} の語句を入力`}
                              />
                              {verdict === "close" && <span className="term-msg close">おしい！</span>}
                              {verdict === "wrong" && <span className="term-msg">ちがいます</span>}
                              {verdict === "empty" && (
                                <span className="term-msg">テストで正解するか、ここで打てば集まります</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
          </section>
        )}

        {active === "hintshop" && (
          <section className="workspace">
            <button className="back" onClick={() => setActive("results")}>
              ステータスへ戻る
            </button>
            <h1>ヒントを買う</h1>
            <p className="muted">
              ヒントは全部で{hintList.length}個（実験のヒント{hintList.filter((h) => h.kind === "実験").length}個 ＋ 重要語句の最初の1文字
              {hintList.filter((h) => h.kind === "語句").length}個）。1つ<b>{COIN.hint}G</b>です。
              一度買えば、そのあとはいつでも見られます。いま <b>{balance}G</b> 持っています
              （買えるのは {Math.floor(balance / COIN.hint)}個）。
            </p>
            <p className="muted small">
              中身はここでは出しません。買うと、その実験の中で開けるようになります。
              実験の見出しを押すと、その単元へ移動します。
            </p>
            <div className="shop-grid">
              {hintList.map((hint) => {
                const lesson = lessons.find((l) => l.id === hint.lessonId);
                if (!lesson) return null;
                const last = lesson.theory.length;
                const label =
                  hint.kind === "語句"
                    ? "重要語句テスト"
                    : hint.index === last
                      ? "応用"
                      : `実験${hint.index + 1}`;
                const owned = !!boughtHints[hint.id];
                const short = COIN.hint - balance;
                return (
                  <div className={`shop-row ${owned ? "owned" : ""}`} key={hint.id}>
                    <button type="button" className="shop-where" onClick={() => openView(lesson.id)}>
                      <b>
                        {lesson.no} {label}
                      </b>
                      <span>{hint.title}</span>
                    </button>
                    {owned ? (
                      <span className="shop-owned">開放ずみ</span>
                    ) : (
                      <button
                        type="button"
                        className="shop-buy"
                        onClick={() => buyHint(hint.id)}
                        disabled={short > 0}
                        title={short > 0 ? `あと ${short}G 足りません` : ""}
                      >
                        {COIN.hint}G で開く
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {active === "exam" && studentCode.length === 4 && (
          <ExamView studentCode={studentCode} onResult={acceptExamResult} />
        )}

        {active === "results" && (
          <section className="workspace status-view">
            <button className="back" onClick={() => setActive("home")}>
              依頼掲示板へ戻る
            </button>

            <div className="status-hero">
              <div className="status-title">
                <span className="board-eyebrow">ステータス</span>
                <h1>
                  レベル {level.level}。
                  {level.maxed ? "最高レベルに到達している。" : `つぎのレベルまで あと ${level.toNext}G。`}
                </h1>
                <p className="status-lead">
                  実験をやると「かしこさ」が、確認問題と重要語句に正解すると「ちから」が、
                  ふり返りと討伐で「こころ」が上がります。
                </p>
                <div className="status-lvbar">
                  <i style={{ width: `${Math.round(level.ratio * 100)}%` }} />
                </div>
              </div>

              <div className="status-window">
                <div className="status-window-head">
                  <b>{studentCode || "----"} のステータス</b>
                  <span>Lv.{level.level}</span>
                  <span className="status-coin">{balance} G</span>
                </div>
                <div className="gauges">
                  <div className="gauge g-power">
                    <span className="gauge-name">ちから</span>
                    <div className="gauge-bar">
                      <i style={{ width: `${summary.perspective.knowledge}%` }} />
                    </div>
                    <b>
                      {summary.perspective.knowledge} <em>/ 100</em>
                    </b>
                    <small>
                      知識・技能　確認問題 {summary.quizScore}/{summary.quizMax}点 ＋ 重要語句 {summary.wordScore}/
                      {summary.wordMax}点
                    </small>
                  </div>
                  <div className="gauge g-wisdom">
                    <span className="gauge-name">かしこさ</span>
                    <div className="gauge-bar">
                      <i style={{ width: `${summary.perspective.thinking}%` }} />
                    </div>
                    <b>
                      {summary.perspective.thinking} <em>/ 100</em>
                    </b>
                    <small>
                      思考・判断・表現　実施した実験 {summary.experimentDone}/{summary.experimentMax}個
                    </small>
                  </div>
                  <div className="gauge g-heart">
                    <span className="gauge-name">こころ</span>
                    <div className="gauge-bar">
                      <i style={{ width: `${summary.perspective.attitude}%` }} />
                    </div>
                    <b>
                      {summary.perspective.attitude} <em>/ 100</em>
                    </b>
                    <small>
                      主体性　討伐済 {summary.clear.done}/{summary.clear.max}件 ・ ふり返りの申告{" "}
                      {summary.reflection.done}/{summary.reflection.max}実験
                    </small>
                  </div>
                </div>
                <div className="command-window">
                  <button type="button" className="command" onClick={() => openView(lastLesson || lessons[0].id)}>
                    <span>つづきから</span>
                    <em>{lessons.find((l) => l.id === (lastLesson || lessons[0].id))?.no ?? "D0"}</em>
                  </button>
                  <button type="button" className="command" onClick={() => setActive("home")}>
                    <span>たたかう</span>
                    <em>残り {lessons.length - summary.completedLessons}件</em>
                  </button>
                  <button type="button" className="command" onClick={() => setActive("terms")}>
                    <span>そうび</span>
                    <em>
                      集めた {collectedWords.size}/{words.length}
                    </em>
                  </button>
                  <button type="button" className="command" onClick={() => setActive("hintshop")}>
                    <span>ヒントを買う</span>
                    <em>
                      のこり {hintList.length - boughtCount}個 ／ {COIN.hint}G
                    </em>
                  </button>
                </div>

                <p className="status-purse-line">
                  かせいだ {summary.earned}G ・ つかった {summary.spent}G ・ のこり <b>{balance}G</b>　／　開放したヒント{" "}
                  {Object.values(boughtHints).filter(Boolean).length}個
                </p>
              </div>
            </div>

            <div className="result-grid">
              <div className="metric">
                <span>総合点（デジタル分野）</span>
                <b>{summary.totalScore}</b>
                <small>/{summary.totalMax}</small>
              </div>
              <div className="metric">
                <span>討伐済の依頼</span>
                <b>{summary.completedLessons}</b>
                <small>/{summary.lessonCount}件</small>
              </div>
              <div className="metric">
                <span>ふり返りを申告した実験</span>
                <b>{summary.understandingAnswered}</b>
                <small>/{summary.experimentMax}個</small>
              </div>
            </div>
            <p className="muted small">
              総合点は、デジタル分野の<b>100点満点</b>です。
              ちから（確認問題＋重要語句）60％、かしこさ（実験）40％で計算します。
              分野別テストの点と、こころの点は、この100点には入っていません。
              Gは道具を買うためのもので、成績には使いません。
            </p>

            <div className="area-grid">
              {summary.areas.map((area) => (
                <div className="area-card" key={area.area}>
                  <div className="area-head">
                    <b>{area.area}分野</b>
                    <span>
                      {area.lessonCount}単元 ・ 確認問題{area.quizMax}問 ・ 実験{area.experimentMax}個
                    </span>
                  </div>
                  <div className="area-score">
                    <strong>{area.totalScore}</strong>
                    <span>/ 100点</span>
                  </div>
                  <div className="area-bar">
                    <i style={{ width: `${area.totalScore}%` }} />
                  </div>
                  <dl className="area-detail">
                    <div>
                      <dt>確認問題の素点</dt>
                      <dd>
                        {area.quizScore} / {area.quizMax}点
                      </dd>
                    </div>
                    <div>
                      <dt>1回目で正解</dt>
                      <dd>{area.firstCorrect}問</dd>
                    </div>
                    <div>
                      <dt>2回目で正解</dt>
                      <dd>{area.secondCorrect}問</dd>
                    </div>
                    <div>
                      <dt>実験の実施</dt>
                      <dd>
                        {area.experimentDone} / {area.experimentMax}個
                      </dd>
                    </div>
                    <div>
                      <dt>知識・技能</dt>
                      <dd>{area.perspective.knowledge} / 100</dd>
                    </div>
                    <div>
                      <dt>思考・判断・表現</dt>
                      <dd>{area.perspective.thinking} / 100</dd>
                    </div>
                    <div>
                      <dt>ふり返りの申告</dt>
                      <dd>
                        {area.understandingAnswered} / {area.experimentMax}個
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            {/* --- 教員用の番号のときだけ出る、記録のリセット --- */}
            {isTeacherCode(studentCode) && (
              <section className="dashboard teacher-reset">
                <div className="dash-head">
                  <h2>記録のリセット（先生用）</h2>
                  <span className="muted small">この操作は教員用の番号でだけ出ます</span>
                </div>

                {resetDone && (
                  <div className="verdict ok" role="status">
                    リセットしました。実験・確認問題・重要語句・G・レベル・分野別テストの結果が、
                    すべてまっさらな状態に戻っています。
                  </div>
                )}

                <p className="reset-lead">
                  <b>いま入っている番号（{studentCode}）の記録だけ</b>を、この端末から消します。
                  問題を作り直したあとや、次の先生に画面を渡す前に使ってください。
                </p>

                <dl className="reset-what">
                  <div>
                    <dt>消えるもの</dt>
                    <dd>
                      実験の記録・確認問題の解答と得点・重要語句・買ったヒント・G・レベル・ふり返り・
                      <b>分野別テストの結果</b>・受験中だった問題の途中経過（残り時間もふくむ）
                    </dd>
                  </div>
                  <div>
                    <dt>消えないもの</dt>
                    <dd>
                      <b>生徒（他の番号）の記録には、いっさい触れません。</b>
                      画面の色や表示倍率の設定も、そのまま残ります
                    </dd>
                  </div>
                </dl>

                {resetConfirm ? (
                  <div className="reset-confirm">
                    <p>
                      <b>本当にリセットしますか。取り消せません。</b>
                      {studentCode} の記録
                      {examResults.length > 0 ? `（分野別テストの結果 ${examResults.length}件をふくむ）` : ""}
                      が、この端末から消えます。
                    </p>
                    <div className="code-actions">
                      <button className="ghost" onClick={() => setResetConfirm(false)}>
                        やめる
                      </button>
                      <button className="danger" onClick={resetMyRecord}>
                        はい、{studentCode} の記録を消す
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="code-actions">
                    <button className="danger" onClick={() => setResetConfirm(true)}>
                      {studentCode} の記録をリセットする
                    </button>
                  </div>
                )}
              </section>
            )}

            {examResults.length > 0 && (
              <section className="dashboard exam-results">
                <div className="dash-head">
                  <h2>分野別テストの結果</h2>
                  <span className="muted small">
                    {describeCode(studentCode)} ／ 普段の学習の点数とは別に記録しています
                  </span>
                </div>

                <div className="area-grid">
                  {examResults.map((r) => (
                    <div className="area-card" key={r.setId + r.finishedAt}>
                      <div className="area-head">
                        <b>
                          {r.area}分野
                          <span className={`result-tag ${r.kind === "追試" ? "second" : "first"}`}>{r.kind}</span>
                        </b>
                        <span>
                          {r.setId} ／ {formatElapsed(r.elapsedSeconds)} ／ {new Date(r.finishedAt).toLocaleString("ja-JP")}
                        </span>
                      </div>
                      <div className="area-score">
                        <strong>{r.score}</strong>
                        <span>/ {r.max}点</span>
                      </div>
                      <div className="area-bar">
                        <i style={{ width: `${(r.score / r.max) * 100}%` }} />
                      </div>
                      <dl className="area-detail">
                        {r.byViewpoint.map((row) => (
                          <div key={row.key}>
                            <dt>{row.label}</dt>
                            <dd>
                              {row.points ?? row.correct}/{row.maxPoints ?? row.total}点（{row.rate}%）
                            </dd>
                          </div>
                        ))}
                        {r.byLevel.map((row) => (
                          <div key={row.key}>
                            <dt>{row.label}</dt>
                            <dd>
                              {row.correct}/{row.total}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>

                {examResults.map((r) => {
                  const weak = [...r.byLesson].sort((a, b) => a.rate - b.rate).slice(0, 3);
                  return (
                    <div className="dash-panel" key={"weak-" + r.setId + r.finishedAt}>
                      <h3>
                        {r.area}分野・{r.kind}　立て直したい単元
                      </h3>
                      <p className="muted small">正答率の低い順に3つ。単元名を押すと、その単元の実験へ移動します。</p>
                      <div className="level-bars">
                        {weak.map((row) => {
                          const lesson = lessons.find((l) => `${l.no} ${l.title}` === row.label);
                          return (
                            <div className="level-row" key={row.key}>
                              {lesson ? (
                                <button className="lesson-name link" onClick={() => openView(lesson.id)}>
                                  {row.label}
                                </button>
                              ) : (
                                <span className="lesson-name">{row.label}</span>
                              )}
                              <div className="bar-track">
                                <i
                                  style={{ width: `${row.rate}%` }}
                                  className={row.rate >= 80 ? "good" : row.rate >= 60 ? "warn" : "bad"}
                                />
                              </div>
                              <b>{row.rate}%</b>
                              <em>
                                {row.correct}/{row.total}問
                              </em>
                            </div>
                          );
                        })}
                      </div>
                      {weak[0] &&
                        (() => {
                          const lesson = lessons.find((l) => `${l.no} ${l.title}` === weak[0].label);
                          return lesson ? (
                            <div className="remedy">
                              <p className="remedy-stumble">{lesson.remedy.stumble}</p>
                              <ol className="remedy-actions">
                                {lesson.remedy.actions.map((a) => (
                                  <li key={a}>{a}</li>
                                ))}
                              </ol>
                            </div>
                          ) : null;
                        })()}
                    </div>
                  );
                })}
              </section>
            )}

            <p className="muted small">
              討伐済の依頼（実験・重要語句・確認問題を、2回目待ちを残さず終えた単元）: {summary.completedLessons}/{" "}
              {summary.lessonCount}件　／　確認問題は 1回目で {summary.quizCorrect}問、2回目で {summary.quizSecondCorrect}問 正解しています。
            </p>

            <section className="dashboard">
              <div className="dash-head">
                <h2>理解度ダッシュボード</h2>
                <span className="muted small">送信済みの確認問題から、得意な単元と弱点を割り出します</span>
              </div>

              <div className="verdict-box">
                {analysis.verdicts.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              <div className="dash-panel">
                  <h3>難易度別の到達度</h3>
                  <p className="muted small">同じ範囲でも、問われ方が変わると正答率は変わります。</p>
                  <div className="level-bars">
                    {analysis.byLevel.map((row) => (
                      <div className="level-row" key={row.level} title={`${row.level}: ${row.correct}/${row.total}問正解`}>
                        <span className={`level level-${row.level}`}>{row.level}</span>
                        <div className="bar-track">
                          <i style={{ width: `${row.rate ?? 0}%` }} />
                        </div>
                        <b>{row.rate === null ? "—" : `${row.rate}%`}</b>
                        <em>
                          {row.correct}/{row.total}問
                        </em>
                      </div>
                    ))}
                  </div>
                  <p className="hint-line">
                    基礎は用語や定義、共通テスト以上は計算と判断を問う問題です。差が20ポイント以上あると、覚え方と使い方のどちらかに偏りがあります。
                  </p>
              </div>

              <div className="dash-panel">
                  <h3>単元別の理解度マップ</h3>
                  <p className="muted small">色と文字の両方で状態を示しています。押すとその単元へ移動します。</p>
                  <div className="unit-map">
                    {(["デジタル"] as const).map((area) => (
                      <div className="map-col" key={area}>
                        <h4>{area}分野</h4>
                        {analysis.perLesson
                          .filter((row) => row.lesson.area === area)
                          .map((row) => (
                            <button
                              type="button"
                              key={row.lesson.id}
                              className={`map-row state-${row.state}`}
                              onClick={() => setActive(row.lesson.id)}
                              title={`${row.lesson.no} ${row.lesson.title} — ${row.submitted ? `${row.correct}/${row.total}問正解` : "未送信"} / 実験 ${row.expDone}/${row.expTotal}`}
                            >
                              <span className="map-no">{row.lesson.no}</span>
                              <span className="map-title">{row.lesson.title}</span>
                              <span className="bar-track">
                                <i style={{ width: `${row.rate ?? 0}%` }} />
                              </span>
                              <b>{row.rate === null ? "—" : `${row.rate}%`}</b>
                              <em className="map-state">
                                {row.state === "good" ? "定着" : row.state === "warn" ? "あと一歩" : row.state === "bad" ? "要復習" : "未受験"}
                              </em>
                              <em className="map-exp">
                                実験 {row.expDone}/{row.expTotal}
                              </em>
                            </button>
                          ))}
                      </div>
                    ))}
                  </div>
              </div>

              {analysis.weak.length > 0 && (
                <div className="dash-panel">
                  <h3>いま優先して立て直したい単元</h3>
                  <p className="muted small">正答率の低い順に、最大3つまで表示しています。</p>
                  <div className="weak-cards">
                    {analysis.weak.map((row) => (
                      <article className="weak-card" key={row.lesson.id}>
                        <header>
                          <span className="map-no">{row.lesson.no}</span>
                          <b>{row.lesson.title}</b>
                          <em title={`1回目で正解 ${row.correct}問、2回目で正解 ${Math.round((row.score - row.correct) * 2)}問`}>
                            {row.score}/{row.total}点（{row.rate}%）
                          </em>
                        </header>
                        <div className="weak-block">
                          <span>つまずいている可能性</span>
                          <p>{row.lesson.remedy.stumble}</p>
                        </div>
                        {row.wrong.length > 0 && (
                          <div className="weak-block">
                            <span>間違えた問題で問われていたこと</span>
                            <ul>
                              {row.wrong.slice(0, 3).map((w) => (
                                <li key={w.question.id}>{w.question.q.length > 46 ? `${w.question.q.slice(0, 46)}…` : w.question.q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="weak-block">
                          <span>こうすれば分かるようになります</span>
                          <ol className="remedy-steps">
                            {row.lesson.remedy.actions.map((action, i) => (
                              <li key={action}>
                                <i>{i + 1}</i>
                                {action}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div className="weak-foot">
                          <span className="muted small">
                            実験の実施 {row.expDone}/{row.expTotal}
                            {row.expDone < row.expTotal / 2 ? "（まず実験に戻るのが近道です）" : ""}
                          </span>
                          <button type="button" className="primary" onClick={() => setActive(row.lesson.id)}>
                            {row.lesson.no} をやり直す
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {analysis.strong.length > 0 && (
                <div className="dash-panel">
                  <h3>もう身についている単元</h3>
                  <div className="strong-list">
                    {analysis.strong.map((row) => (
                      <span key={row.lesson.id}>
                        {row.lesson.no} {row.lesson.title}
                        <i>{row.rate}%</i>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.answered.some((row) => row.wrong.length > 0) && (
                <details className="dash-panel review">
                  <summary>
                    間違えた問題をまとめて復習する（{analysis.answered.reduce((a, b) => a + b.wrong.length, 0)}問）
                  </summary>
                  {analysis.answered
                    .filter((row) => row.wrong.length > 0)
                    .map((row) => (
                      <div className="review-lesson" key={row.lesson.id}>
                        <h4>
                          {row.lesson.no} {row.lesson.title}
                        </h4>
                        {row.wrong.map((w) => (
                          <div className="review-item" key={w.question.id}>
                            <p className="review-q">
                              <span className={`level level-${w.question.level}`}>{w.question.level}</span>
                              {w.question.q}
                            </p>
                            <p className="review-a">
                              <span className="ng">1回目: {w.picked >= 0 ? w.question.choices[w.picked] : "無回答"}</span>
                              {w.retried >= 0 && (
                                <span className={w.result === "2回目で正解" ? "ok" : "ng"}>
                                  2回目: {w.question.choices[w.retried]}
                                </span>
                              )}
                              {w.result === "2回目待ち" && <span className="wait">2回目はまだ解答していません</span>}
                              <span className="ok">正解: {w.question.choices[w.question.answer]}</span>
                            </p>
                            {w.result !== "2回目待ち" && <p className="review-e">{w.question.explanation}</p>}
                          </div>
                        ))}
                      </div>
                    ))}
                </details>
              )}
            </section>
            <div className="unit-results">
              {(["デジタル"] as const).map((area) => (
                <div className="unit-col" key={area}>
                  <h4>{area}分野</h4>
                  {lessons
                    .filter((lesson) => lesson.area === area)
                    .map((lesson) => (
                      <div className="unit-line" key={lesson.id}>
                        <span>{lesson.no}</span>
                        <b>{lesson.title}</b>
                        <em>
                          実験 {lessonProgress(lesson)}/{experimentCount(lesson)}
                        </em>
                        <em>
                          {submissions[lesson.id]
                            ? `${submissions[lesson.id].score}/${lesson.questions.length}点（1回目${submissions[lesson.id].correct}問・2回目${submissions[lesson.id].secondCorrect}問）`
                            : "未送信"}
                        </em>
                      </div>
                    ))}
                </div>
              ))}
            </div>
            <div className="actions">
              <button className="primary" disabled={studentCode.length !== 4} onClick={exportJson}>
                JSONを保存
              </button>
              <span className="muted">
                {studentCode.length === 4 ? `保存ファイル名: ${studentCode}_ddl_${todayNumber()}.json` : "4桁番号を入力するとJSON出力できます。"}
              </span>
            </div>
          </section>
        )}
      </div>
      <footer>
        {isDemoCode(studentCode)
          ? "デモ・動作確認用の番号なので、学習履歴と得点は保存されません。氏名・名簿データも含みません。"
          : "学習履歴と得点は使用中のブラウザに保存されます。氏名・名簿データは含みません。"}
        <br />
        単元構成は岡田メソッド（兵庫県立明石南高等学校 岡田）のExcelシートに対応しています。掲載した過去問題の著作権はIPA（情報処理推進機構）に帰属します。
      </footer>
    </main>
  );
}
