"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRView from "./QRView";
import Countdown from "./Countdown";
import { SBUI, sbNum } from "@/lib/storyboard";
import { receiptSupportFor, RECEIPT_DISCOUNT_LABEL } from "@/lib/grade";

/**
 * 체험권(active) 사용 화면 (2026-07-08 시안 개편) — [QR 스캔 | 코드 입력] 세그먼트.
 *  - QR 스캔: QR만 제시 — 실 결제 금액은 사장님 스캐너(/o/scan)에서 입력 (유저 화면 미노출)
 *  - 코드 입력: 사장님이 설정한 매장 확인 번호 4자리 + 실 결제 금액(선택) 입력 → 사용처리
 *    (POST /api/passes/use-by-code — 코드 비노출·직접 입력 = 사장님 확인 원칙 유지)
 */
export default function PassTicket({
  passId,
  code,
  storeName,
  channelLabel,
  grade,
  support,
  expiresAt,
  expiryLabel,
  reservation,
  receipt = false,
}: {
  passId: string;
  code: string;
  storeName: string;
  channelLabel: string;
  grade: string;
  // 영수증 리뷰(receipt)일 때는 지원금 정액이 아니라 할인 상한(기준 지원금 — P2)으로 쓰인다
  support: number;
  expiresAt: number;
  // 유효 기간 표기 (2026-07-23 시안) — 예약형 "0월 00일 (0)" / 그 외 날짜+12시간제
  expiryLabel?: string;
  // 예약 확정 체험권 (2026-07-23 시안) — 예약 정보 오렌지 카드 (신청 일정·인원)
  reservation?: { label: string; partySize?: number };
  // 영수증 리뷰 (2026-08-07 정정) — 혜택 = 결제 금액의 10% 할인 (정액 아님·결제 금액 입력 필수)
  receipt?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"qr" | "code">("qr");
  const [digits, setDigits] = useState("");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [netErr, setNetErr] = useState(false); // 네트워크 오류 — [다시 시도] 노출 조건
  const [done, setDone] = useState(false);
  const hiddenInput = useRef<HTMLInputElement | null>(null);

  // QR 실시간 동기화 (2026-08-11) — 사장님 스캐너가 사용 처리(use API)를 마치면
  // 체험자 화면이 이탈 없이 그대로 남던 문제: 3초 폴링(/api/passes/status)으로 감지해
  // 완료 안내(/r/passes/[id]/complete)로 자동 전환한다 (탭 백그라운드 중엔 스킵).
  useEffect(() => {
    if (done) return;
    let alive = true;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/passes/status?id=${encodeURIComponent(passId)}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (!alive || j.status === "active") return;
        setDone(true);
        router.replace(`/r/passes/${passId}/complete`);
      } catch {
        // 일시적 네트워크 오류 — 다음 폴링에서 재시도
      }
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [passId, done, router]);

  const paidNum = paid === "" ? null : Math.max(0, Number(paid) || 0);
  // 영수증 리뷰 = 결제액 × 10% (100원 반올림·기준 지원금 상한 — 서버 receiptSupportFor와 동일 산정)
  const applied =
    paidNum === null
      ? receipt
        ? 0
        : support
      : receipt
        ? receiptSupportFor(paidNum, support)
        : Math.min(paidNum, support);
  const customerPays = paidNum === null ? null : Math.max(0, paidNum - applied);

  async function submit() {
    if (digits.length !== 4) return;
    setBusy(true);
    setErr(null);
    setNetErr(false);
    try {
      const res = await fetch("/api/passes/use-by-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passId, code: digits, paidAmount: paid === "" ? undefined : Number(paid) }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        setErr(error || "사용 처리에 실패했습니다");
        setBusy(false);
        return;
      }
      setDone(true);
      // 완료 안내 화면으로 통일 (2026-08-11) — QR 폴링 감지 경로와 동일 목적지
      setTimeout(() => router.replace(`/r/passes/${passId}/complete`), 900);
    } catch {
      // 인증 성공 전에는 체험권 상태가 바뀌지 않으므로 같은 입력으로 재시도해도 안전하다.
      setErr("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
      setNetErr(true);
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pt-2">
      {/* 세그먼트 — QR 스캔 / 코드 입력 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("qr")}
          className={`cp-action h-11 rounded-md text-[14px] font-bold inline-flex items-center justify-center gap-1.5 ${
            tab === "qr" ? "bg-brand text-white" : "bg-canvas border border-hairline text-ink"
          }`}
          aria-pressed={tab === "qr"}
        >
          <span aria-hidden>▦</span> QR 스캔
        </button>
        <button
          type="button"
          onClick={() => setTab("code")}
          className={`cp-action h-11 rounded-md text-[14px] font-bold inline-flex items-center justify-center gap-1.5 ${
            tab === "code" ? "bg-brand text-white" : "bg-canvas border border-hairline text-ink"
          }`}
          aria-pressed={tab === "code"}
        >
          <span aria-hidden>T</span> 코드 입력
        </button>
      </div>

      {/* 요약 카드 (2026-07-23 시안) — 가게명(중앙)·채널/등급 · 지원금|유효 기간 2열 */}
      <div className="mt-3 rounded-lg bg-sunken px-4 pt-5 pb-4 text-center">
        <div className="text-[17px] font-bold text-ink tracking-title leading-[1.35] line-clamp-2">{storeName}</div>
        <div className="mt-1 text-[13px] text-muted">
          {channelLabel} · {grade}등급 적용
        </div>
        {/* '초대 보상 부스트 포함' 라벨 제거 (2026-07-17 지시) — 부스트 금액은 지원금 수치에만 반영 */}
        <div className="mt-4 pt-4 border-t border-hairline grid grid-cols-2">
          <div>
            <div className="text-[13px] text-muted">{receipt ? "할인 혜택" : "지원금"}</div>
            <div className="mt-1 text-[17px] font-bold text-brand tabular-nums">
              {receipt ? RECEIPT_DISCOUNT_LABEL : sbNum(SBUI.support, `${support.toLocaleString()}원`)}
            </div>
          </div>
          <div>
            <div className="text-[13px] text-muted">유효 기간</div>
            <div className="mt-1 text-[17px] font-bold text-brand tabular-nums">
              {sbNum(SBUI.dateTime, expiryLabel ?? "")}
            </div>
          </div>
        </div>
      </div>

      {/* 예약 정보 — 확정 예약 오렌지 카드 (2026-07-23 시안) */}
      {reservation && (
        <div className="mt-3 rounded-lg bg-warningSoft px-4 py-4">
          <div className="text-[14px] font-bold text-[#FF6B00]">🗓 예약 정보</div>
          <div className="mt-2.5 space-y-1.5 text-[14px]">
            <div className="flex gap-4">
              <span className="text-muted shrink-0">신청 일정</span>
              <span className="font-semibold text-ink tabular-nums">{sbNum(SBUI.dateTime, reservation.label)}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-muted shrink-0">신청 인원</span>
              <span className="font-semibold text-ink tabular-nums">{reservation.partySize ?? 1}명</span>
            </div>
          </div>
        </div>
      )}

      {/* 남은시간 pill — 발급 후 72h 카운트다운 (예약형은 유효 기간이 방문일 기준이라 미노출) */}
      {!reservation && (
        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-pill bg-brandSoft text-brand text-[13px] font-bold">
            <span aria-hidden>🕐</span> 남은시간
            <Countdown expiresAt={expiresAt} mode="hms" className="!text-[13px] !text-brand font-bold tabular-nums" />
          </span>
        </div>
      )}

      {done ? (
        <div className="mt-10 pb-10 text-center">
          <div className="text-[16px] font-bold text-successStrong">✓ 사용 처리 완료</div>
          <div className="mt-1.5 text-[13px] text-muted">잠시 후 완료 안내 화면으로 이동합니다…</div>
        </div>
      ) : tab === "qr" ? (
        /* ── QR 스캔 탭 — 금액 입력 없음 (사장님 스캐너에서 입력) ── */
        <div className="mt-6 pb-10 flex flex-col items-center">
          <div className="p-4 bg-canvas border border-hairline rounded-md">
            <QRView code={code} />
          </div>
          <p className="mt-5 text-[14px] text-ink font-medium">결제시 사장님께 보여주세요!</p>
          <button
            type="button"
            onClick={() => setTab("code")}
            className="cp-action mt-4 text-[13px] text-info"
          >
            QR이 인식되지않나요? <span className="font-semibold underline">코드 입력으로 진행</span>
          </button>
        </div>
      ) : (
        /* ── 코드 입력 탭 — 4자리 + 실 결제 금액(선택) → 사용처리 ── */
        <div className="mt-6 pb-10">
          {/* 4자리 입력 — 숨김 input + 시각 박스 4칸 */}
          <div
            className="flex justify-center gap-3"
            onClick={() => hiddenInput.current?.focus()}
            role="group"
            aria-label="매장 확인 번호 4자리"
          >
            {[0, 1, 2, 3].map((i) => {
              const filled = digits[i] ?? "";
              const isCurrent = digits.length === i;
              return (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-md border grid place-items-center text-[20px] font-bold tabular-nums bg-canvas ${
                    isCurrent ? "border-[1.5px] border-brand" : filled ? "border-hairline text-ink" : "border-hairline"
                  }`}
                >
                  {filled}
                </div>
              );
            })}
          </div>
          <input
            ref={hiddenInput}
            value={digits}
            onChange={(e) => {
              setDigits(e.target.value.replace(/\D/g, "").slice(0, 4));
              setErr(null);
              setNetErr(false);
            }}
            inputMode="numeric"
            autoFocus
            maxLength={4}
            aria-label="매장 확인 번호 4자리 입력"
            className="absolute opacity-0 w-px h-px"
          />
          <p className="mt-3 text-[13px] text-ink2 text-center">사장님, 매장 확인 번호 4자리를 입력해주세요!</p>

          {/* 실 결제 금액 (선택) */}
          <div className="mt-5">
            <div className="relative">
              <input
                value={paid}
                onChange={(e) => setPaid(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder={receipt ? "실 결제 금액 입력 (필수)" : "실 결제 금액 입력 (선택)"}
                aria-label={receipt ? "실 결제 금액 (필수)" : "실 결제 금액 (선택)"}
                className={`w-full h-12 pl-4 pr-10 rounded-md border focus:outline-none text-[15px] tabular-nums ${
                  paid ? "border-[1.5px] border-brand text-right font-semibold" : "border-hairline"
                }`}
              />
              {paid && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-muted">원</span>}
            </div>
            <div className="mt-1.5 rounded-sm bg-sunken py-2 text-center text-[12px] text-muted">
              {receipt ? "결제 금액의 10%가 할인돼요 — 금액을 입력해주세요." : "미입력시 지원금 한도 적용됩니다."}
            </div>
          </div>

          {/* 금액 입력 시 계산 표 — 적용 지원금(영수증 리뷰는 결제액의 10% 할인) / 실제 고객결제 */}
          {customerPays !== null && (
            <div className="mt-3 rounded-md bg-brandSoft px-4 py-3 space-y-1.5 text-[14px]">
              <div className="flex justify-between">
                <span className="text-ink2">{receipt ? `적용 할인 (${RECEIPT_DISCOUNT_LABEL})` : "적용 지원금"}</span>
                <span className="font-bold text-brand tabular-nums">
                  −{sbNum(SBUI.support, `${applied.toLocaleString()}원`)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink2">실제 고객결제</span>
                <span className="font-bold text-ink tabular-nums">
                  {sbNum(SBUI.price, `${customerPays.toLocaleString()}원`)}
                </span>
              </div>
            </div>
          )}

          {err && (
            <div className="mt-3 text-center">
              <div className="text-[13px] text-error">{err}</div>
              {netErr && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="cp-action mt-2 h-10 px-5 rounded-md border border-hairline bg-canvas text-[13px] font-semibold text-ink"
                >
                  다시 시도
                </button>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy || digits.length !== 4 || (receipt && !paidNum)}
            className="mt-4 w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
          >
            {busy ? "처리 중..." : "사용처리"}
          </button>

          {/* [2026-07-12 회의 §9-3] 고객센터·매장 직원 문의 안내 삭제 — 인증 중심 화면 단순화 */}
        </div>
      )}
    </div>
  );
}
