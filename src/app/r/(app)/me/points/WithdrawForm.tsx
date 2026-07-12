"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MIN_WITHDRAWAL_POINTS,
  WITHDRAWAL_UNIT_POINTS,
  quoteWithdrawal,
  validateWithdrawalAmount,
} from "@/lib/points";
import { SBUI, sbNum } from "@/lib/storyboard";

// 출금 신청 폼 — 세금(사업소득 3.3%)·수수료 미리보기는 서버와 동일한 quoteWithdrawal을 사용해
// 표시 값과 확정 값이 어긋나지 않게 한다 (2026-07-12 레뷰 벤치마크, 운영정책서 §14).
export default function WithdrawForm({ balance }: { balance: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const amountNum = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const amountErr = amountNum > 0 ? validateWithdrawalAmount(amountNum, balance) : null;
  const quote = useMemo(() => (amountNum > 0 && !amountErr ? quoteWithdrawal(amountNum) : null), [amountNum, amountErr]);
  const canSubmit = !busy && !!quote && bank.trim() && account.trim() && holder.trim();

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/points/withdraw", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: amountNum, bank: bank.trim(), account: account.trim(), holder: holder.trim() }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "출금 신청에 실패했어요.");
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-md bg-successSoft px-4 py-4">
        <div className="text-[14px] font-bold text-successStrong">출금 신청이 접수되었어요 ✅</div>
        <p className="mt-1 text-[12px] text-ink2 leading-[1.55]">
          운영팀 확인 후 영업일 기준 4~6일 내에 입금돼요. 진행 상태는 아래 출금 내역에서 확인할 수 있어요.
        </p>
      </div>
    );
  }

  const disabled = balance < MIN_WITHDRAWAL_POINTS;

  return (
    <div className="rounded-md border border-hairline p-4">
      {disabled && (
        <p className="mb-3 text-[12px] text-muted">
          보유 포인트가 {MIN_WITHDRAWAL_POINTS.toLocaleString()}P 이상이면 출금을 신청할 수 있어요.
        </p>
      )}
      <div className="space-y-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder={`출금 포인트 (${WITHDRAWAL_UNIT_POINTS.toLocaleString()}P 단위)`}
          inputMode="numeric"
          disabled={disabled}
          className="w-full h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft tabular-nums disabled:bg-sunken"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="은행"
            disabled={disabled}
            className="h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft disabled:bg-sunken"
          />
          <input
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="예금주"
            disabled={disabled}
            className="h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft disabled:bg-sunken"
          />
        </div>
        <input
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="계좌번호"
          inputMode="numeric"
          disabled={disabled}
          className="w-full h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft tabular-nums disabled:bg-sunken"
        />
      </div>

      {amountErr && <p className="mt-2 text-[12px] text-error">{amountErr}</p>}

      {/* 세금·수수료 미리보기 — 신청 전 실지급액 고지 */}
      {quote && (
        <div className="mt-3 rounded-sm bg-sunken px-3.5 py-3 space-y-1.5 text-[13px] tabular-nums">
          <div className="flex justify-between">
            <span className="text-muted">신청 포인트</span>
            <span className="text-ink font-semibold">{sbNum(SBUI.point, `${quote.amountPoints.toLocaleString()}P`)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">원천징수 세금 (3.3%)</span>
            <span className="text-ink">−{sbNum(SBUI.point, `${quote.taxWithheld.toLocaleString()}원`)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">이체 수수료</span>
            <span className="text-ink">−{sbNum(SBUI.point, `${quote.fee.toLocaleString()}원`)}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-hairline">
            <span className="text-ink font-bold">실지급액</span>
            <span className="text-brand font-bold">{sbNum(SBUI.support, `${quote.payout.toLocaleString()}원`)}</span>
          </div>
        </div>
      )}

      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="cp-action mt-3 w-full h-11 rounded-sm bg-brand text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
      >
        {busy ? "신청 중..." : "출금 신청하기"}
      </button>
    </div>
  );
}
