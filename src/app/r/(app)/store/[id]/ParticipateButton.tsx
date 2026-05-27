"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ParticipateButton({ campaignId, myGrade }: { campaignId: string; myGrade: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/passes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErr(error || "참여 실패");
      setBusy(false);
      return;
    }
    const { passId } = await res.json();
    if (!passId) {
      setErr("발급에 실패했어요. 다시 시도해주세요.");
      setBusy(false);
      return;
    }
    // 발급 후 내 체험권 목록으로 이동, 발급된 카드를 하이라이트.
    router.refresh();
    router.push(`/r/passes?just_issued=${passId}`);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full h-11 rounded-pill bg-brand text-white text-[17px]">참여하기</button>
      {open && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-lg p-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-[28px] leading-[1.14] text-ink text-center">참여 신청 확인</h2>
            <p className="mt-3 text-[15px] text-ink2 text-center leading-[1.47]">
              발급 후 24시간 이내 매장 방문 시<br />결제 전 QR을 제시해주세요.
            </p>
            <div className="mt-7 space-y-3 text-[15px]">
              <div className="flex justify-between border-b border-hairline pb-3">
                <span className="text-muted">사용 기간</span>
                <span className="text-ink">발급 후 24시간</span>
              </div>
              <div className="flex justify-between border-b border-hairline pb-3">
                <span className="text-muted">리뷰 마감</span>
                <span className="text-ink">방문 + 72시간</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">내 등급</span>
                <span className="text-ink">{myGrade}등급</span>
              </div>
            </div>
            {err && <div className="mt-4 text-error text-[13px]">{err}</div>}
            <div className="mt-7 space-y-3">
              <button onClick={go} disabled={busy} className="w-full h-11 rounded-pill bg-brand text-white text-[17px] disabled:opacity-50">{busy ? "발급 중..." : "발급받고 체험권 보기"}</button>
              <button onClick={() => setOpen(false)} className="w-full h-11 text-brand text-[15px]">취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
