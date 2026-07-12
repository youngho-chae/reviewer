"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SNS_PROVIDER_LOGIN_LABEL } from "@/lib/sns-oauth-labels";
import { CHANNEL_URL_PLACEHOLDER } from "@/lib/channels";
import type { SnsKind } from "@/lib/types";

const METRIC: Record<SnsKind, string> = {
  naver_blog: "일방문자",
  instagram: "팔로워",
  tiktok: "팔로워",
};

// 데모 승인 폼 — POST /api/sns/demo-verify (키 미설정 환경 전용 · 실키 설정 시 서버가 403).
// 데모 데이터(계정 표시명·채널 URL·수치)를 이 화면에서 임시 등록하면서 인증·연동한다 (2026-07-10).
// 채널 관리에서 넘어온 값은 초기값으로 채워지고 여기서 수정할 수 있다.
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
  const [channelUrl, setChannelUrl] = useState(url);
  const [followers, setFollowers] = useState(influence && influence !== "0" ? influence : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sns/demo-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: provider,
          url: channelUrl,
          influence: Number(followers) || 0,
          accountName,
        }),
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
    <div className="mt-5 space-y-4">
      <div>
        <label className="block text-[13px] font-semibold text-ink mb-1.5">계정 표시명 (선택)</label>
        <input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="예) 북촌리뷰어"
          maxLength={60}
          className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
        />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-ink mb-1.5">채널 주소</label>
        <input
          value={channelUrl}
          onChange={(e) => setChannelUrl(e.target.value)}
          placeholder={CHANNEL_URL_PLACEHOLDER[provider]}
          maxLength={300}
          className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
        />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-ink mb-1.5">{METRIC[provider]} 수</label>
        <input
          value={followers}
          onChange={(e) => setFollowers(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder={`예) 12000`}
          className="w-full h-12 px-4 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px] tabular-nums"
        />
        {/* 데모 임시 등록 데이터 — 실 OAuth 활성화(키 설정) 시 프로바이더 조회 값으로 대체된다 */}
        <p className="mt-1.5 text-[11px] text-muted leading-[1.5]">
          지금 입력한 값은 데모용 임시 등록 데이터예요 — 실제 {SNS_PROVIDER_LOGIN_LABEL[provider]} 활성화 시
          계정에서 조회한 값으로 대체돼요.
        </p>
      </div>

      {err && <p className="text-[13px] text-error">{err}</p>}

      <div>
        <button
          type="button"
          onClick={approve}
          disabled={busy}
          className="cp-action w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:opacity-60"
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
    </div>
  );
}
