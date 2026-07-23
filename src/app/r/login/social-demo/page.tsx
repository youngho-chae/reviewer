"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// 간편로그인 데모 (2026-07-23) — 프로바이더 키 미설정 환경의 폴백 화면.
// 브라우저별 고정 식별자(localStorage)로 콜백을 호출해 "재로그인 시 같은 계정" 흐름까지 시연한다.
// 실키가 설정되면 start 라우트가 실제 인가 페이지로 보내므로 이 화면은 노출되지 않는다.
export default function SocialDemoPage() {
  return (
    <Suspense fallback={null}>
      <SocialDemo />
    </Suspense>
  );
}

function SocialDemo() {
  const sp = useSearchParams();
  const provider = sp.get("provider") === "kakao" ? "kakao" : "naver";
  const label = provider === "kakao" ? "카카오" : "네이버";
  const [demoId, setDemoId] = useState("");

  useEffect(() => {
    const key = `cp_demo_social_${provider}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, id);
    }
    setDemoId(id);
  }, [provider]);

  return (
    <main className="mobile-shell px-6 pt-14 pb-10 bg-canvas min-h-[100dvh]">
      <Link href="/r/login" className="text-brand text-[15px]">← 로그인으로</Link>
      <h1 className="mt-8 text-[20px] font-bold tracking-title text-ink">{label} 로그인 (데모)</h1>
      <div className="mt-4 rounded-md bg-warningSoft px-4 py-3 text-[13px] text-ink2 leading-[1.6]">
        {label} 로그인 키가 설정되지 않아 <b>데모 모드</b>로 동작해요. 실제 {label} 계정 대신 이 브라우저의
        데모 식별자로 로그인·가입이 진행됩니다. (키 설정 시 실제 {label} 로그인으로 자동 전환)
      </div>
      <p className="mt-4 text-[13px] text-muted tabular-nums">데모 식별자: {demoId || "생성 중..."}</p>
      <a
        href={demoId ? `/api/auth/social/${provider}/callback?demo=1&id=${encodeURIComponent(demoId)}&name=${encodeURIComponent(`${label} 데모 사용자`)}` : undefined}
        aria-disabled={!demoId}
        className={`cp-action mt-6 flex w-full h-[52px] items-center justify-center rounded-md text-[16px] font-bold ${
          provider === "kakao" ? "bg-[#FEE500] text-[#191919]" : "bg-[#03C75A] text-white"
        } ${!demoId ? "opacity-50 pointer-events-none" : ""}`}
      >
        {label} 데모 계정으로 계속하기
      </a>
    </main>
  );
}
