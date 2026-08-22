"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 탈퇴 확인 하단부 (2026-08-18 와이어프레임) — 동의 체크가 [탈퇴할게요]를 게이트한다.
// 탈퇴 = DELETE /api/auth/account (계정·알림·미사용 리필권·푸시 구독 삭제, 진행 캠페인 모집 종료).
export default function DeleteConfirm() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/account", { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "탈퇴 처리에 실패했습니다");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    /* z-20: (app) 레이아웃 바텀 네비 위에 고정 — 탈퇴 확인 중에는 확인 바가 최하단을 차지 (와이어프레임) */
    <div className="fixed bottom-0 inset-x-0 z-20 max-w-[480px] mx-auto bg-canvas border-t border-hairlineSoft px-5 pt-4 pb-6">
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="w-5 h-5 accent-[#9333EA]"
        />
        <span className="text-[14px] font-semibold text-ink">위 내용을 모두 확인했으며 이에 동의합니다.</span>
      </label>
      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
      <div className="mt-3.5 grid grid-cols-[1fr_1.4fr] gap-2">
        <button
          type="button"
          disabled={!agreed || busy}
          onClick={submit}
          className={`cp-action h-[52px] rounded-md text-[15px] font-bold ${
            agreed ? "bg-errorSoft text-error" : "bg-sunken text-mutedSoft"
          } disabled:opacity-90`}
        >
          {busy ? "처리 중..." : "탈퇴할게요"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => router.push("/o/me")}
          className="cp-action h-[52px] rounded-md bg-ink text-white text-[15px] font-bold"
        >
          계속 이용할게요
        </button>
      </div>
    </div>
  );
}
