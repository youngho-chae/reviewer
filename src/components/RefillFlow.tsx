"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { openPaymentTestWindow } from "@/lib/payment";

/**
 * 모집 한도 리필권 플로우 (2026-07-31 2차 보완 — 쿠폰형, 정본 src/lib/limit-refill.ts).
 * 트리거 버튼 + 구매 확인 바텀시트, 그 외 안내는 중앙 모달 (2026-08-04 개편):
 *  - 보유 쿠폰 없음 → 시트 "리필권을 구매할까요?"([구매하기] — 금액 미표기) → 구매(쿠폰 발급)
 *    → **모달** "리필권을 구매했어요" [지금 쓰기](이번 주기 한도 가산) / [나중에 쓰기](쿠폰함 보관)
 *  - 보유 쿠폰 있음 → **모달** "보유한 리필권 n개 중 1개를 사용할까요?" → 사용(오래된 쿠폰부터)
 * 홈·새 캠페인 등록의 모집 한도 카드·쿠폰함이 공유한다. Free는 트리거를 렌더하지 않는다.
 */
export default function RefillFlow({
  plan,
  grant,
  price,
  owned,
  trigger,
  className,
  mode = "auto",
  onDone,
}: {
  plan: string;
  grant: number; // 지금 구매 시 지급 수량 (현재 플랜 기준)
  price: number;
  owned: number; // 보유(미사용) 쿠폰 수
  trigger: ReactNode; // 트리거 버튼 내용 (예: "리필하기")
  className: string; // 트리거 버튼 클래스
  mode?: "auto" | "buy"; // auto = 보유 시 사용 플로우 / buy = 항상 구매 (쿠폰함 구매 버튼)
  onDone?: () => void; // 적용/구매 후 갱신 (기본 router.refresh)
}) {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "buy" | "useNow" | "use">("closed");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [boughtAmount, setBoughtAmount] = useState(0);

  if (plan === "Free") return null; // Free 미판매 — Basic 업그레이드 유도는 업셀 카드 담당

  const done = () => (onDone ? onDone() : router.refresh());

  // 닫기 — 구매 완료 안내(useNow)에서 닫으면(오버레이·[나중에 쓰기]) 구매가 이미 이뤄진
  // 상태이므로 done()으로 보유 수·화면 갱신을 마무리한다 (2026-08-05)
  const close = () => {
    const purchased = step === "useNow";
    setStep("closed");
    if (purchased) done();
  };

  function open() {
    setErr(null);
    setStep(mode === "buy" ? "buy" : owned > 0 ? "use" : "buy");
  }

  // 구매 = 쿠폰 발급 (자동 적용 아님) → [지금 쓰기]/[나중에 쓰기] 선택 단계로.
  // done()은 여기서 호출하지 않는다 (2026-08-05) — onDone이 부모 시트를 닫는 화면(업셀 시트)에서
  // 구매 직후 호출하면 RefillFlow가 언마운트되어 완료 모달이 사라진다. 플로우 종료 시점에 호출.
  async function buy() {
    // 결제 테스트 모듈 (2026-08-30, 정본 src/lib/payment.ts) — 팝업 차단 회피를 위해 await 이전 동기 호출
    openPaymentTestWindow();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/limit-refill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "구매에 실패했어요.");
      return;
    }
    setBoughtAmount(j.amount ?? grant);
    setStep("useNow");
  }

  async function useOne() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/owner/limit-refill/use", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "사용에 실패했어요.");
      return;
    }
    setStep("closed");
    done();
  }

  const sheet = (content: ReactNode) => (
    <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => !busy && close()}>
      <div className="w-full rounded-t-xl bg-canvas p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center mb-3">
          <span className="w-9 h-1 rounded-pill bg-borderStrong" />
        </div>
        {content}
      </div>
    </div>
  );

  // 중앙 모달 (2026-08-04) — 구매 완료 안내·보유 쿠폰 사용 확인은 시트 대신 모달로
  const modal = (content: ReactNode) => (
    <div className="fixed inset-0 bg-ink/45 z-50 grid place-items-center px-6" onClick={() => !busy && close()}>
      <div className="w-full rounded-xl bg-canvas p-5" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={open} className={className}>
        {trigger}
      </button>

      {/* 구매 확인 — 보유 쿠폰이 없을 때 */}
      {step === "buy" &&
        sheet(
          <>
            <h3 className="text-center text-[17px] font-bold text-ink tracking-title">리필권을 구매할까요?</h3>
            <div className="mt-4 rounded-lg bg-sunken p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted">모집 한도 리필권</span>
                <span className="text-[15px] font-bold text-ink tabular-nums">{plan} 플랜 기준 +{grant}건</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[13px] text-muted">가격</span>
                <span className="text-[15px] font-bold text-ink tabular-nums">{price.toLocaleString()}원</span>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-[12px] text-ink2 leading-[1.55] list-disc pl-4">
              <li>구매하면 쿠폰으로 발급돼요 — 바로 쓰거나 쿠폰함에 보관할 수 있어요.</li>
              <li>사용하면 이번 결제 주기 모집 한도에 추가되고, 그 주기까지만 유효해요 (남은 수량 이월 불가).</li>
              <li>요금은 결제(PG) 연동 전까지 운영팀이 확인 후 청구해요.</li>
            </ul>
            {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setStep("closed")}
                disabled={busy}
                className="cp-action w-[104px] h-12 rounded-md bg-sunken text-[15px] font-semibold text-ink disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={buy}
                disabled={busy}
                className="cp-action flex-1 h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:opacity-60"
              >
                {busy ? "구매 중..." : "구매하기"}
              </button>
            </div>
          </>,
        )}

      {/* 구매 완료 — 지금 쓰기 / 나중에 쓰기 (2026-08-04 — 시트 대신 모달) */}
      {step === "useNow" &&
        modal(
          <>
            <h3 className="text-center text-[17px] font-bold text-ink tracking-title">리필권을 구매했어요</h3>
            <p className="mt-2.5 text-center text-[13px] text-ink2 leading-[1.6]">
              지금 사용하면 이번 결제 주기 모집 한도가 <b className="text-ink">{boughtAmount}건</b> 늘어나요.
              <br />
              나중에 쓰면 마이페이지 쿠폰함에 보관돼요.
            </p>
            {err && <p className="mt-2 text-center text-[12px] text-error">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="cp-action flex-1 h-12 rounded-md bg-sunken text-[15px] font-semibold text-ink disabled:opacity-60"
              >
                나중에 쓰기
              </button>
              <button
                type="button"
                onClick={useOne}
                disabled={busy}
                className="cp-action flex-1 h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:opacity-60"
              >
                {busy ? "적용 중..." : "지금 쓰기"}
              </button>
            </div>
          </>,
        )}

      {/* 사용 확인 — 보유 쿠폰이 있을 때 (2026-08-04 — 시트 대신 모달) */}
      {step === "use" &&
        modal(
          <>
            <h3 className="text-center text-[17px] font-bold text-ink tracking-title">
              보유한 리필권 {owned}개 중 1개를 사용할까요?
            </h3>
            <p className="mt-2.5 text-center text-[13px] text-ink2 leading-[1.6]">
              사용하면 이번 결제 주기 모집 한도가 늘어나고,
              <br />
              추가된 한도는 이번 결제 주기까지만 유효해요.
            </p>
            {err && <p className="mt-2 text-center text-[12px] text-error">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setStep("closed")}
                disabled={busy}
                className="cp-action w-[104px] h-12 rounded-md bg-sunken text-[15px] font-semibold text-ink disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={useOne}
                disabled={busy}
                className="cp-action flex-1 h-12 rounded-md bg-brand text-white text-[15px] font-bold disabled:opacity-60"
              >
                {busy ? "적용 중..." : "사용하기"}
              </button>
            </div>
          </>,
        )}
    </>
  );
}
