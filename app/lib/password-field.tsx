"use client";

// パスワードを打つ欄。
//
// なぜ専用の部品にするか
//   ・打った文字はその場で ● に伏せる（となりの席から見えないように）
//   ・でも打ち間違いは自分で確かめたいので、「表示」ボタンで一時的に見せる
//   ・分野別テストの画面でも、教員用ログインでも、同じ見た目・同じ操作にする
//
// 伏せているあいだはブラウザの入力補助（辞書変換・自動入力）が働かないよう、
// 半角英数の直接入力になるようにしてある。

import { useId, useState } from "react";

export function PasswordField({
  label,
  hint,
  value,
  onChange,
  onEnter,
  placeholder,
  autoFocus,
  note
}: {
  /** 欄の名前（「テストのパスワード」など） */
  label: string;
  /** 名前の右に小さく出す補足 */
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  /** Enterキーで進むときの動き */
  onEnter?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** 欄の下に出す一言 */
  note?: string;
}) {
  const [shown, setShown] = useState(false);
  const id = useId();

  return (
    <div className="pw-field">
      <label className="pw-label" htmlFor={id}>
        {label}
        {hint && <i className="pw-hint">{hint}</i>}
      </label>
      <div className="pw-row">
        <input
          id={id}
          className="pw-input"
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) onEnter();
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          autoFocus={autoFocus}
        />
        <button
          type="button"
          className="pw-eye"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          title={shown ? "パスワードを隠します" : "打った文字を確かめられます"}
        >
          {shown ? "隠す" : "表示"}
        </button>
      </div>
      <p className="pw-note" aria-live="polite">
        {shown ? "いまパスワードが見えています。確かめたら「隠す」を押してください。" : (note ?? "打った文字は ● で伏せています。確かめたいときは「表示」を押してください。")}
      </p>
    </div>
  );
}
