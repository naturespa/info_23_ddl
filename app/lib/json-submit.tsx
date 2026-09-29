"use client";

import { useEffect, useRef, useState } from "react";
import type { StudentRecord } from "./types";

const SERVER_KEY = "joho-ddl-json-server";

export function JsonSubmit({ studentCode, buildRecord }: { studentCode: string; buildRecord: () => StudentRecord }) {
  const [server, setServer] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const sending = useRef(false);
  useEffect(() => {
    try { setServer(localStorage.getItem(SERVER_KEY) ?? ""); } catch { /* 保存できなくても送信は可能 */ }
  }, []);

  async function send() {
    if (sending.current || !/^\d{4}$/.test(studentCode)) return;
    let endpoint: URL;
    try {
      endpoint = new URL(server.trim());
      if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !["", "/", "/api/submissions"].includes(endpoint.pathname)) throw new Error();
      endpoint.pathname = "/api/submissions";
    } catch {
      setStatus("送信先は http://192.168.1.50:3002 のように入力してください。URLにパス・認証情報・検索文字列は指定できません（/api/submissions は使用できます）。");
      return;
    }
    if (!window.confirm(`受験番号 ${studentCode} の学習記録・得点・記述内容を ${endpoint.origin} に送信します。先生から指定された送信先で間違いありませんか？`)) return;
    sending.current = true;
    setBusy(true);
    setStatus("送信中です…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const record = { ...buildRecord(), exportedAt: new Date().toISOString() };
      const response = await fetch(endpoint.href, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record), signal: controller.signal, credentials: "omit", redirect: "error"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`サーバーが保存を受け付けませんでした（HTTP ${response.status}）。`);
      if (result?.ok !== true || result?.studentCode !== studentCode || typeof result?.receiptId !== "string") throw new Error("サーバーから保存完了の応答を確認できませんでした。");
      try { localStorage.setItem(SERVER_KEY, endpoint.origin); } catch { /* URLの記憶は任意 */ }
      setStatus(`受験番号 ${studentCode} のJSONを ${endpoint.origin} に保存しました。受付番号: ${result.receiptId}`);
    } catch (error) {
      const detail = error instanceof Error && error.name !== "TypeError" && error.name !== "AbortError" ? error.message : "接続できないか、応答が時間内に届きませんでした。";
      setStatus(`${detail} 保存完了は確認できていません。送信先・サーバー起動・ネットワークの許可を確認してください。応答だけ届かなかった可能性もあるため、再送前に先生へ確認してください。「JSONを保存」で手元に残すこともできます。`);
    } finally {
      window.clearTimeout(timeout);
      sending.current = false;
      setBusy(false);
    }
  }

  return <div className="json-submit">
    <h3>JSON送信</h3>
    <p>先生が指定したサーバーへ、JSON保存と同じ学習記録・得点・記述内容を送信します。</p>
    <label htmlFor="json-server">送信先サーバー</label>
    <div className="actions">
      <input id="json-server" type="url" autoComplete="off" spellCheck={false} placeholder="http://192.168.1.50:3002" value={server} disabled={busy} onChange={(e) => { setServer(e.target.value); setStatus(""); }} />
      <button className="primary" disabled={busy || !/^\d{4}$/.test(studentCode) || !server.trim()} onClick={send}>{busy ? "送信中…" : "JSON送信"}</button>
    </div>
    <p className="muted">送信先には http:// または https:// から入力します。送信に成功すると、この端末に送信先を記憶します。</p>
    <p role="status" aria-live="polite">{status}</p>
  </div>;
}
