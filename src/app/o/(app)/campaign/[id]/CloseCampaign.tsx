"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 캠페인 조기 종료 (2026-07-24) — 진행 중 캠페인 관리 화면 전용.
 * 종료 정책(발급·확정 건 유지, 미확정 예약 자동 취소, 미참여분 자동 복원)을
 * 확인 패널에서 안내한 뒤 실행한다. 서버 코어: src/lib/campaign-close.ts
 */
export default function CloseCampaign({
  campaignId,
  activeQr,
  confirmedRsv,
  pendingRsv,
}: {
  campaignId: string;
  activeQr: number; // 발급된 QR 체험권 (방문형 active)
  confirmedRsv: number; // 확정된 예약
  pendingRsv: number; // 확정 전 예약 요청 (종료 시 자동 취소)
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/campaign-close", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "종료 처리에 실패했어요.");
      setBusy(false);
      return;
    }
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="px-5 mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cp-action w-full h-11 rounded-md border border-hairline bg-canvas text-[14px] font-semibold text-error"
        >
          캠페인 종료하기
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 mt-3">
      <div className="rounded-lg border border-error/30 bg-errorSoft/40 p-4">
        <div className="text-[15px] font-bold text-ink">캠페인을 지금 종료할까요?</div>
        <ul className="mt-2.5 space-y-1.5 text-[13px] text-ink2 leading-[1.55] list-disc pl-4">
          <li>신규 발급·예약 신청이 즉시 중단되고, 탐색에서 내려가요.</li>
          <li>
            이미 <b>발급된 체험권 {activeQr}건</b>
            {confirmedRsv > 0 && (
              <>
                과 <b>확정된 예약 {confirmedRsv}건</b>
              </>
            )}
            은 종료 후에도 유효 기한까지 그대로 참여할 수 있어요 (체험자에게 안내가 발송돼요).
          </li>
          {pendingRsv > 0 && (
            <li>
              <b>확정 전 예약 요청 {pendingRsv}건</b>은 자동 취소돼요 (체험자 페널티 없음).
            </li>
          )}
          <li>발급·확정 건은 사용한 것으로 보고 잔여를 계산하며, 체험자가 끝내 참여하지 않으면 그 인원만큼 모집 현황이 자동 복원돼요.</li>
        </ul>
        {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cp-action h-10 px-4 rounded-sm border border-hairline bg-canvas text-[13px] font-semibold text-ink"
          >
            돌아가기
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="cp-action flex-1 h-10 rounded-sm bg-error text-white text-[13px] font-bold disabled:opacity-60"
          >
            {busy ? "종료 중..." : "캠페인 종료"}
          </button>
        </div>
      </div>
    </div>
  );
}
