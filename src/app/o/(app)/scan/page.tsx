"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const Html5QrScanner = dynamic(() => import("./Html5QrScanner"), { ssr: false });

// 비-active 상태 안내 — raw status 대신 사장님 응대용 한글 문구 (2026-07-10).
const STATUS_LABEL: Record<string, string> = {
  active: "사용 가능",
  used: "사용 완료",
  review_submitted: "사용 완료 (리뷰 검수 중)",
  completed: "사용 완료 (체험 종료)",
  expired: "만료",
  cancelled: "취소",
  rejected: "사용 완료 (리뷰 반려)",
};
const STATUS_NOTE: Record<string, string> = {
  used: "이미 사용 처리된 체험권이에요. 중복으로 처리할 수 없어요.",
  review_submitted: "이미 사용 처리된 체험권이에요. 체험자가 리뷰 검수를 기다리고 있어요.",
  completed: "이미 사용 처리된 체험권이에요. 체험이 완료된 건이에요.",
  expired: "사용 기한(발급 후 72시간)이 지나 만료된 체험권이에요.",
  cancelled: "체험자가 직접 취소한 체험권이에요.",
  rejected: "이미 사용 처리된 체험권이에요. (리뷰 반려 상태)",
};

export default function ScanPage() {
  const router = useRouter();
  // 진입 즉시 카메라 시작 (2026-07-17 지시) — 사장님이 4자리를 입력하는 케이스는 없음
  // (매장 확인 번호 4자리는 체험자 화면의 '코드 입력' 탭에서 체험자가 입력하는 방식)
  const [scanning, setScanning] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [busy, setBusy] = useState(false);
  // 네트워크 오류 시 마지막 요청을 재실행하기 위한 참조 — [다시 시도] 버튼이 호출
  const retryRef = useRef<(() => void) | null>(null);
  const [retryable, setRetryable] = useState(false);

  async function lookup(c: string) {
    setErr(null);
    setResult(null);
    setRetryable(false);
    try {
      const res = await fetch("/api/passes/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: c.trim() }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        setErr(error || "조회 실패");
        return;
      }
      const data = await res.json();
      setResult(data);
    } catch {
      retryRef.current = () => lookup(c);
      setRetryable(true);
      setErr("네트워크 오류가 발생했어요. 연결을 확인하고 다시 시도해주세요.");
    }
  }

  async function useNow() {
    if (!result?.pass?.code) return;
    setBusy(true);
    setErr(null);
    setRetryable(false);
    try {
      const res = await fetch("/api/passes/use", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: result.pass.code, paidAmount: Number(paidAmount) || 0 }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        setErr(error || "처리 실패");
        setBusy(false);
        return;
      }
      setBusy(false);
      router.push("/o/home");
      router.refresh();
    } catch {
      // 인증이 성공하기 전에는 체험권 상태가 바뀌지 않으므로 재시도해도 안전하다.
      setBusy(false);
      retryRef.current = () => useNow();
      setRetryable(true);
      setErr("네트워크 오류가 발생했어요. 연결을 확인하고 다시 시도해주세요.");
    }
  }

  return (
    <div className="pb-24 bg-canvas">
      {/* top-app-bar — 52px 화이트 바 */}
      <div className="sticky top-0 z-30 bg-canvas">
        <div className="h-[52px] px-5 flex items-center">
          <h1 className="text-[18px] font-bold text-ink tracking-title">사용 처리</h1>
        </div>
      </div>
      <p className="px-5 pt-1 pb-4 text-[13px] text-muted leading-[1.5]">
        체험자의 체험권 QR을 스캔해 사용 처리하세요. 카메라가 어려우면 체험자 화면의 &apos;코드 입력&apos; 탭으로 진행할 수 있어요.
      </p>

      <div className="px-5">
        {/* 사장님 4자리 직접 입력 섹션 제거 (2026-07-17) — QR 스캔 단일 경로, 진입 즉시 카메라 */}
        {!scanning ? (
          <button onClick={() => setScanning(true)} className="w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold">
            📷 {result ? "다른 체험권 스캔하기" : "다시 스캔하기"}
          </button>
        ) : (
          <div className="rounded-md overflow-hidden border border-hairline">
            <Html5QrScanner
              onScan={(text) => {
                setScanning(false);
                lookup(text);
              }}
              onCancel={() => setScanning(false)}
            />
          </div>
        )}

        {err && (
          <div className="mt-4">
            <div className="text-error text-[14px]">{err}</div>
            {retryable && (
              <button
                onClick={() => retryRef.current?.()}
                className="mt-2 h-11 px-5 rounded-md border border-hairline bg-canvas text-[14px] font-semibold text-ink"
              >
                다시 시도
              </button>
            )}
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-lg border border-hairline bg-canvas p-4">
            <div className="text-[12px] text-muted">{result.campaign?.title}</div>
            {/* [2026-07-31 §4-5] 체험자 식별정보(익명 ID 포함) 비노출 — 체험권 번호(거래 단위)로 구분 */}
            <div className="mt-1 text-[18px] font-bold text-ink tracking-title tabular-nums">체험권 {result.passNo}</div>
            <div className="mt-2 text-[13px] text-muted">상태: {STATUS_LABEL[result.pass.status] ?? result.pass.status}</div>
            <div className="mt-1 text-[13px] text-ink2">지원금 한도: <span className="text-[14px] font-bold text-ink tabular-nums">{result.campaign?.supportAmount.toLocaleString()}원</span></div>

            {result.pass.status === "active" ? (
              <>
                <div className="mt-4">
                  <div className="text-[14px] font-semibold text-ink mb-2">실 결제 금액 입력</div>
                  <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" className="w-full h-12 px-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[16px] tabular-nums" />
                  <div className="mt-1 text-[12px] text-muted tabular-nums">
                    적용 지원금: {Math.min(Number(paidAmount) || 0, result.campaign?.supportAmount || 0).toLocaleString()}원
                  </div>
                </div>
                <button onClick={useNow} disabled={busy || !paidAmount} className="mt-4 w-full h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft">
                  {busy ? "처리 중..." : "사용 처리"}
                </button>
              </>
            ) : (
              <div className="mt-4 rounded-md bg-sunken px-3.5 py-3 text-[13px] text-muted leading-[1.5]">
                {STATUS_NOTE[result.pass.status] ?? "사용 처리할 수 없는 상태예요."}
              </div>
            )}
          </div>
        )}

        {/* [2026-07-12 회의 §9-3] 고객센터 문의 안내 삭제 */}
      </div>
    </div>
  );
}
