"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRView from "./QRView";
import Countdown from "./Countdown";
import { SBUI, sbNum } from "@/lib/storyboard";

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
  boosted,
}: {
  passId: string;
  code: string;
  storeName: string;
  channelLabel: string;
  grade: string;
  support: number;
  expiresAt: number;
  boosted: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"qr" | "code">("qr");
  const [digits, setDigits] = useState("");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const hiddenInput = useRef<HTMLInputElement | null>(null);

  const paidNum = paid === "" ? null : Math.max(0, Number(paid) || 0);
  const applied = paidNum === null ? support : Math.min(paidNum, support);
  const customerPays = paidNum === null ? null : Math.max(0, paidNum - applied);

  async function submit() {
    if (digits.length !== 4) return;
    setBusy(true);
    setErr(null);
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
      setTimeout(() => router.refresh(), 900);
    } catch {
      setErr("네트워크 오류가 발생했습니다");
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

      {/* 요약 카드 — 가게명 · 채널/등급 · 지원금 */}
      <div className="mt-3 rounded-md bg-sunken px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-ink truncate">{storeName}</div>
          <div className="text-[12px] text-muted mt-0.5 truncate">
            {channelLabel} · {grade}등급 적용
          </div>
          {boosted && <div className="text-[11px] text-brand font-semibold mt-0.5">🎁 초대 보상 부스트 포함</div>}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[17px] font-bold text-brand tabular-nums">{sbNum(SBUI.support, `${support.toLocaleString()}원`)}</span>{" "}
          <span className="text-[12px] text-muted">지원</span>
        </div>
      </div>

      {/* 남은시간 pill — 발급 후 72h 카운트다운 */}
      <div className="mt-4 flex justify-center">
        <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-pill bg-brandSoft text-brand text-[13px] font-bold">
          <span aria-hidden>🕐</span> 남은시간
          <Countdown expiresAt={expiresAt} mode="hms" className="!text-[13px] !text-brand font-bold tabular-nums" />
        </span>
      </div>

      {done ? (
        <div className="mt-10 pb-10 text-center">
          <div className="text-[16px] font-bold text-successStrong">✓ 사용 처리 완료</div>
          <div className="mt-1.5 text-[13px] text-muted">잠시 후 리뷰 작성 화면으로 이동합니다…</div>
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
                placeholder="실 결제 금액 입력 (선택)"
                aria-label="실 결제 금액 (선택)"
                className={`w-full h-12 pl-4 pr-10 rounded-md border focus:outline-none text-[15px] tabular-nums ${
                  paid ? "border-[1.5px] border-brand text-right font-semibold" : "border-hairline"
                }`}
              />
              {paid && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-muted">원</span>}
            </div>
            <div className="mt-1.5 rounded-sm bg-sunken py-2 text-center text-[12px] text-muted">
              미입력시 지원금 한도 적용됩니다.
            </div>
          </div>

          {/* 금액 입력 시 계산 표 — 적용 지원금 / 실제 고객결제 */}
          {customerPays !== null && (
            <div className="mt-3 rounded-md bg-brandSoft px-4 py-3 space-y-1.5 text-[14px]">
              <div className="flex justify-between">
                <span className="text-ink2">적용 지원금</span>
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

          {err && <div className="mt-3 text-[13px] text-error text-center">{err}</div>}

          <button
            onClick={submit}
            disabled={busy || digits.length !== 4}
            className="mt-4 w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
          >
            {busy ? "처리 중..." : "사용처리"}
          </button>
        </div>
      )}
    </div>
  );
}
