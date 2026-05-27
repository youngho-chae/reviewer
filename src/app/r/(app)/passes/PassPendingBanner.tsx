"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// 멀티 인스턴스 환경에서 KV 미연결 시 발생할 수 있는
// "방금 발급한 체험권이 다른 인스턴스에 안 보임" 상황에 대한
// 점진적 동기화 폴링 + 안내.
export default function PassPendingBanner({ pendingId }: { pendingId: string }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 8;
  // 초반에 빠르게, 점점 길게 시도 (총 약 12초)
  const delays = [400, 700, 1000, 1500, 1800, 2000, 2200, 2400];

  useEffect(() => {
    if (attempts >= maxAttempts) return;
    const delay = delays[attempts] ?? 2000;
    const t = setTimeout(() => {
      router.refresh();
      setAttempts((a) => a + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [attempts, router]);

  const exhausted = attempts >= maxAttempts;

  return (
    <div className="mx-6 mt-4 p-4 rounded-md border border-hairline bg-parchment">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {exhausted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7a7a7a" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0066cc" strokeWidth="1.6" strokeLinecap="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.2-8.55" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-ink">
            {exhausted ? "체험권 동기화에 시간이 걸리고 있어요" : "방금 발급한 체험권을 동기화 중이에요"}
          </div>
          <div className="text-[12px] text-muted mt-1 leading-[1.5]">
            {exhausted ? (
              <>
                서버 인스턴스 간 데이터 동기화가 지연되고 있습니다.
                새로고침해주세요 — 발급 처리는 정상 완료되었습니다.
              </>
            ) : (
              "잠시만 기다려주세요. 자동으로 목록에 반영됩니다."
            )}
          </div>
          {exhausted && (
            <button
              type="button"
              onClick={() => {
                setAttempts(0);
                router.refresh();
              }}
              className="mt-2 text-[12px] text-brand font-semibold"
            >
              다시 시도
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
