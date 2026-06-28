"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  passId: string;
  supportAmount: number;
}

/**
 * 체험권 화면에서 사장님이 직접 사용 처리하는 입력 폼.
 * 캠페인 4자리 코드를 화면에 노출하지 않고, 사장님이 직접 입력해야 사용 완료된다.
 */
export default function OwnerUseForm({ passId, supportAmount }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (code.length !== 4) {
      setErr("사용처리 코드 4자리를 입력해주세요");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/passes/use-by-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passId, code, paidAmount: paid === "" ? undefined : Number(paid) }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        setErr(error || "사용 처리에 실패했습니다");
        setBusy(false);
        return;
      }
      setDone(true);
      // 사용 완료 → 리뷰 작성(used 상태) 화면으로 갱신
      setTimeout(() => {
        router.refresh();
      }, 900);
    } catch {
      setErr("네트워크 오류가 발생했습니다");
      setBusy(false);
    }
  }

  const appliedPreview = paid === ""
    ? supportAmount
    : Math.min(Math.max(0, Number(paid) || 0), supportAmount);

  if (done) {
    return (
      <div className="mt-7 w-full pt-6 border-t border-dashed border-hairline text-center">
        <div className="text-[15px] font-semibold text-brand">✓ 사용 처리 완료</div>
        <div className="mt-1 text-[12px] text-muted">잠시 후 리뷰 작성 화면으로 이동합니다…</div>
      </div>
    );
  }

  return (
    <div className="mt-7 w-full pt-6 border-t border-dashed border-hairline">
      <div className="text-[11px] text-muted tracking-[0.18em] uppercase text-center">
        사장님 사용 처리
      </div>
      <p className="mt-1.5 text-[12px] text-muted text-center leading-[1.5]">
        사장님이 지정한 숫자 4자리를 입력하면 사용 완료됩니다
      </p>

      <input
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(null); }}
        inputMode="numeric"
        placeholder="0000"
        maxLength={4}
        aria-label="사용처리 코드 4자리"
        className="mt-3 w-full h-14 rounded-md border border-hairline focus:border-brand focus:outline-none text-[28px] font-semibold tracking-[0.5em] text-center"
      />

      <div className="mt-3">
        <div className="text-[11px] text-muted mb-1">실 결제 금액 (선택 · 미입력 시 지원금 한도 적용)</div>
        <div className="relative">
          <input
            value={paid}
            onChange={(e) => setPaid(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder={supportAmount.toLocaleString()}
            className="w-full h-11 pl-7 pr-3 rounded-md border border-hairline focus:border-brand focus:outline-none text-[15px]"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted">₩</span>
        </div>
        <div className="mt-1 text-[11px] text-muted">
          적용 지원금: ₩{appliedPreview.toLocaleString()}
        </div>
      </div>

      {err && <div className="mt-2 text-[12px] text-error text-center">{err}</div>}

      <button
        onClick={submit}
        disabled={busy || code.length !== 4}
        className="mt-3 w-full h-12 rounded-pill bg-brand text-white text-[15px] font-semibold disabled:opacity-50"
      >
        {busy ? "처리 중..." : "사용 처리"}
      </button>
    </div>
  );
}
