"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SNS_PROVIDER_LOGIN_LABEL } from "@/lib/sns-oauth-labels";
import type { SnsKind } from "@/lib/types";

// 데모 승인 폼 — POST /api/sns/demo-verify (키 미설정 환경 전용 · 실키 설정 시 서버가 403).
export default function DemoVerifyForm({
  provider,
  url,
  influence,
}: {
  provider: SnsKind;
  url: string;
  influence: string;
}) {
  const router = useRouter();
  const [accountName, setAccountName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sns/demo-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: provider, url, influence: Number(influence) || 0, accountName }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "인증에 실패했습니다");
        setBusy(false);
        return;
      }
      router.push(`/r/me/channels?connected=${provider}`);
      router.refresh();
    } catch {
      setErr("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <label className="block text-[13px] font-semibold text-ink mb-1.5">계정 표시명 (선택)</label>
      <input
        value={accountName}
        onChange={(e) => setAccountName(e.target.value)}
        placeholder="예) 북촌리뷰어"
        maxLength={60}
        className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
      />
      {url && <p className="mt-2 text-[12px] text-muted truncate">연동할 채널 주소: {url}</p>}

      {err && <p className="mt-3 text-[13px] text-error">{err}</p>}

      <button
        type="button"
        onClick={approve}
        disabled={busy}
        className="cp-action mt-5 w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:opacity-60"
      >
        {busy ? "인증 중..." : `본인 계정으로 승인 (데모 ${SNS_PROVIDER_LOGIN_LABEL[provider]})`}
      </button>
      <button
        type="button"
        onClick={() => router.push("/r/me/channels")}
        disabled={busy}
        className="cp-action mt-2 w-full h-11 rounded-md border border-hairline bg-canvas text-[14px] font-semibold text-ink"
      >
        취소
      </button>
    </div>
  );
}
