"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SBUI, sbNum } from "@/lib/storyboard";

export interface ShipQueueItem {
  passId: string;
  masked: string; // 익명 #last4 — 등급·실명 비노출 원칙 유지
  campaignTitle: string;
  recipient: string; // 수령인 정보 — 발송 목적 한정 노출 (데이터정책서 §1.0b)
  phone: string;
  address: string;
  issuedAt: number;
}

// 배송형 발송 대기 큐 (2026-07-12 레뷰 벤치마크) — 운송장 입력(선택) 후 발송 처리.
// 발송 처리 시 체험자 리뷰 기한(발송 후 7일)이 시작된다 (/api/owner/ship).
export default function ShipQueue({ items }: { items: ShipQueueItem[] }) {
  const router = useRouter();
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ship(passId: string) {
    setBusyId(passId);
    setErr(null);
    const res = await fetch("/api/owner/ship", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId, trackingNo: (tracking[passId] || "").trim() || undefined }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "발송 처리에 실패했어요.");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    router.refresh();
  }

  if (items.length === 0) return null;

  return (
    <div className="mx-5 mt-3 rounded-lg border border-brand bg-canvas p-4">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-ink">📦 발송 대기 {items.length}건</div>
        <div className="text-[11px] text-muted">발송 처리 시 리뷰 기한(7일)이 시작돼요</div>
      </div>
      <div className="mt-3 space-y-3">
        {items.map((it) => (
          <div key={it.passId} className="rounded-md border border-hairline p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-ink">익명 {it.masked}</span>
              <span className="text-[11px] text-muted truncate max-w-[160px]">{it.campaignTitle}</span>
            </div>
            {/* 수령인 정보 — 발송 목적 한정 노출 (등급·계정 정보는 계속 비노출) */}
            <div className="mt-2 text-[13px] text-ink2 leading-[1.6]">
              {sbNum("수령인 · 000-0000-0000", `${it.recipient} · ${it.phone}`)}
              <br />
              <span className="text-muted">{sbNum("배송지 주소", it.address)}</span>
            </div>
            <div className="mt-2.5 flex gap-2">
              <input
                value={tracking[it.passId] || ""}
                onChange={(e) => setTracking((m) => ({ ...m, [it.passId]: e.target.value }))}
                placeholder={`운송장 번호 (선택 · ${SBUI.trackingNo})`}
                className="flex-1 h-10 px-3 rounded-sm border border-hairline text-[13px] focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => ship(it.passId)}
                disabled={busyId === it.passId}
                className="cp-action h-10 px-4 rounded-sm bg-brand text-white text-[13px] font-bold disabled:opacity-60"
              >
                {busyId === it.passId ? "처리 중..." : "발송 처리"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
    </div>
  );
}
