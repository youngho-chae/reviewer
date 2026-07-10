"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 사용 전(active) 체험권 취소 — 확인 단계 후 POST /api/passes/cancel.
// 취소 시 모집 슬롯이 즉시 복구되므로, 방문이 어려우면 만료 방치보다 취소를 유도한다.
// variant "link"(기본) = 상세 화면의 밑줄 텍스트 / "row" = 목록 카드의 아웃라인 행 버튼.
export default function CancelPassButton({
  passId,
  variant = "link",
}: {
  passId: string;
  variant?: "link" | "row";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/passes/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passId }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "취소 실패");
      setLoading(false);
      return;
    }
    router.push("/r/passes");
    router.refresh();
  }

  if (!confirming) {
    if (variant === "row") {
      return (
        <button
          onClick={() => setConfirming(true)}
          className="cp-action flex-1 h-11 rounded-md border border-hairline bg-canvas text-[14px] font-semibold text-ink"
        >
          참여 취소
        </button>
      );
    }
    return (
      <button onClick={() => setConfirming(true)} className="cp-action mt-4 text-[13px] text-muted underline">
        방문이 어려워요 — 참여 취소
      </button>
    );
  }

  // 확인 단계 — 중앙 모달 (2026-07-08 시안)
  return (
    <>
      {/* 트리거 자리 유지 (row는 버튼 행 레이아웃 보존) */}
      {variant === "row" ? (
        <button disabled className="flex-1 h-11 rounded-md border border-hairline bg-canvas text-[14px] font-semibold text-mutedSoft">
          참여 취소
        </button>
      ) : (
        <span className="mt-4 inline-block text-[13px] text-mutedSoft underline">방문이 어려워요 — 참여 취소</span>
      )}
      <div
        className="fixed inset-0 bg-ink/45 z-50 flex items-center justify-center px-6"
        onClick={() => !loading && setConfirming(false)}
      >
        <div
          className="w-full max-w-[400px] bg-canvas rounded-xl px-6 pt-8 pb-6 text-center"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-label="참여 취소 확인"
        >
          <p className="text-[15px] text-ink leading-[1.6]">
            같은 캠페인의 경우 재신청은 12시간 뒤부터 가능해요.
            <br />
            신중하게 선택해주세요.
          </p>
          {err && <div className="mt-3 text-[12px] text-error">{err}</div>}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              disabled={loading}
              onClick={submit}
              className="cp-action h-12 rounded-md bg-sunken text-ink text-[15px] font-semibold disabled:opacity-50"
            >
              {loading ? "취소 중..." : "취소할게요"}
            </button>
            <button
              disabled={loading}
              onClick={() => setConfirming(false)}
              className="cp-action h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:opacity-60"
            >
              계속 사용할게요
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
