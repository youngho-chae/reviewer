"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MIN_WITHDRAWAL_POINTS,
  WITHDRAWAL_UNIT_POINTS,
  quoteWithdrawal,
  validateWithdrawalAmount,
} from "@/lib/points";
import { BANK_CODES } from "@/lib/bank-codes";
import { SBUI, sbNum } from "@/lib/storyboard";

/**
 * 출금 신청 폼 (2026-07-12 고도화 — KFTC 오픈뱅킹 계좌 본인 인증)
 *  1) 출금 포인트·은행·예금주·계좌번호 입력 → [본인 인증하기] 활성화
 *  2) 인증(계좌실명조회 — 예금주 대조) 완료 → 버튼이 [출금 요청]으로 전환
 *  3) 입력값을 바꾸면 인증이 무효화되어 다시 [본인 인증하기]로 복귀
 * 세금(사업소득 3.3%)·수수료 미리보기는 서버와 동일한 quoteWithdrawal 공유.
 * KFTC 키 미설정 환경은 데모 인증 모드(via:"demo") — 플로우는 동일.
 */
export default function WithdrawForm({
  balance,
  obConfigured = false,
  obTestbed = false,
}: {
  balance: number;
  obConfigured?: boolean;
  obTestbed?: boolean; // 테스트베드(시뮬레이터) 연결 여부 — 실계좌 조회 불가 안내용
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");
  const [birthday, setBirthday] = useState(""); // 실명 확인용 생년월일 6자리 (실키 모드)
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<{ via: "openbanking" | "demo"; holderName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const amountNum = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const amountErr = amountNum > 0 ? validateWithdrawalAmount(amountNum, balance) : null;
  const quote = useMemo(() => (amountNum > 0 && !amountErr ? quoteWithdrawal(amountNum) : null), [amountNum, amountErr]);

  // [본인 인증하기] 활성 조건 — 출금 포인트·은행·예금주·계좌번호 4종 입력 (+실키 모드는 생년월일)
  const fieldsFilled = !!quote && bank.trim() !== "" && account.trim() !== "" && holder.trim() !== "";
  const birthdayOk = !obConfigured || /^\d{6}$/.test(birthday);
  const canVerify = !verifying && !busy && fieldsFilled && birthdayOk;
  const canSubmit = !busy && !!verified && fieldsFilled;

  // 인증 후 계좌 정보를 수정하면 인증 무효 — 서버 증빙(쿠키)도 값 불일치로 거부된다
  function editField<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setVerified(null);
    };
  }

  async function verify() {
    if (!canVerify) return;
    setVerifying(true);
    setErr(null);
    const res = await fetch("/api/points/verify-account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bank, account: account.trim(), holder: holder.trim(), birthday }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || "계좌 인증에 실패했어요.");
      setVerifying(false);
      return;
    }
    setVerified({ via: data.via, holderName: data.holderName || holder.trim() });
    setVerifying(false);
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/points/withdraw", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: amountNum, bank, account: account.trim(), holder: holder.trim() }),
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
      {/* 테스트베드 안내 — KFTC 테스트베드는 시뮬레이터라 실계좌가 조회되지 않는다 (운영망 전환 시 자동 소멸) */}
      {obConfigured && obTestbed && (
        <div className="mb-3 rounded-sm bg-warningSoft px-3.5 py-2.5 text-[12px] leading-[1.55] text-ink2">
          <span className="font-bold text-warning">테스트베드 모드</span> — 지금은 KFTC 테스트베드(시뮬레이터)에 연결되어 있어{" "}
          <b>실제 계좌는 조회되지 않아요.</b> 개발자사이트의 테스트 데이터 관리에 등록한 계좌 조합으로 인증을 테스트할 수
          있고, 실계좌 인증은 운영망 전환 후 가능해요.
        </div>
      )}
      <div className="space-y-2">
        <input
          value={amount}
          onChange={(e) => editField(setAmount)(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder={`출금 포인트 (${WITHDRAWAL_UNIT_POINTS.toLocaleString()}P 단위)`}
          inputMode="numeric"
          disabled={disabled}
          className="w-full h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft tabular-nums disabled:bg-sunken"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={bank}
            onChange={(e) => editField(setBank)(e.target.value)}
            disabled={disabled}
            aria-label="은행 선택"
            className={`h-11 px-3 rounded-sm border border-hairline bg-canvas text-[14px] disabled:bg-sunken ${bank ? "text-ink" : "text-mutedSoft"}`}
          >
            <option value="">은행 선택</option>
            {BANK_CODES.map((b) => (
              <option key={b.code} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            value={holder}
            onChange={(e) => editField(setHolder)(e.target.value)}
            placeholder="예금주"
            disabled={disabled}
            className="h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft disabled:bg-sunken"
          />
        </div>
        <input
          value={account}
          onChange={(e) => editField(setAccount)(e.target.value.replace(/[^0-9-]/g, ""))}
          placeholder="계좌번호 ('-' 없이 입력 가능)"
          inputMode="numeric"
          disabled={disabled}
          className="w-full h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft tabular-nums disabled:bg-sunken"
        />
        {obConfigured && (
          <input
            value={birthday}
            onChange={(e) => editField(setBirthday)(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="생년월일 6자리 (계좌 실명 확인용)"
            inputMode="numeric"
            disabled={disabled}
            className="w-full h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft tabular-nums disabled:bg-sunken"
          />
        )}
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

      {/* 계좌 인증 완료 배지 — 인증 수단 구분 (오픈뱅킹 실명조회 / 데모) */}
      {verified && (
        <div className="mt-3 rounded-sm bg-successSoft px-3.5 py-2.5 flex items-center gap-2">
          <span aria-hidden>✅</span>
          <span className="text-[13px] font-semibold text-successStrong">
            계좌 본인 인증 완료 · 예금주 {verified.holderName}
          </span>
          <span
            className={`ml-auto shrink-0 inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold ${
              verified.via === "openbanking" ? "bg-canvas text-successStrong" : "bg-brandSoft text-brand"
            }`}
          >
            {verified.via === "openbanking" ? "오픈뱅킹 인증" : "데모 인증"}
          </span>
        </div>
      )}

      {err && <p className="mt-2 text-[12px] text-error">{err}</p>}

      {/* 2단계 버튼 — 미인증: [본인 인증하기] / 인증 완료: [출금 요청] */}
      {!verified ? (
        <button
          onClick={verify}
          disabled={!canVerify || disabled}
          className="cp-action mt-3 w-full h-11 rounded-sm border-[1.5px] border-brand bg-canvas text-brand text-[14px] font-bold disabled:border-hairline disabled:bg-sunken disabled:text-mutedSoft"
        >
          {verifying ? "계좌 확인 중..." : "본인 인증하기"}
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="cp-action mt-3 w-full h-11 rounded-sm bg-brand text-white text-[14px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
        >
          {busy ? "신청 중..." : "출금 요청"}
        </button>
      )}
      <p className="mt-2 text-[11px] text-muted leading-[1.5]">
        {obConfigured
          ? "오픈뱅킹 계좌실명조회로 본인 명의 계좌인지 확인한 뒤 출금을 신청할 수 있어요."
          : "본인 명의 계좌 인증 후 출금을 신청할 수 있어요. (데모 인증 모드 — 오픈뱅킹 키 설정 시 실명조회로 자동 전환)"}
      </p>
    </div>
  );
}
