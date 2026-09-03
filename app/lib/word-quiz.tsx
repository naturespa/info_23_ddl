"use client";

// 重要語句テスト。各単元5語。
//
// ・意味を読んで、語句を入力する
// ・確認問題と同じ2回ルール（1回目で正解＝1点、2回目で正解＝0.5点）
// ・1回目を間違えたとき、最初の1文字は有料ヒント（単元ごとに1つ買うと5語ぶん出る）
// ・打ち方のちがい（全角半角・大小・長音・スペース）は正解あつかい
// ・1文字違いは「おしい！」と出して、×にせずもう一度打たせる

import { useContext, useMemo, useState } from "react";
import { answerShape, checkWord, firstLetter } from "./word-check";
import { wordHintId } from "./hint-list";
import { HintShopContext } from "./ui";
import { wordsOf, type WordItem } from "./words";
import type { QuestionResult } from "./types";

export type WordSubmission = {
  /** 1回目に打った文字列 */
  answers: string[];
  /** 2回目に打った文字列。1回目で正解、またはまだ挑戦していない場合は "" */
  retries: string[];
  correct: number;
  secondCorrect: number;
  /** 1回目正解＝1点、2回目正解＝0.5点 */
  score: number;
  results: QuestionResult[];
  submittedAt: string;
  retriedAt?: string;
};

const FIRST_POINT = 1;
const SECOND_POINT = 0.5;

/** 保存済みの記録を、いまの語句リストで採点し直す */
export const gradeWords = (lessonId: string, saved?: Partial<WordSubmission>): WordSubmission | null => {
  if (!saved || !Array.isArray(saved.answers)) return null;
  const items = wordsOf(lessonId);
  const answers = items.map((_, i) => saved.answers?.[i] ?? "");
  const retries = items.map((_, i) => saved.retries?.[i] ?? "");
  const results: QuestionResult[] = items.map((item, i) => {
    if (checkWord(item, answers[i]) === "correct") return "1回目で正解";
    if (!retries[i]) return "2回目待ち";
    return checkWord(item, retries[i]) === "correct" ? "2回目で正解" : "不正解";
  });
  const correct = results.filter((r) => r === "1回目で正解").length;
  const secondCorrect = results.filter((r) => r === "2回目で正解").length;
  return {
    answers,
    retries,
    results,
    correct,
    secondCorrect,
    score: correct * FIRST_POINT + secondCorrect * SECOND_POINT,
    submittedAt: saved.submittedAt ?? new Date().toISOString(),
    ...(saved.retriedAt ? { retriedAt: saved.retriedAt } : {})
  };
};

export function WordQuiz({
  lessonId,
  submission,
  draft,
  onDraft,
  onSubmit
}: {
  lessonId: string;
  submission?: WordSubmission;
  /** 送信前に打ちこんだ文字列 */
  draft: string[];
  onDraft: (next: string[]) => void;
  onSubmit: (next: WordSubmission) => void;
}) {
  const items = useMemo(() => wordsOf(lessonId), [lessonId]);
  /** 2回目に打ちこむ文字列 */
  const [retryDraft, setRetryDraft] = useState<string[]>(() => items.map(() => ""));
  const [showHelp, setShowHelp] = useState(false);
  /** 最初の1文字は有料。買っていなければ伏せる */
  const shop = useContext(HintShopContext);
  const letterId = wordHintId(lessonId);
  const letterBought = !shop || shop.bought(letterId);
  const letterShort = shop ? shop.price - shop.balance : 0;

  const waiting = submission?.results.filter((r) => r === "2回目待ち").length ?? 0;
  const filled = draft.filter((v) => v.trim()).length;

  /** いまの入力が「おしい」かどうか（送信前だけ出す） */
  const closeHints = items.map((item, i) => (submission ? "empty" : checkWord(item, draft[i] ?? "")));

  const setAt = (list: string[], i: number, v: string) => {
    const next = [...list];
    next[i] = v;
    return next;
  };

  const submit = () => {
    const results: QuestionResult[] = items.map((item, i) =>
      checkWord(item, draft[i] ?? "") === "correct" ? "1回目で正解" : "2回目待ち"
    );
    const correct = results.filter((r) => r === "1回目で正解").length;
    onSubmit({
      answers: items.map((_, i) => draft[i] ?? ""),
      retries: items.map(() => ""),
      results,
      correct,
      secondCorrect: 0,
      score: correct * FIRST_POINT,
      submittedAt: new Date().toISOString()
    });
    setRetryDraft(items.map(() => ""));
  };

  const submitRetry = () => {
    if (!submission) return;
    const retries = items.map((_, i) => (submission.results[i] === "2回目待ち" ? retryDraft[i] ?? "" : submission.retries[i]));
    const results: QuestionResult[] = items.map((item, i) => {
      if (submission.results[i] === "1回目で正解") return "1回目で正解";
      if (!retries[i].trim()) return "2回目待ち";
      return checkWord(item, retries[i]) === "correct" ? "2回目で正解" : "不正解";
    });
    const correct = results.filter((r) => r === "1回目で正解").length;
    const secondCorrect = results.filter((r) => r === "2回目で正解").length;
    onSubmit({
      ...submission,
      retries,
      results,
      correct,
      secondCorrect,
      score: correct * FIRST_POINT + secondCorrect * SECOND_POINT,
      retriedAt: new Date().toISOString()
    });
  };

  const tag = (r: QuestionResult) =>
    r === "1回目で正解" ? "first" : r === "2回目で正解" ? "second" : r === "不正解" ? "miss" : "wait";

  return (
    <section className="word-quiz">
      <div className="word-head">
        <h2>重要語句</h2>
        <span className="muted small">
          次の意味にあてはまる語句を答えなさい。全部で{items.length}語・{items.length}点。青いラベルは答えの文字の種類と文字数です。
          {submission ? `　いまの得点 ${submission.score} / ${items.length}点` : `　入力ずみ ${filled} / ${items.length}`}
        </span>
        <button type="button" className="ghost small" onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? "書き方を閉じる" : "書き方"}
        </button>
      </div>

      {showHelp && (
        <p className="word-help">
          漢字・カタカナ・英字のどれで打っても、<b>意味が同じならすべて正解</b>にしています。
          英字の大文字と小文字、全角と半角、「ー」の有無、スペースや中黒のちがいも正解です。
          たとえば「論理和回路」は <code>OR</code> でも <code>論理和</code> でも正解になります。
        </p>
      )}

      <ol className="word-list">
        {items.map((item: WordItem, i) => {
          const result = submission?.results[i];
          const awaiting = result === "2回目待ち";
          const resolved = !!submission && !awaiting;
          return (
            <li key={item.answer} className={`word-item ${result ? tag(result) : ""}`}>
              <p className="word-clue">
                <b>{i + 1}.</b> {item.clue}
                <span className="word-shape">{answerShape(item.answer)}</span>
              </p>

              {!submission && (
                <div className="word-input">
                  <input
                    value={draft[i] ?? ""}
                    onChange={(e) => onDraft(setAt(draft, i, e.target.value))}
                    placeholder="語句を入力"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {closeHints[i] === "close" && <span className="word-msg close">おしい！　もう少しです</span>}
                </div>
              )}

              {awaiting && (
                <div className="word-input">
                  <input
                    value={retryDraft[i] ?? ""}
                    onChange={(e) => setRetryDraft(setAt(retryDraft, i, e.target.value))}
                    placeholder={letterBought ? `${firstLetter(item)} …` : "もう一度入力"}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <span className="word-msg hint">
                    1回目「{submission?.answers[i] || "（空欄）"}」は不正解。
                    {letterBought ? (
                      <>
                        最初の1文字は<b>{firstLetter(item)}</b>です
                      </>
                    ) : (
                      <button
                        type="button"
                        className="word-buy"
                        disabled={letterShort > 0}
                        title={letterShort > 0 ? `あと ${letterShort}G 足りません` : ""}
                        onClick={() => shop?.buy(letterId)}
                      >
                        最初の1文字を見る<b>{shop?.price}G</b>
                      </button>
                    )}
                  </span>
                  {checkWord(item, retryDraft[i] ?? "") === "close" && (
                    <span className="word-msg close">おしい！　もう少しです</span>
                  )}
                </div>
              )}

              {resolved && (
                <div className="word-answer">
                  <span className={`result-tag ${tag(result!)}`}>
                    {result}
                    {result === "1回目で正解" ? "（1点）" : result === "2回目で正解" ? "（0.5点）" : "（0点）"}
                  </span>
                  <b>{item.answer}</b>
                  {result === "不正解" && (
                    <em>
                      あなたの答え：{submission?.answers[i] || "（空欄）"}
                      {submission?.retries[i] ? ` → ${submission.retries[i]}` : ""}
                    </em>
                  )}
                  {!!item.alt.length && <em>{item.alt.join("／")} でも正解</em>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!submission && (
        <button type="button" className="primary" onClick={submit} disabled={!filled}>
          答え合わせをする（{filled} / {items.length} 入力ずみ）
        </button>
      )}

      {waiting > 0 && (
        <div className="word-foot">
          <p className="retry-banner">
            {waiting}語が不正解でした。<b>もう1回だけ</b>打ち直せます（2回目で正解すると0.5点）。
          </p>
          <button
            type="button"
            className="primary"
            onClick={submitRetry}
            disabled={!retryDraft.some((v) => v.trim())}
          >
            2回目を答え合わせする
          </button>
        </div>
      )}

      {submission && waiting === 0 && (
        <p className="word-foot-done">
          この単元の重要語句は {submission.score} / {items.length}点です（1回目正解 {submission.correct}語、2回目正解{" "}
          {submission.secondCorrect}語）。
        </p>
      )}
    </section>
  );
}
