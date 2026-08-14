"use client";
import { useMemo, useState } from "react";

export type Recipient = { id: string; name: string; sub: string };

// 어드민 알림 발송 폼 (2026-08-13) — 대상 세그먼트(체험자|사장님) → 수신 범위(전체|직접 선택
// (검색+체크박스)) → 제목/내용/링크(내부 경로) → 확인 모달 → POST /api/admin/notify.
const TITLE_MAX = 40;
const BODY_MAX = 200;

export default function NotifyForm({ reviewers, owners }: { reviewers: Recipient[]; owners: Recipient[] }) {
  const [audience, setAudience] = useState<"reviewer" | "owner">("reviewer");
  const [scope, setScope] = useState<"all" | "pick">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sentResult, setSentResult] = useState<{ sent: number; push: number } | null>(null);

  const pool = audience === "reviewer" ? reviewers : owners;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return pool;
    return pool.filter((r) => r.name.toLowerCase().includes(needle) || r.sub.toLowerCase().includes(needle));
  }, [pool, q]);

  const targetCount = scope === "all" ? pool.length : picked.size;
  const canSend = title.trim().length > 0 && body.trim().length > 0 && targetCount > 0 && (!link || link.startsWith("/"));

  function switchAudience(a: "reviewer" | "owner") {
    setAudience(a);
    setPicked(new Set()); // 대상 전환 시 개별 선택 초기화 (역할 간 ID 혼입 방지)
    setQ("");
    setSentResult(null);
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audience,
        userIds: scope === "pick" ? [...picked] : undefined,
        title: title.trim(),
        body: body.trim(),
        link: link.trim() || undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "발송에 실패했어요");
      return;
    }
    setConfirm(false);
    setSentResult({ sent: j.sent, push: j.pushSent ?? 0 });
    setTitle("");
    setBody("");
    setLink("");
    setPicked(new Set());
  }

  const audienceLabel = audience === "reviewer" ? "체험자" : "사장님";

  return (
    <section className="px-5 mt-4">
      {sentResult !== null && (
        <div className="mb-3 rounded-md bg-successSoft px-4 py-3 text-[13px] text-ink">
          <span className="font-bold text-successStrong">✓ 발송 완료</span> — {audienceLabel} {sentResult.sent}명의
          알림함으로 보냈어요{sentResult.push > 0 ? ` (기기 푸시 ${sentResult.push}건 포함)` : ""}.
        </div>
      )}

      <div className="rounded-lg border border-hairline bg-canvas p-4">
        {/* 대상 세그먼트 */}
        <div className="text-[13px] font-bold text-ink">받는 대상</div>
        <div className="mt-2 grid grid-cols-2 gap-1 p-1 rounded-lg bg-sunken">
          {(["reviewer", "owner"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => switchAudience(a)}
              aria-pressed={audience === a}
              className={`h-10 rounded-md text-[14px] font-semibold ${
                audience === a ? "bg-canvas text-ink shadow-sm font-bold" : "text-muted"
              }`}
            >
              {a === "reviewer" ? `체험자 ${reviewers.length}명` : `사장님 ${owners.length}명`}
            </button>
          ))}
        </div>

        {/* 수신 범위 — 전체 / 직접 선택 */}
        <div className="mt-4 flex gap-2">
          {(
            [
              { key: "all", label: `전체 ${pool.length}명` },
              { key: "pick", label: "직접 선택" },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              aria-pressed={scope === s.key}
              className={`cp-action h-9 px-3.5 rounded-pill text-[13px] font-semibold ${
                scope === s.key ? "border-[1.5px] border-ink text-ink" : "border border-hairline text-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
          {scope === "pick" && (
            <span className="ml-auto self-center text-[12px] text-muted tabular-nums">{picked.size}명 선택</span>
          )}
        </div>

        {scope === "pick" && (
          <div className="mt-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`${audienceLabel} 이름·이메일 검색`}
              className="w-full h-11 px-3 rounded-md bg-sunken text-[14px] focus:outline-none"
            />
            <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-hairline divide-y divide-hairlineSoft">
              {filtered.length === 0 && (
                <div className="px-3.5 py-4 text-center text-[13px] text-muted">검색 결과가 없어요</div>
              )}
              {filtered.map((r) => (
                <label key={r.id} className="cp-action flex items-center gap-3 px-3.5 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="w-4 h-4 accent-[#9333EA]"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-ink truncate">{r.name}</span>
                    <span className="block text-[12px] text-muted truncate">{r.sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 내용 */}
      <div className="mt-3 rounded-lg border border-hairline bg-canvas p-4 space-y-4">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="nt-title" className="text-[13px] font-bold text-ink">제목</label>
            <span className="text-[11px] text-muted tabular-nums">{title.length}/{TITLE_MAX}</span>
          </div>
          <input
            id="nt-title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            placeholder="예: 서비스 점검 안내"
            className="mt-1.5 w-full h-12 px-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="nt-body" className="text-[13px] font-bold text-ink">내용</label>
            <span className="text-[11px] text-muted tabular-nums">{body.length}/{BODY_MAX}</span>
          </div>
          <textarea
            id="nt-body"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            placeholder="알림함에 그대로 노출되는 본문이에요."
            rows={4}
            className="mt-1.5 w-full px-3 py-2.5 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px] leading-[1.5] resize-none"
          />
        </div>
        <div>
          <label htmlFor="nt-link" className="text-[13px] font-bold text-ink">이동 링크 (선택)</label>
          <input
            id="nt-link"
            value={link}
            onChange={(e) => setLink(e.target.value.trim())}
            placeholder="/r/home 처럼 내부 경로만"
            className="mt-1.5 w-full h-12 px-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[14px] tabular-nums"
          />
          {link && !link.startsWith("/") && (
            <p className="mt-1 text-[12px] text-error">내부 경로(/로 시작)만 사용할 수 있어요.</p>
          )}
        </div>
      </div>

      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}

      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={!canSend || busy}
        className="cp-action mt-4 w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
      >
        {audienceLabel} {targetCount}명에게 발송하기
      </button>

      {/* 확인 모달 — 발송은 회수 불가 */}
      {confirm && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-center justify-center px-8" onClick={() => !busy && setConfirm(false)}>
          <div className="bg-canvas w-full max-w-[340px] rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[17px] font-bold text-ink tracking-title">
              {audienceLabel} {targetCount}명에게 발송할까요?
            </h2>
            <div className="mt-3 rounded-md bg-sunken px-3.5 py-3">
              <div className="text-[14px] font-bold text-ink line-clamp-1">{title}</div>
              <p className="mt-1 text-[13px] text-ink2 leading-[1.5] line-clamp-3 whitespace-pre-wrap">{body}</p>
            </div>
            <p className="mt-2.5 text-[12px] text-muted">발송한 알림은 회수할 수 없어요.</p>
            {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                disabled={busy}
                className="cp-action h-11 px-4 rounded-md bg-sunken text-[14px] font-semibold text-ink disabled:opacity-60"
              >
                취소
              </button>
              <button
                onClick={send}
                disabled={busy}
                className="cp-action flex-1 h-11 rounded-md bg-brand text-white text-[14px] font-bold disabled:opacity-60"
              >
                {busy ? "발송 중..." : "발송하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
