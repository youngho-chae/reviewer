"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const Html5QrScanner = dynamic(() => import("./Html5QrScanner"), { ssr: false });

export default function ScanPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup(c: string) {
    setErr(null); setResult(null);
    const res = await fetch("/api/passes/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: c.trim() }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErr(error || "조회 실패");
      return;
    }
    const data = await res.json();
    setResult(data);
  }

  async function useNow() {
    if (!result?.pass?.code) return;
    setBusy(true); setErr(null);
    const res = await fetch("/api/passes/use", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: result.pass.code, paidAmount: Number(paidAmount) || 0 }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      setErr(error || "처리 실패");
      setBusy(false);
      return;
    }
    setBusy(false);
    router.push("/o/home");
    router.refresh();
  }

  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-[22px] font-bold">사용 처리</h1>
        <p className="text-[13px] text-muted mt-1">체험자의 QR을 스캔하거나, 체험권 화면에 표시된 숫자 4자리를 직접 입력하세요.</p>
      </div>

      <div className="px-5">
        {!scanning ? (
          <button onClick={() => setScanning(true)} className="w-full h-12 rounded-sm bg-ink text-white text-[15px] font-medium">📷 카메라로 스캔하기</button>
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

        <div className="mt-4">
          <div className="text-[13px] text-muted mb-2">또는 체험권 화면의 숫자 4자리 직접 입력</div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="예) 1234"
              inputMode="numeric"
              maxLength={4}
              className="flex-1 h-12 px-3 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[20px] font-semibold tracking-[0.4em] text-center"
            />
            <button onClick={() => lookup(code)} disabled={code.length !== 4} className="h-12 px-4 rounded-sm bg-ink text-white text-[14px] font-medium disabled:opacity-40">조회</button>
          </div>
        </div>

        {err && <div className="mt-4 text-error text-[14px]">{err}</div>}

        {result && (
          <div className="mt-6 rounded-md border border-hairline p-4">
            <div className="text-[12px] text-muted">{result.campaign?.title}</div>
            <div className="mt-1 text-[18px] font-bold">{result.reviewer?.nickname} <span className="text-[14px] text-muted">({result.reviewer?.grade}등급)</span></div>
            <div className="mt-2 text-[13px] text-muted">상태: {result.pass.status}</div>
            <div className="mt-1 text-[13px]">지원금 한도: ₩{result.campaign?.supportAmount.toLocaleString()}</div>

            {result.pass.status === "active" ? (
              <>
                <div className="mt-4">
                  <div className="text-[13px] text-muted mb-2">실 결제 금액 입력</div>
                  <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0" className="w-full h-12 px-3 rounded-sm border border-hairline focus:border-ink focus:outline-none text-[16px]" />
                  <div className="mt-1 text-[12px] text-muted">
                    적용 지원금: ₩{Math.min(Number(paidAmount) || 0, result.campaign?.supportAmount || 0).toLocaleString()}
                  </div>
                </div>
                <button onClick={useNow} disabled={busy || !paidAmount} className="mt-4 w-full h-12 rounded-sm bg-brand text-white text-[15px] font-medium disabled:opacity-50">
                  {busy ? "처리 중..." : "사용 처리"}
                </button>
              </>
            ) : (
              <div className="mt-4 text-[13px] text-muted">사용 처리할 수 없는 상태입니다.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
