"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import type { MatrixKey, ShareChannel, UserKind } from "@/lib/types";

interface Props {
  nickname: string;
  myKind: "reviewer" | "owner";
  initialTarget: UserKind;
  storeId?: string;
  campaignId?: string;
}

const CHANNELS: { key: ShareChannel; label: string; ic: string }[] = [
  { key: "kakao", label: "카톡", ic: "💬" },
  { key: "sms", label: "문자", ic: "✉️" },
  { key: "instagram_dm", label: "인스타 DM", ic: "📷" },
  { key: "copy_link", label: "링크 복사", ic: "🔗" },
];

function matrixOf(refKind: UserKind, tgt: UserKind): MatrixKey {
  if (refKind === "reviewer" && tgt === "reviewer") return "RR";
  if (refKind === "reviewer" && tgt === "owner") return "RO";
  if (refKind === "owner" && tgt === "reviewer") return "OR";
  return "OO";
}

function previewFor(m: MatrixKey): string {
  switch (m) {
    case "RR": return "첫 캠페인 +50% 지원금 쿠폰";
    case "RO": return "첫 달 멤버십 50% 할인";
    case "OR": return "이 매장 첫 캠페인 +50% 지원금";
    case "OO": return "사장님 동료 가입 첫 달 멤버십 50% 할인";
  }
}

export default function InviteComposer({ nickname, myKind, initialTarget, storeId, campaignId }: Props) {
  const [target, setTarget] = useState<UserKind>(initialTarget);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<ShareChannel | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const m = useMemo(() => matrixOf(myKind, target), [myKind, target]);
  const preview = previewFor(m);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = token ? `${origin}/r/i/${token}` : `${origin}/r/i/<token>`;

  async function pick(ch: ShareChannel) {
    setErr(null);
    setBusy(ch);
    try {
      const r = await fetch("/api/referral/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetKind: target, storeId, campaignId, channel: ch }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setErr(j.error || "토큰 발급 실패");
        return;
      }
      const { token: t } = (await r.json()) as { token: string };
      setToken(t);
      if (ch === "copy_link" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(`${origin}/r/i/${t}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {}
      } else if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: "CATCHPASS",
            text: `${nickname}님이 선물을 보냈어요 — ${preview}`,
            url: `${origin}/r/i/${t}`,
          });
        } catch {
          // 사용자가 공유 시트 닫음 — 무시
        }
      }
    } finally {
      setBusy(null);
    }
  }

  async function copyAfterIssued() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`${origin}/r/i/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="px-6 pt-6 space-y-6">
      {/* 받을 사람의 선물 미리보기 */}
      <div className="rounded-lg bg-brand text-white p-5">
        <div className="text-[11px] uppercase tracking-[0.14em] opacity-75">받는 사람이 받을 선물</div>
        <div className="text-[20px] font-bold leading-[1.3] mt-2 tracking-title">{preview}</div>
        <div className="text-[11px] mt-2 opacity-80">
          매트릭스{" "}
          <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-white/12 border border-white/20 text-white text-[11px]">{m}</span>
          {" · "}
          {m === "RR" && "체험자 → 친구 체험자"}
          {m === "RO" && "체험자 → 단골 매장(사장님)"}
          {m === "OR" && "사장님 → 손님(체험자)"}
          {m === "OO" && "사장님 → 동료 사장님"}
        </div>
        <div className="text-[11px] opacity-75 mt-2">
          가입 즉시 양쪽 모두 박스 오픈 · 친구 가입 → 내 행운 박스 동시 도착
        </div>
      </div>

      {/* 초대 대상 */}
      <section>
        <div className="text-[12px] uppercase tracking-[0.14em] text-muted mb-2">초대 대상</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTarget("reviewer")}
            className={`flex-1 h-12 rounded-md border text-[14px] font-medium ${target === "reviewer" ? "border-[1.5px] border-brand text-brand bg-brandSoft font-semibold" : "border-hairline bg-canvas text-ink"}`}
          >
            🧑 친구 체험자
          </button>
          <button
            type="button"
            onClick={() => setTarget("owner")}
            className={`flex-1 h-12 rounded-md border text-[14px] font-medium ${target === "owner" ? "border-[1.5px] border-brand text-brand bg-brandSoft font-semibold" : "border-hairline bg-canvas text-ink"}`}
          >
            🏪 사장님 친구
          </button>
        </div>
      </section>

      {/* 미리보기 메시지 */}
      <section>
        <div className="text-[12px] uppercase tracking-[0.14em] text-muted mb-2">자동 생성 메시지</div>
        <div className="rounded-md border border-hairline bg-parchment p-4 text-[13px] text-ink2">
          <strong className="text-ink">{nickname}</strong>님이 친구{target === "owner" ? " 사장님" : ""}에게{" "}
          <strong className="text-brand">{preview}</strong>을(를) 보냈어요. 30초만에 받으세요 →
          <div className="text-[11px] text-muted font-mono mt-2 break-all">{url}</div>
        </div>
      </section>

      {/* 채널 선택 — 1탭 발사 */}
      <section>
        <div className="text-[12px] uppercase tracking-[0.14em] text-muted mb-2">공유 채널</div>
        <div className="grid grid-cols-4 gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => pick(c.key)}
              disabled={busy !== null}
              className="cp-action rounded-md border border-hairline bg-canvas p-3 text-center text-[12px] text-ink disabled:opacity-50"
            >
              <div className="text-[24px] leading-none">{c.ic}</div>
              <div className="mt-2">{c.label}</div>
            </button>
          ))}
        </div>
        {err && <div className="mt-2 text-[12px] text-error">{err}</div>}
      </section>

      {/* 발급 결과 */}
      {token && (
        <section className="rounded-md border border-success/30 bg-success/4 p-4">
          <div className="text-[13px] font-semibold text-success">✓ 토큰 발급 완료</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-[12px] text-ink2 break-all flex-1">{url}</span>
            <button
              type="button"
              onClick={copyAfterIssued}
              className="cp-action h-8 px-3 rounded-pill border border-hairline bg-canvas text-[12px] text-ink"
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <div className="mt-3 text-[11px] text-muted">
            친구가 14일 이내 토큰으로 가입하면, 양쪽 모두 박스가 즉시 오픈됩니다.
          </div>
        </section>
      )}
    </div>
  );
}
