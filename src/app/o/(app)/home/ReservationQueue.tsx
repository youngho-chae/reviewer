"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SBUI, sbNum } from "@/lib/storyboard";

export interface ReservationQueueItem {
  passId: string;
  masked: string; // 익명 #last4 — 등급·실명 비노출 원칙 유지 (확정 정책 8)
  campaignTitle: string;
  label: string; // "7월 18일 (토) 14:00"
  status: "requested" | "confirmed";
  epoch: number; // 예약 일시 (정렬용)
}

// 예약 확인 큐 (2026-07-16 리뷰노트 벤치마크) — 예약형 방문 신청을 확인·확정한다.
// [P1] 예약은 참여 승인/선정이 아니라 일정 조율 — 거절 버튼은 두지 않는다.
// 일시가 곤란하면 체험자가 예약을 변경한다 (변경 시 다시 확인 대기로 이 큐에 표시).
export default function ReservationQueue({ items }: { items: ReservationQueueItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function confirm(passId: string) {
    setBusyId(passId);
    setErr(null);
    const res = await fetch("/api/owner/reserve-confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "예약 확인에 실패했어요.");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    router.refresh();
  }

  if (items.length === 0) return null;
  const pendingCount = items.filter((it) => it.status === "requested").length;

  return (
    <div className="mx-5 mt-3 rounded-lg border border-info bg-canvas p-4">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-ink">
          📅 방문 예약 {items.length}건{pendingCount > 0 ? ` · 확인 대기 ${pendingCount}건` : ""}
        </div>
        <div className="text-[11px] text-muted">확인하면 체험자에게 알림이 가요</div>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((it) => (
          <div key={it.passId} className="rounded-md border border-hairline p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-ink">익명 {it.masked}</span>
              <span className="text-[11px] text-muted truncate max-w-[150px]">{it.campaignTitle}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-ink tabular-nums">
                {sbNum(SBUI.dateTime, it.label)} 방문
              </span>
              {it.status === "requested" ? (
                <button
                  type="button"
                  onClick={() => confirm(it.passId)}
                  disabled={busyId === it.passId}
                  className="cp-action h-9 px-4 rounded-sm bg-brand text-white text-[13px] font-bold disabled:opacity-60"
                >
                  {busyId === it.passId ? "확인 중..." : "예약 확인"}
                </button>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-pill bg-successSoft text-successStrong text-[11px] font-semibold">
                  확정됨
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
      <p className="mt-2.5 text-[11px] text-muted leading-[1.5]">
        일시가 곤란하면 체험자에게 예약 변경을 안내해주세요 · 변경되면 다시 확인 대기로 표시돼요.
      </p>
    </div>
  );
}
