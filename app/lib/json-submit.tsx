"use client";

import { useEffect, useRef, useState } from "react";
import type { StudentRecord } from "./types";

const SERVER_KEY = "joho-ddl-json-server";
const SERVER_PORT = 3002;
const validIPv4 = (value: string) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) &&
  value.split(".").every((part) => Number(part) <= 255);

export function JsonSubmit({ studentCode, buildRecord }: { studentCode: string; buildRecord: () => StudentRecord }) {
  const [serverIp, setServerIp] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const sending = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SERVER_KEY) ?? "";
      // 旧版で保存した http://IP:3002 からもIPだけ引き継ぐ。
      const previous = /^http:\/\/((?:\d{1,3}\.){3}\d{1,3}):3002\/?$/.exec(saved);
      setServerIp(previous ? previous[1] : saved);
    } catch { /* 保存できなくても送信は可能 */ }
  }, []);

  async function send() {
    if (sending.current || !/^\d{4}$/.test(studentCode)) return;
    const ip = serverIp.trim();
    if (!validIPv4(ip)) {
      setStatus("先生から指定された学校サーバーのIPv4アドレスだけを入力してください（例：192.168.1.50）。");
      return;
    }
    const endpoint = `http://${ip}:${SERVER_PORT}/api/submissions`;
    const serverAddress = `http://${ip}:${SERVER_PORT}`;
    if (!window.confirm(`受験番号 ${studentCode} の学習記録・得点・記述内容を学校サーバー（${ip}）に送信します。先生から指定されたIPアドレスで間違いありませんか？`)) return;
    sending.current = true;
    setBusy(true);
    setStatus("送信中です…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const record = { ...buildRecord(), exportedAt: new Date().toISOString() };
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record), signal: controller.signal, credentials: "omit", redirect: "error"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`サーバーが保存を受け付けませんでした（HTTP ${response.status}）。`);
      if (result?.ok !== true || result?.studentCode !== studentCode || typeof result?.receiptId !== "string") throw new Error("サーバーから保存完了の応答を確認できませんでした。");
      try { localStorage.setItem(SERVER_KEY, ip); } catch { /* IPの記憶は任意 */ }
      setStatus(`受験番号 ${studentCode} のJSONを学校サーバー（${serverAddress}）に保存しました。受付番号: ${result.receiptId}`);
    } catch (error) {
      const detail = error instanceof Error && error.name !== "TypeError" && error.name !== "AbortError" ? error.message : "接続できないか、応答が時間内に届きませんでした。";
      setStatus(`${detail} 保存完了は確認できていません。IPアドレス・サーバー起動・ネットワークの許可を確認してください。応答だけ届かなかった可能性もあるため、再送前に先生へ確認してください。「JSONを保存」で手元に残すこともできます。`);
    } finally {
      window.clearTimeout(timeout);
      sending.current = false;
      setBusy(false);
    }
  }

  return <div className="json-submit">
    <h3>JSON送信</h3>
    <p>先生が指定したサーバーへ、JSON保存と同じ学習記録・得点・記述内容を送信します。</p>
    <label htmlFor="json-server">学校サーバーのIPアドレス（先生から指定）</label>
    <div className="actions">
      <input id="json-server" type="text" inputMode="decimal" autoComplete="off" spellCheck={false} placeholder="例：192.168.1.50" value={serverIp} disabled={busy} onChange={(e) => { setServerIp(e.target.value); setStatus(""); }} />
      <button className="primary" disabled={busy || !/^\d{4}$/.test(studentCode) || !serverIp.trim()} onClick={send}>{busy ? "送信中…" : "JSON送信"}</button>
    </div>
    <p className="muted">IPアドレスだけを入力します。http:// やポート番号は不要です。送信に成功すると、この端末にIPアドレスを記憶します。</p>
    <p role="status" aria-live="polite">{status}</p>
  </div>;
}
