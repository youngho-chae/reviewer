"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SBUI, sbNum } from "@/lib/storyboard";
import { COURIERS } from "@/lib/couriers";
import { SHIP_DELAY_NOTICE_MS } from "@/lib/pass-lifecycle";

export interface ShipQueueItem {
  passId: string;
  masked: string; // 익명 #last4 — 등급·실명 비노출 원칙 유지
  campaignTitle: string;
  recipient: string; // 수령인 정보 — 발송 목적 한정 노출 (데이터정책서 §1.0b)
  phone: string;
  address: string;
  option?: string; // 선택한 상품 옵션 (2026-07-16 리뷰노트 벤치마크)
  issuedAt: number;
}

// 배송형 발송 대기 큐 (2026-07-12 레뷰 벤치마크) — 택배사·운송장 입력(선택) 후 발송 처리.
// 발송 처리 시 체험자 리뷰 기한(발송 후 7일)이 시작된다 (/api/owner/ship).
// 신청 후 3일 경과 미발송 건은 지연 강조 (2026-07-16 — 표시 전용).
export default function ShipQueue({ items }: { items: ShipQueueItem[] }) {
  const router = useRouter();
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [courier, setCourier] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ship(passId: string) {
    setBusyId(passId);
    setErr(null);
    const res = await fetch("/api/owner/ship", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        passId,
        trackingNo: (tracking[passId] || "").trim() || undefined,
        courier: courier[passId] || undefined,
      }),
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
        {items.map((it) => {
          const delayed = Date.now() - it.issuedAt > SHIP_DELAY_NOTICE_MS;
          return (
            <div key={it.passId} className={`rounded-md border p-3.5 ${delayed ? "border-warning/50" : "border-hairline"}`}>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-ink flex items-center gap-1.5">
                  익명 {it.masked}
                  {/* 신청 후 3일 경과 미발송 — 지연 강조 (체험자 화면에도 같은 기준으로 표시) */}
                  {delayed && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-pill bg-warningSoft text-warning text-[11px] font-semibold">
                      지연 {Math.floor((Date.now() - it.issuedAt) / 86400000)}일
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted truncate max-w-[160px]">{it.campaignTitle}</span>
              </div>
              {/* 수령인 정보 — 발송 목적 한정 노출 (등급·계정 정보는 계속 비노출) */}
              <div className="mt-2 text-[13px] text-ink2 leading-[1.6]">
                {sbNum("수령인 · 000-0000-0000", `${it.recipient} · ${it.phone}`)}
                <br />
                <span className="text-muted">{sbNum("배송지 주소", it.address)}</span>
                {it.option && (
                  <>
                    <br />
                    <span className="font-semibold text-ink">옵션 · {it.option}</span>
                  </>
                )}
              </div>
              <div className="mt-2.5 flex gap-2">
                <select
                  value={courier[it.passId] || ""}
                  onChange={(e) => setCourier((m) => ({ ...m, [it.passId]: e.target.value }))}
                  aria-label="택배사 선택"
                  className={`h-10 px-2 rounded-sm border border-hairline bg-canvas text-[13px] ${courier[it.passId] ? "text-ink" : "text-mutedSoft"}`}
                >
                  <option value="">택배사</option>
                  {COURIERS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  value={tracking[it.passId] || ""}
                  onChange={(e) => setTracking((m) => ({ ...m, [it.passId]: e.target.value }))}
                  placeholder={`운송장 번호 (선택 · ${SBUI.trackingNo})`}
                  className="flex-1 min-w-0 h-10 px-3 rounded-sm border border-hairline text-[13px] focus:border-brand focus:outline-none"
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
          );
        })}
      </div>
      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
    </div>
  );
}
