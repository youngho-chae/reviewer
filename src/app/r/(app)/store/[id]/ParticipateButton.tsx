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
      <button onClick={() => setOpen(true)} className="w-full h-14 rounded-sm bg-brand text-white text-[16px] font-medium">참여하기 ({myGrade}등급)</button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-[480px] mx-auto rounded-t-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold">체험권 발급 확인</h2>
            <ul className="mt-4 space-y-2 text-[14px] text-body">
              <li>· 참여 후 <b className="text-ink">24시간 이내</b> 사용</li>
              <li>· 결제 전 QR을 사장님에게 제시</li>
              <li>· 사용 후 <b className="text-ink">60일 이상</b> 게시 가능한 리뷰 작성</li>
              <li>· 노쇼 시 등급 점수 차감</li>
            </ul>
            {err && <div className="mt-3 text-error text-[13px]">{err}</div>}
            <div className="mt-6 space-y-2">
              <button onClick={go} disabled={busy} className="w-full h-12 rounded-sm bg-brand text-white text-[15px] font-medium disabled:opacity-50">{busy ? "발급 중..." : "확인하고 발급받기"}</button>
              <button onClick={() => setOpen(false)} className="w-full h-12 rounded-sm border border-hairline text-[15px]">취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
