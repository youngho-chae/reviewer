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
    router.push(`/r/passes/${passId}`);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full h-14 rounded-full bg-ink text-white text-[16px] font-bold">참여하기 ({myGrade}등급)</button>
      {open && (
        <div className="fixed inset-0 bg-ink/55 backdrop-blur-sm z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-[480px] mx-auto rounded-t-[24px] p-6 pt-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-success/15 grid place-items-center">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2F8F6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
              </div>
            </div>
            <h2 className="text-[22px] font-extrabold text-center tracking-tight">체험권 발급 확인</h2>
            <p className="mt-2 text-[13px] text-muted text-center leading-relaxed">
              발급 후 24시간 이내 매장 방문 시 결제 전 QR을 제시해주세요.
            </p>
            <div className="mt-5 p-4 bg-surfaceSoft border border-hairline rounded-md space-y-2.5 text-[13px]">
              <div className="flex justify-between"><span className="text-muted">사용 기간</span><span className="font-bold">24시간 이내</span></div>
              <div className="h-px bg-hairline" />
              <div className="flex justify-between"><span className="text-muted">리뷰 마감</span><span className="font-bold">방문 + 72시간</span></div>
            </div>
            <div className="mt-3 p-3.5 bg-brand/20 border border-brand rounded-md text-[12px] leading-relaxed text-ink2">
              💡 미사용 시 자동 만료 · 노쇼 시 등급 점수 차감
            </div>
            {err && <div className="mt-3 text-error text-[13px]">{err}</div>}
            <div className="mt-5 space-y-2">
              <button onClick={go} disabled={busy} className="w-full h-14 rounded-full bg-ink text-white text-[15px] font-bold disabled:opacity-50">{busy ? "발급 중..." : "확인 · 내 체험권 보기"}</button>
              <button onClick={() => setOpen(false)} className="w-full h-12 text-muted text-[13px]">취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
