"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 회원 탈퇴 — 2단 확인 후 DELETE /api/auth/account.
// 개인정보(계정·알림·미사용 보상)는 즉시 파기되며, 거래 기록은 법령에 따라 비식별 보존됨을 고지한다.
export default function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/auth/account", { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "탈퇴 처리에 실패했습니다");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="cp-action text-[13px] text-muted underline">
        회원 탈퇴
      </button>
    );
  }

  return (
    <div className="rounded-md border border-error/30 bg-errorSoft p-4 text-left">
      <div className="text-[14px] font-semibold text-ink">정말 탈퇴하시겠어요?</div>
      <p className="mt-2 text-[12px] text-muted leading-[1.55]">
        계정 정보(이메일·닉네임·연동 채널)와 미사용 보상이 즉시 삭제됩니다.
        체험권 사용 기록은 전자상거래법에 따라 비식별 상태로 보존됩니다. 이 작업은 되돌릴 수 없습니다.
      </p>
      {err && <div className="mt-2 text-[12px] text-error">{err}</div>}
      <div className="mt-3 flex gap-2">
        <button
          disabled={loading}
          onClick={submit}
          className="cp-action h-10 px-4 rounded-md bg-error text-white text-[13px] font-semibold disabled:opacity-50"
        >
          {loading ? "처리 중..." : "탈퇴하기"}
        </button>
        <button
          disabled={loading}
          onClick={() => setConfirming(false)}
          className="cp-action h-10 px-4 rounded-md border border-hairline bg-canvas text-ink text-[13px] font-semibold"
        >
          취소
        </button>
      </div>
    </div>
  );
}
