"use client";

// 応用ミッションにつける、小さな表計算の練習。
//
// 生徒は「セルに式を打ちこんで、答えが出る」という経験をここでします。
// 数字を直接打ちこんでも正解にはならず、指定された関数を使ったときだけ正解になります。

import { useContext, useMemo, useState } from "react";
import { evaluateFormula, functionsUsed, type SheetData } from "./sheet";
import { HintShopContext } from "./ui";
import { sheetHintId } from "./hint-list";

export type SheetTask = {
  /** 何を求めるか */
  ask: string;
  /** これらのうち1つを式の中で使っていれば正解あつかい */
  functions: string[];
  /** 正解の値（小数のずれは許す） */
  answer: number;
  /** 答え合わせのときに出す一言 */
  note: string;
  /** 見本の式 */
  sample: string;
};

const COLUMNS = "ABCDEFGHIJKLMN";

const show = (v: number | string) => {
  if (typeof v !== "number") return v;
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 10000) / 10000);
};

export function MiniSheet({
  data,
  tasks,
  caption,
  lessonId
}: {
  data: SheetData;
  tasks: SheetTask[];
  caption?: string;
  /** 「式を見る」をGで買うために使う */
  lessonId: string;
}) {
  const shop = useContext(HintShopContext);
  const [inputs, setInputs] = useState<string[]>(() => tasks.map(() => ""));
  const [revealed, setRevealed] = useState<boolean[]>(() => tasks.map(() => false));

  /** その式をもう買っているか。売り場がないとき（テストなど）はタダで開ける */
  const bought = (i: number) => !shop || shop.bought(sheetHintId(lessonId, i));
  const short = shop ? shop.price - shop.balance : 0;

  const results = useMemo(
    () =>
      tasks.map((task, i) => {
        const raw = inputs[i].trim();
        if (!raw) return { state: "empty" as const, message: "", value: "" as number | string };
        const out = evaluateFormula(data, raw);
        if (!out.ok) return { state: "error" as const, message: out.error, value: "" as number | string };
        const used = functionsUsed(raw);
        const usedRight = task.functions.length === 0 || task.functions.some((f) => used.includes(f.toUpperCase()));
        const close = typeof out.value === "number" && Math.abs(out.value - task.answer) < 0.005;
        if (!close) return { state: "wrong" as const, message: "答えが合いません。範囲の指定を見直しましょう。", value: out.value };
        if (!usedRight)
          return {
            state: "nofunc" as const,
            message: `答えは合っていますが、${task.functions.join(" か ")} を使って求めましょう。`,
            value: out.value
          };
        return { state: "ok" as const, message: task.note, value: out.value };
      }),
    // data は定数なので依存に入れなくてよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputs, tasks]
  );

  const setAt = (i: number, value: string) =>
    setInputs((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });

  const done = results.filter((r) => r.state === "ok").length;

  return (
    <div className="mini-sheet">
      <div className="sheet-head">
        <b>表計算の練習</b>
        <span>
          {caption ?? "セルに式を打ちこむと、その場で計算されます。"}　できた {done} / {tasks.length}
        </span>
      </div>

      <div className="table-scroll">
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="corner" />
              {data.header.map((_, c) => (
                <th key={c}>{COLUMNS[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>1</th>
              {data.header.map((h, c) => (
                <td key={c} className="sheet-label">
                  {h}
                </td>
              ))}
            </tr>
            {data.rows.map((row, r) => (
              <tr key={r}>
                <th>{r + 2}</th>
                {data.header.map((_, c) => (
                  <td key={c} className={typeof row[c] === "number" ? "num" : ""}>
                    {show(row[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="sheet-tasks">
        {tasks.map((task, i) => {
          const r = results[i];
          return (
            <li key={task.ask} className={`sheet-task ${r.state}`}>
              <p className="sheet-ask">{task.ask}</p>
              <div className="sheet-input">
                <input
                  value={inputs[i]}
                  onChange={(e) => setAt(i, e.target.value)}
                  placeholder="= から書き始めます"
                  spellCheck={false}
                  autoComplete="off"
                />
                <span className="sheet-value">
                  {r.state === "empty" ? "" : r.state === "error" ? "エラー" : show(r.value)}
                </span>
                {bought(i) ? (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setRevealed((p) => p.map((v, k) => (k === i ? !v : v)))}
                  >
                    {revealed[i] ? "式を隠す" : "式を見る"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sheet-buy"
                    onClick={() => shop?.buy(sheetHintId(lessonId, i))}
                    disabled={short > 0}
                    title={short > 0 ? `あと ${short}G 足りません` : ""}
                  >
                    式を見る<b>{shop?.price}G</b>
                  </button>
                )}
              </div>
              {r.state === "error" && <p className="sheet-msg ng">{r.message}</p>}
              {r.state === "wrong" && <p className="sheet-msg ng">{r.message}</p>}
              {r.state === "nofunc" && <p className="sheet-msg warn">{r.message}</p>}
              {r.state === "ok" && <p className="sheet-msg ok">{r.message}</p>}
              {bought(i) && revealed[i] && (
                <p className="sheet-msg sample">
                  見本：<code>{task.sample}</code>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <p className="sheet-foot">
        使える関数：SUM／AVERAGE／MEDIAN／MODE.SNGL／MAX／MIN／COUNT／COUNTA／COUNTIF／STDEV.P／STDEV.S／VAR.P／VAR.S／CORREL／ROUND／ABS／SQRT。
        範囲は <code>B2:B11</code> のように書きます。実物のExcelでも、同じ式がそのまま使えます。
      </p>
    </div>
  );
}
