"use client";

// 分野別テストの画面。ITパスポート試験のCBT画面に合わせた作りにしてある。
//
// 流れ
//   1. 先生が言うパスワードを入れる
//   2. その人が受けられる暗号ファイルを取りに行き、復号できたものが今日のテストになる
//   3. 操作説明（4ページ）を読む
//   4. 1画面1問で解く。残り時間は常時表示。0になったら自動で提出される
//   5. 提出すると採点し、その場で正解と解説が出る
//
// CBTに寄せた点
//   ・上に「現在時刻／受験番号／氏名」と「残り時間」を常に出す
//   ・白黒反転・背景色変更・文字色変更・表示倍率（100〜200%）が使える
//   ・その設定は操作説明画面で変えても、そのまま問題画面に引き継がれる
//   ・選択肢は ア・イ・ウ・エ
//   ・「後で見直す」に印を付けられ、解答一覧から飛べる
//   ・受験中はサイト上部のメニューを隠す
//
// 問題は暗号化された状態で置いてあるので、パスワードを聞くまで誰も読めない。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decryptQuestions, makeupPassword, normalizePassword } from "./lib/exam-crypto";
import {
  DEFAULT_EXAM_VIEW,
  choiceLabel,
  formatClock,
  formatElapsed,
  pointsOf,
  gradeExam,
  loadExamView,
  loadProgress,
  saveExamView,
  saveProgress,
  serveForStudent,
  toOriginalChoice,
  toScreenChoice,
  type ExamProgress,
  type ExamView as ExamViewSetting,
  type ServedQuestion
} from "./lib/exam-runtime";
import { gradeOf, seatOf, type ClassNo, type EncryptedBundle, type ExamResult, type ExamSet } from "./lib/exam-types";
import { lessonById } from "./lib/lessons";
import { TEACHER_SEATS, examClassOf, isDemoCode, isTeacherCode } from "./lib/roster";
import { PasswordField } from "./lib/password-field";

/** 静的書き出しのときの公開パス。GitHub Pages では /info1_ddl_public が前につく */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** ファイルに制限時間が入っていないときに使う既定値（分） */
const DEFAULT_MINUTES = 50;

/** 残り時間がこれを切ったら色を変えて知らせる（秒） */
const WARN_SECONDS = 5 * 60;

/**
 * その人が受けられる可能性のあるファイル。上から順に試し、復号できたものが今日のテストになる。
 *
 *   デモ用 … 8008 専用。20問・10分の短いセット。研修や公開授業で流れを見せるためのもの
 *   教員用 … 0001〜0005 の5名共通。1つのパスワードで、どの番号からでも開く
 *   本試験 … そのクラスのもの
 *   追試   … その生徒専用。パスワードに本人の4桁番号が混ざるので、他人の端末では開かない
 */
const EXAM_CLASS_FILES = [1, 2, 3, 4, 5, 6, 7];

const candidateFiles = (classNo: ClassNo, studentCode: string) => [
  // デモ用の番号は、まず「デモ用の短いセット（20問・10分）」を探す
  ...(isDemoCode(studentCode) ? [{ file: "digital-demo", makeup: false }] : []),
  ...(isTeacherCode(studentCode) ? [{ file: "digital-teacher", makeup: false }] : []),
  // 自分の組の本試験を先に試し、そのあと他の組のファイルも試す。
  // （2・3年次は組の番号が問題ファイルの組と一致しないことがあるため。
  //   復号できるのは正しいパスワードのファイルだけなので、順に試しても安全）
  { file: `digital-c${classNo}-main`, makeup: false },
  ...EXAM_CLASS_FILES.filter((n) => n !== classNo).map((n) => ({
    file: `digital-c${n}-main`,
    makeup: false
  })),
  { file: `digital-makeup-${studentCode}`, makeup: true }
];

type Phase = "password" | "guide" | "ready" | "running" | "list" | "done";

/* ============================================================
 * 画面上部のツールバー（白黒反転・背景色・文字色・表示倍率）
 * ========================================================== */

/** 色を選ぶときの見本。生徒が迷わないよう、読める組合せだけを並べてある */
const BG_SWATCHES = ["#ffffff", "#fdf6e3", "#eaf3ff", "#eafaf0", "#2b2b2b", "#000000"];
const INK_SWATCHES = ["#16202e", "#000000", "#0b3d91", "#1f5c2e", "#ffffff", "#ffe680"];

function ViewTools({
  view,
  onChange,
  onReset
}: {
  view: ExamViewSetting;
  onChange: (next: ExamViewSetting) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState<"bg" | "ink" | null>(null);
  const swatches = open === "bg" ? BG_SWATCHES : INK_SWATCHES;

  return (
    <div className="cbt-tools">
      <button
        type="button"
        className="cbt-tool"
        onClick={() => onChange({ ...view, bg: view.ink, ink: view.bg })}
        title="背景色と文字色を入れかえます"
      >
        白黒反転
      </button>
      <button
        type="button"
        className={`cbt-tool ${open === "bg" ? "on" : ""}`}
        aria-expanded={open === "bg"}
        onClick={() => setOpen(open === "bg" ? null : "bg")}
      >
        背景色変更
      </button>
      <button
        type="button"
        className={`cbt-tool ${open === "ink" ? "on" : ""}`}
        aria-expanded={open === "ink"}
        onClick={() => setOpen(open === "ink" ? null : "ink")}
      >
        文字色変更
      </button>
      <label className="cbt-zoom">
        表示倍率:
        <select
          value={view.zoom}
          onChange={(e) => onChange({ ...view, zoom: Number(e.target.value) })}
          aria-label="表示倍率"
        >
          {[100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200].map((z) => (
            <option key={z} value={z}>
              {z}%
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="cbt-tool" onClick={onReset} title="色と倍率をもとに戻します">
        もとに戻す
      </button>

      {open && (
        <div className="cbt-picker" role="group" aria-label={open === "bg" ? "背景色を選ぶ" : "文字色を選ぶ"}>
          <span className="cbt-picker-title">{open === "bg" ? "背景色" : "文字色"}</span>
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              className={`cbt-swatch ${(open === "bg" ? view.bg : view.ink) === c ? "on" : ""}`}
              style={{ background: c }}
              aria-label={c}
              onClick={() => onChange(open === "bg" ? { ...view, bg: c } : { ...view, ink: c })}
            />
          ))}
          <label className="cbt-free">
            自由に選ぶ
            <input
              type="color"
              value={open === "bg" ? view.bg : view.ink}
              onChange={(e) =>
                onChange(open === "bg" ? { ...view, bg: e.target.value } : { ...view, ink: e.target.value })
              }
            />
          </label>
          <button type="button" className="cbt-tool" onClick={() => setOpen(null)}>
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * 操作説明（4ページ）
 * ========================================================== */

const GUIDE_PAGES: { title: string; body: React.ReactNode }[] = [
  {
    title: "この画面について（その1）",
    body: (
      <>
        <p>
          この画面は、ITパスポート試験のCBT（コンピュータで受ける試験）と同じ作りにしてあります。本番の練習にもなります。
        </p>
        <ol className="cbt-guide-list">
          <li>
            <b>画面のいちばん上</b>に、現在時刻・受験番号・あなたの組と出席番号が出ています。
          </li>
          <li>
            その右に<b>残り時間</b>が出ます。0になると自動で試験が終わり、そこまでの解答で採点されます。
          </li>
          <li>
            残り時間が<b>5分</b>を切ると、色が変わって知らせます。
          </li>
        </ol>
        <p className="cbt-note">
          解答は、選んだそばから自動で保存されます。まちがってページを閉じても、同じ4桁番号で開けば続きから再開できます（残り時間も続きます）。
        </p>
      </>
    )
  },
  {
    title: "見えづらいときは（その2）",
    body: (
      <>
        <p>上のボタンで、画面の見え方を変えられます。ここで変えた設定は、そのまま問題の画面にも引き継がれます。</p>
        <ol className="cbt-guide-list">
          <li>
            <b>「白黒反転」</b>ボタンで、背景色と文字色を入れかえます。
          </li>
          <li>
            <b>「背景色変更」</b>ボタンで、背景を好きな色にできます。
          </li>
          <li>
            <b>「文字色変更」</b>ボタンで、文字を好きな色にできます。
          </li>
          <li>
            <b>「表示倍率」</b>で、100〜200%まで10%きざみで大きくできます。
          </li>
        </ol>
        <p className="cbt-note">
          <b>いま、この画面で試してみてください。</b>
          読みやすい組合せが見つかったら、そのまま試験に進んで構いません。もとに戻したいときは「もとに戻す」を押します。
        </p>
      </>
    )
  },
  {
    title: "問題の解き方（その3）",
    body: (
      <>
        <p>
          1画面に1問ずつ出ます。<b>知識・技能の問題は1点、思考・判断・表現の問題は2点</b>です。何点の問題かは、
          問題番号の右に出ています。
        </p>
        <ol className="cbt-guide-list">
          <li>
            <b>ア・イ・ウ・エ</b>の4つから1つを選びます。押すと選ばれた印が付きます。
          </li>
          <li>
            選び直したいときは、別の記号を押すだけです。<b>提出するまで何度でも変えられます。</b>
          </li>
          <li>
            <b>「次の問題へ」「前の問題へ」</b>で移動します。
          </li>
          <li>
            迷った問題は<b>「後で見直す」</b>に印を付けておくと、あとで一覧から探せます。
          </li>
        </ol>
        <p className="cbt-note">出題の順番と選択肢の並びは、一人ひとり違います。となりの画面を見ても意味がありません。</p>
      </>
    )
  },
  {
    title: "見直しと提出（その4）",
    body: (
      <>
        <p>画面の下に、解答の状況と提出のボタンがあります。</p>
        <ol className="cbt-guide-list">
          <li>
            <b>「解答一覧へ」</b>ボタンで、100問ぶんの番号が並んだ一覧に移ります。
          </li>
          <li>
            一覧では<b>解答済み・未解答・見直しの印</b>が色で分かります。番号を押すとその問題へ飛べます。
          </li>
          <li>
            <b>「解答を提出する」</b>を押すと確認が出ます。<b>提出すると、もう答えは変えられません。</b>
          </li>
          <li>提出すると、その場で点数・正解・解説が出ます。単元別・観点別の内訳も出ます。</li>
        </ol>
        <p className="cbt-note">
          時間切れになった場合も、そこまでの解答で自動的に採点されます。未解答は0点です。分からなくても、必ずどれかを選んでおきましょう。
        </p>
      </>
    )
  }
];

/* ============================================================
 * 本体
 * ========================================================== */

export function ExamView({
  studentCode,
  onResult
}: {
  studentCode: string;
  /** 採点が終わったら、成績ページとJSON出力に渡す */
  onResult: (result: ExamResult) => void;
}) {
  // 教員用の番号は、教員用セットが無ければ1組の問題を開く
  const classNo = examClassOf(studentCode) as ClassNo | null;
  const [phase, setPhase] = useState<Phase>("password");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [set, setSet] = useState<ExamSet | null>(null);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [served, setServed] = useState<ServedQuestion[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [flagged, setFlagged] = useState<boolean[]>([]);
  const [startedAt, setStartedAt] = useState("");
  const [deadline, setDeadline] = useState<string>("");
  const [result, setResult] = useState<ExamResult | null>(null);
  const [index, setIndex] = useState(0);
  const [guidePage, setGuidePage] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "wrong">("wrong");
  const [view, setView] = useState<ExamViewSetting>(DEFAULT_EXAM_VIEW);
  const [now, setNow] = useState<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  /* ---------- 時計。1秒ごとに動かす ---------- */

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  /* ---------- 受験中は、サイト上部のメニューを隠す ---------- */
  //   本番のCBTと同じく、試験が始まったら他の画面へ行けないようにする。
  //   （閉じてしまっても、同じ番号で開けば残り時間ごと続きから再開できる）
  useEffect(() => {
    const locked = phase === "running" || phase === "list";
    document.body.classList.toggle("exam-locked", locked);
    return () => document.body.classList.remove("exam-locked");
  }, [phase]);

  /* ---------- 見え方の設定は、この端末に覚えておく ---------- */

  useEffect(() => {
    setView(loadExamView());
  }, []);

  const changeView = (next: ExamViewSetting) => {
    setView(next);
    saveExamView(next);
  };

  /* ---------- パスワードを入れて、今日のテストを開く ---------- */

  const openExam = async () => {
    if (!classNo) {
      setError("4桁番号からクラスが読み取れません。番号を確認してください。");
      return;
    }
    const pw = normalizePassword(password);
    if (!pw) {
      setError("パスワードを入力してください。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const candidate of candidateFiles(classNo, studentCode)) {
        let bundle: EncryptedBundle;
        try {
          const res = await fetch(`${basePath}/exams/${candidate.file}.json`, { cache: "no-store" });
          if (!res.ok) continue;
          bundle = (await res.json()) as EncryptedBundle;
        } catch {
          continue;
        }
        // 追試は「基本パスワード＋その生徒の4桁番号」でしか開かない
        const tryWith = candidate.makeup ? makeupPassword(pw, studentCode) : pw;
        const questions = await decryptQuestions(bundle, tryWith);
        if (!questions) continue;

        const opened: ExamSet = {
          setId: bundle.setId,
          area: bundle.area,
          classNo: bundle.classNo,
          kind: bundle.kind,
          questions
        };
        const limit = bundle.minutes && bundle.minutes > 0 ? bundle.minutes : DEFAULT_MINUTES;
        // デモ用の番号は、前回の続きを読まない（いつも最初から）
        const saved = ephemeral ? null : loadProgress(studentCode, opened.setId);
        setSet(opened);
        setMinutes(limit);
        setServed(serveForStudent(opened, studentCode));
        setPicked(saved?.picked ?? new Array(questions.length).fill(-1));
        setFlagged(saved?.flagged ?? new Array(questions.length).fill(false));
        setStartedAt(saved?.startedAt ?? new Date().toISOString());
        setDeadline(saved?.deadline ?? "");
        setIndex(0);
        setGuidePage(0);
        setTimeUp(false);
        if (saved?.result) {
          setResult(saved.result);
          setPhase("done");
        } else {
          // 途中の人はそのまま試験へ。はじめての人は操作説明から
          setPhase(saved?.deadline ? "ready" : "guide");
        }
        setBusy(false);
        return;
      }
      setError("このパスワードでは開けませんでした。先生が言った文字を、もう一度確かめてください。");
    } catch {
      setError("テストの読み込みに失敗しました。通信の状態を確かめて、もう一度試してください。");
    }
    setBusy(false);
  };

  /* ---------- 途中保存 ---------- */

  /** デモ用の番号は、この端末に何も書き残さない */
  const ephemeral = isDemoCode(studentCode);

  const persist = useCallback(
    (next: number[], marks: boolean[], due: string, finished?: ExamResult) => {
      if (!set || ephemeral) return;
      const progress: ExamProgress = {
        setId: set.setId,
        studentCode,
        picked: next,
        flagged: marks,
        startedAt,
        ...(due ? { deadline: due } : {}),
        ...(finished ? { result: finished } : {})
      };
      saveProgress(progress);
    },
    [set, studentCode, startedAt, ephemeral]
  );

  const choose = (item: ServedQuestion, screenIndex: number) => {
    if (phase !== "running") return;
    setPicked((prev) => {
      const next = [...prev];
      next[item.originalIndex] = toOriginalChoice(item, screenIndex);
      persist(next, flagged, deadline);
      return next;
    });
  };

  const toggleFlag = (item: ServedQuestion) => {
    setFlagged((prev) => {
      const next = [...prev];
      next[item.originalIndex] = !next[item.originalIndex];
      persist(picked, next, deadline);
      return next;
    });
  };

  const answered = picked.filter((p) => p >= 0).length;
  const total = served.length;
  /** 満点＝全問の配点の合計 */
  const maxPoints = useMemo(() => served.reduce((sum, item) => sum + pointsOf(item.question), 0), [served]);
  const current = served[index];
  const flagCount = flagged.filter(Boolean).length;

  /* ---------- 残り時間 ---------- */

  const remaining = useMemo(() => {
    if (!deadline || now === null) return null;
    return Math.max(0, Math.round((new Date(deadline).getTime() - now) / 1000));
  }, [deadline, now]);

  /* ---------- 提出 ---------- */

  // 時間切れのときも最新の解答で採点できるように、参照で持っておく
  const liveRef = useRef({ set, picked, flagged, startedAt, deadline });
  liveRef.current = { set, picked, flagged, startedAt, deadline };

  const finish = useCallback(
    (byTimeUp: boolean) => {
      const live = liveRef.current;
      if (!live.set) return;
      const finished = gradeExam(live.set, live.picked, live.startedAt, new Date().toISOString());
      setResult(finished);
      persist(live.picked, live.flagged, live.deadline, finished);
      onResult(finished);
      setTimeUp(byTimeUp);
      setPhase("done");
      setConfirmSubmit(false);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [persist, onResult]
  );

  // 0分0秒になったら自動で終了する
  useEffect(() => {
    if ((phase === "running" || phase === "list") && remaining === 0) finish(true);
  }, [phase, remaining, finish]);

  /* ---------- 移動 ---------- */

  const goTo = (next: number) => {
    setIndex(Math.max(0, Math.min(total - 1, next)));
    setPhase("running");
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startExam = () => {
    // まだ始めていなければ、ここで終了時刻を決める
    const due = deadline || new Date(Date.now() + minutes * 60 * 1000).toISOString();
    setDeadline(due);
    persist(picked, flagged, due);
    setPhase("running");
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** 別のテストを受けるために、パスワード画面へ戻る（提出済みの結果は保存されたまま） */
  const openAnother = () => {
    setSet(null);
    setServed([]);
    setPicked([]);
    setFlagged([]);
    setResult(null);
    setStartedAt("");
    setDeadline("");
    setPassword("");
    setError("");
    setIndex(0);
    setGuidePage(0);
    setTimeUp(false);
    setConfirmSubmit(false);
    setReviewFilter("wrong");
    setPhase("password");
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 提出済みの結果は、開き直したときも成績ページへ渡す
  useEffect(() => {
    if (phase === "done" && result) onResult(result);
    // result が変わったときだけでよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  /* ---------- 画面 ---------- */

  if (!classNo) {
    return (
      <section className="workspace">
        <h1>デジタル分野テスト</h1>
        <div className="notice">
          4桁番号からクラスが読み取れません。番号は「学年1けた＋組1けた＋出席番号2けた」の形で入力してください（例:
          3年8組18番なら 3818）。
        </div>
      </section>
    );
  }

  const teacherSeat = TEACHER_SEATS.indexOf(studentCode);
  const who =
    isDemoCode(studentCode)
      ? "デモ・動作確認用"
      : teacherSeat >= 0
        ? `教員用 ${teacherSeat + 1}`
        : isTeacherCode(studentCode)
          ? "試し用の番号"
          : `${gradeOf(studentCode)}年${classNo}組${seatOf(studentCode)}番`;

  const screenName =
    phase === "password"
      ? "受験開始画面"
      : phase === "guide"
        ? "操作説明"
        : phase === "ready"
          ? "試験開始画面"
          : phase === "list"
            ? "解答一覧"
            : phase === "done"
              ? "試験結果"
              : "問題表示・解答";

  const cbtStyle = {
    ["--cbt-bg" as string]: view.bg,
    ["--cbt-ink" as string]: view.ink
  } as React.CSSProperties;

  const bodyStyle = { zoom: view.zoom / 100 } as React.CSSProperties;

  return (
    <section className="workspace exam-view" ref={topRef}>
      <div className="cbt" style={cbtStyle}>
        {/* --- ① タイトルと受験者情報 --- */}
        <h1 className="cbt-titlebar">
          情報Ⅰ デジタル分野テスト <span>{screenName}</span>
        </h1>

        <div className="cbt-head">
          <div className="cbt-brand">
            <b>情報Ⅰ</b>
            <span>分野別テスト</span>
          </div>
          <dl className="cbt-id">
            <div>
              <dt>現在時刻</dt>
              <dd>{now === null ? "--:--:--" : new Date(now).toLocaleTimeString("ja-JP", { hour12: false })}</dd>
            </div>
            <div>
              <dt>受験番号</dt>
              <dd>{studentCode}</dd>
            </div>
            <div>
              <dt>氏名</dt>
              <dd>{who}</dd>
            </div>
          </dl>
          {(phase === "running" || phase === "list") && remaining !== null && (
            <div className={`cbt-timer ${remaining <= WARN_SECONDS ? "warn" : ""}`} role="timer" aria-label="残り時間">
              <span>残り時間</span>
              <strong>{formatClock(remaining)}</strong>
            </div>
          )}
        </div>

        {/* --- ツールバー。操作説明でも試験中でも使える --- */}
        {phase !== "password" && (
          <ViewTools view={view} onChange={changeView} onReset={() => changeView(DEFAULT_EXAM_VIEW)} />
        )}

        {/* --- ② 本体 --- */}
        <div className="cbt-body" style={bodyStyle}>
          {/* ===== パスワード ===== */}
          {phase === "password" && (
            <div className="cbt-gate">
              <h2>受験開始</h2>
              <p>先生の合図があるまで、テストは開きません。合図があったら、先生が言うパスワードを入れてください。</p>
              <PasswordField
                label="テストのパスワード"
                hint="大文字・小文字・記号もそのとおりに"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setError("");
                }}
                onEnter={openExam}
                placeholder="先生が板書または口頭で伝えます"
                autoFocus
                note="打った文字は ● で伏せています。となりの席から見えません。確かめたいときは「表示」を押してください。"
              />
              <div className="cbt-foot">
                <span />
                <button className="cbt-go" onClick={openExam} disabled={busy}>
                  {busy ? "確認しています…" : "操作説明へ >"}
                </button>
              </div>
              {error && <div className="verdict ng">{error}</div>}
              <p className="cbt-note">
                追試の人は、先生から渡された追試用のパスワードを入れてください。自分の4桁番号でしか開きません。
              </p>
            </div>
          )}

          {/* ===== 操作説明 ===== */}
          {phase === "guide" && (
            <div className="cbt-guide">
              <div className="cbt-guide-head">
                <h2>{GUIDE_PAGES[guidePage].title}</h2>
                <span className="cbt-guide-page">
                  {guidePage + 1}/{GUIDE_PAGES.length}ページ
                </span>
              </div>
              <div className="cbt-guide-body">{GUIDE_PAGES[guidePage].body}</div>
            </div>
          )}

          {/* ===== 試験開始画面 ===== */}
          {phase === "ready" && set && (
            <div className="cbt-gate">
              <h2>試験開始</h2>
              <dl className="cbt-summary">
                <div>
                  <dt>分野</dt>
                  <dd>
                    {set.area}分野（{set.kind}）
                  </dd>
                </div>
                <div>
                  <dt>問題数</dt>
                  <dd>
                    {total}問・{maxPoints}点満点
                  </dd>
                </div>
                <div>
                  <dt>配点</dt>
                  <dd>知識1点・思考2点</dd>
                </div>
                <div>
                  <dt>制限時間</dt>
                  <dd>{minutes}分</dd>
                </div>
                <div>
                  <dt>解答済み</dt>
                  <dd>
                    {answered} / {total}問
                  </dd>
                </div>
              </dl>
              {deadline && remaining !== null && (
                <div className="verdict ok">
                  前回の続きがあります。残り時間は <b>{formatClock(remaining)}</b> です。
                </div>
              )}
              <p className="cbt-note">
                <b>「試験開始」を押すと、その時点から時間が動き始めます。</b>先生の合図を待ってから押してください。
              </p>
              <div className="cbt-foot">
                <button className="cbt-nav" onClick={() => setPhase("guide")}>
                  {"<< 操作説明へもどる"}
                </button>
                <button className="cbt-go" onClick={startExam}>
                  {deadline ? "続きから受験する" : "試験開始"}
                </button>
              </div>
            </div>
          )}

          {/* ===== 問題表示・解答（1画面1問） ===== */}
          {phase === "running" && set && current && (
            <div className="cbt-q">
              <div className="cbt-qhead">
                <span className="cbt-qno">問 {index + 1}</span>
                <span className="cbt-qfield">
                  {lessonById(current.question.lessonId)?.title ?? current.question.lessonId}
                </span>
                <span className={`level level-${current.question.level}`}>{current.question.level}</span>
                <span className="cbt-points">{pointsOf(current.question)}点</span>
                <label className={`cbt-flag ${flagged[current.originalIndex] ? "on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={!!flagged[current.originalIndex]}
                    onChange={() => toggleFlag(current)}
                  />
                  後で見直す
                </label>
              </div>

              <p className="cbt-qtext">{current.question.q}</p>

              <div className="cbt-choices" role="radiogroup" aria-label={`問${index + 1}の選択肢`}>
                {current.choices.map((choice, ci) => {
                  const on = toScreenChoice(current, picked[current.originalIndex]) === ci;
                  return (
                    <button
                      key={choice}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`cbt-choice ${on ? "on" : ""}`}
                      onClick={() => choose(current, ci)}
                    >
                      <span className="cbt-mark">{choiceLabel(ci)}</span>
                      <span className="cbt-choice-text">{choice}</span>
                    </button>
                  );
                })}
              </div>

              <div className="cbt-state">
                解答済み <b>{answered}</b> / {total}問
                {flagCount > 0 && <em>・見直しの印 {flagCount}問</em>}
                {picked[current.originalIndex] < 0 && <strong className="cbt-unanswered">この問題は未解答です</strong>}
              </div>

              <div className="cbt-foot">
                <button className="cbt-nav" onClick={() => goTo(0)} disabled={index === 0}>
                  {"<< 最初の問題へ"}
                </button>
                <button className="cbt-nav" onClick={() => goTo(index - 1)} disabled={index === 0}>
                  {"< 前の問題へ"}
                </button>
                <button className="cbt-nav" onClick={() => goTo(index + 1)} disabled={index >= total - 1}>
                  {"次の問題へ >"}
                </button>
                <button className="cbt-go ghost" onClick={() => setPhase("list")}>
                  解答一覧へ
                </button>
              </div>
            </div>
          )}

          {/* ===== 解答一覧 ===== */}
          {phase === "list" && set && (
            <div className="cbt-list">
              <h2>解答一覧</h2>
              <p className="cbt-note">
                番号を押すと、その問題に移ります。<b>色の意味</b>は下のとおりです。
              </p>
              <div className="cbt-legend">
                <span className="cbt-legend-item done">解答済み</span>
                <span className="cbt-legend-item todo">未解答</span>
                <span className="cbt-legend-item mark">見直しの印</span>
              </div>

              <div className="cbt-grid">
                {served.map((item, i) => {
                  const done = picked[item.originalIndex] >= 0;
                  const mark = flagged[item.originalIndex];
                  return (
                    <button
                      key={item.question.id}
                      type="button"
                      className={`cbt-cell ${done ? "done" : "todo"} ${mark ? "mark" : ""}`}
                      onClick={() => goTo(i)}
                      title={`問${i + 1}${done ? "（解答済み）" : "（未解答）"}${mark ? "・見直しの印" : ""}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <dl className="cbt-summary">
                <div>
                  <dt>解答済み</dt>
                  <dd>
                    {answered} / {total}問
                  </dd>
                </div>
                <div>
                  <dt>未解答</dt>
                  <dd>{total - answered}問</dd>
                </div>
                <div>
                  <dt>見直しの印</dt>
                  <dd>{flagCount}問</dd>
                </div>
              </dl>

              {confirmSubmit ? (
                <div className="cbt-confirm">
                  <p>
                    <b>提出すると、もう答えを変えられません。</b>
                    {answered < total
                      ? `まだ ${total - answered}問 が未解答です。未解答は0点になります。`
                      : "すべて解答できています。"}
                  </p>
                  <div className="cbt-foot">
                    <button className="cbt-nav" onClick={() => setConfirmSubmit(false)}>
                      まだ見直す
                    </button>
                    <button className="cbt-go danger" onClick={() => finish(false)}>
                      提出して採点する
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cbt-foot">
                  <button className="cbt-nav" onClick={() => setPhase("running")}>
                    {"< 問題にもどる"}
                  </button>
                  <button className="cbt-go danger" onClick={() => setConfirmSubmit(true)}>
                    解答を提出する（{answered}/{total}問）
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===== 結果 ===== */}
          {phase === "done" && set && result && (
            <div className="cbt-result">
              {timeUp && (
                <div className="verdict ng">時間になりました。そこまでの解答で採点しています。未解答は0点です。</div>
              )}
              <div className="exam-score">
                <div className="exam-score-main">
                  <span>
                    {result.area}分野・{result.kind}
                  </span>
                  <strong>{result.score}</strong>
                  <em>
                    / {result.max}点（正解 {result.correctCount ?? 0}/{result.questionCount ?? result.max}問）
                  </em>
                </div>
                <dl className="area-detail">
                  <div>
                    <dt>得点率</dt>
                    <dd>{Math.round((result.score / result.max) * 100)}%</dd>
                  </div>
                  <div>
                    <dt>かかった時間</dt>
                    <dd>{formatElapsed(result.elapsedSeconds)}</dd>
                  </div>
                  {result.byViewpoint.map((row) => (
                    <div key={row.key}>
                      <dt>{row.label}</dt>
                      <dd>
                        {row.points ?? row.correct}/{row.maxPoints ?? row.total}点（{row.rate}%）
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="exam-score-actions">
                  <button type="button" className="ghost" onClick={openAnother}>
                    もう一度パスワード画面へ戻る
                  </button>
                  <span className="muted small">
                    この結果は保存済みです。別のテスト（追試など）のパスワードを入れると、そのテストが開きます。
                  </span>
                </div>
              </div>

              <div className="dash-panel">
                <h3>難易度別</h3>
                <div className="level-bars">
                  {result.byLevel.map((row) => (
                    <div className="level-row" key={row.key}>
                      <span className={`level level-${row.key}`}>{row.label}</span>
                      <div className="bar-track">
                        <i style={{ width: `${row.rate}%` }} />
                      </div>
                      <b>{row.rate}%</b>
                      <em>
                        {row.correct}/{row.total}問
                      </em>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dash-panel">
                <h3>単元別の正答</h3>
                <p className="muted small">正答率の低い単元から並べています。ここが立て直しの出発点です。</p>
                <div className="level-bars">
                  {[...result.byLesson]
                    .sort((a, b) => a.rate - b.rate)
                    .map((row) => (
                      <div className="level-row" key={row.key}>
                        <span className="lesson-name">{row.label}</span>
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
                    ))}
                </div>
              </div>

              <div className="dash-panel">
                <div className="dash-head">
                  <h3>解答と解説</h3>
                  <div className="tabs" role="tablist">
                    <button
                      role="tab"
                      aria-selected={reviewFilter === "wrong"}
                      className={reviewFilter === "wrong" ? "active" : ""}
                      onClick={() => setReviewFilter("wrong")}
                    >
                      間違えた問題だけ（{(result.questionCount ?? result.max) - (result.correctCount ?? result.score)}問）
                    </button>
                    <button
                      role="tab"
                      aria-selected={reviewFilter === "all"}
                      className={reviewFilter === "all" ? "active" : ""}
                      onClick={() => setReviewFilter("all")}
                    >
                      全{result.questionCount ?? result.max}問
                    </button>
                  </div>
                </div>
                {served
                  .map((item, position) => ({ item, position }))
                  .filter(({ item }) => reviewFilter === "all" || !result.answers[item.originalIndex].correct)
                  .map(({ item, position }) => {
                    const ans = result.answers[item.originalIndex];
                    const myScreen = toScreenChoice(item, ans.picked);
                    const correctScreen = toScreenChoice(item, item.question.answer);
                    return (
                      <article className={`question exam-review ${ans.correct ? "ok" : "ng"}`} key={item.question.id}>
                        <h3>
                          <span className="exam-no">{position + 1}</span>
                          <span className={`level level-${item.question.level}`}>{item.question.level}</span>
                          <span className={`result-tag ${ans.correct ? "first" : "miss"}`}>
                            {ans.correct
                              ? `正解（${pointsOf(item.question)}点）`
                              : ans.picked < 0
                                ? "未解答（0点）"
                                : "不正解（0点）"}
                          </span>
                          {item.question.q}
                        </h3>
                        {item.question.source && <p className="source">出典: {item.question.source}</p>}
                        <div className="choices">
                          {item.choices.map((choice, ci) => (
                            <button
                              key={choice}
                              disabled
                              className={[
                                ci === correctScreen ? "correct" : "",
                                ci === myScreen && ci !== correctScreen ? "wrong" : ""
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {choiceLabel(ci)}. {choice}
                              {ci === myScreen && <em className="pick-tag">あなたの答え</em>}
                            </button>
                          ))}
                        </div>
                        <div className="feedback">{item.question.explanation}</div>
                      </article>
                    );
                  })}
              </div>

              <div className="notice">この結果は成績ページに記録され、JSONにも出力されます。画面を閉じても残ります。</div>
            </div>
          )}
        </div>

        {/* --- 操作説明のときだけ、画面のいちばん下に本番と同じボタン列を出す --- */}
        {phase === "guide" && (
          <div className="cbt-foot cbt-foot-fixed">
            <button className="cbt-nav" onClick={() => setGuidePage(0)} disabled={guidePage === 0}>
              {"<< 操作説明の最初へ"}
            </button>
            <button
              className="cbt-nav"
              onClick={() => setGuidePage((p) => Math.max(0, p - 1))}
              disabled={guidePage === 0}
            >
              {"< 前へ"}
            </button>
            <button
              className="cbt-nav"
              onClick={() => setGuidePage((p) => Math.min(GUIDE_PAGES.length - 1, p + 1))}
              disabled={guidePage >= GUIDE_PAGES.length - 1}
            >
              {"次へ >"}
            </button>
            <button className="cbt-go" onClick={() => setPhase("ready")}>
              試験開始画面へ
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
