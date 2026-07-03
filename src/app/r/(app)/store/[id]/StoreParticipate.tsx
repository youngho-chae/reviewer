"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grade, SnsKind } from "@/lib/types";
import {
  CHANNEL_ORDER,
  CHANNEL_LABEL,
  CHANNEL_REVIEW_CONDITIONS,
  CHANNEL_BADGE_BG,
  CHANNEL_SHORT,
  defaultChannel,
} from "@/lib/channels";
import { gradeMeets, SUPPORT_MULTIPLIER } from "@/lib/grade";

interface Props {
  campaignId: string;
  base: number; // 기준 지원금 (S 등급 = 최대)
  minGrade: Grade; // 캠페인 최소 참여 등급
  requiredChannels: SnsKind[];
  myChannelGrades: Partial<Record<SnsKind, Grade>>;
  myActivePassId: string | null;
  remain: number;
}

function supportFor(base: number, g: Grade): number {
  return Math.round((base * SUPPORT_MULTIPLIER[g]) / 100) * 100;
}

export default function StoreParticipate({
  campaignId,
  base,
  minGrade,
  requiredChannels,
  myChannelGrades,
  myActivePassId,
  remain,
}: Props) {
  const router = useRouter();

  const ordered = useMemo(
    () => CHANNEL_ORDER.filter((c) => requiredChannels.includes(c)),
    [requiredChannels],
  );

  // 기본 선택 — 블로그 우선, 참여 가능한(연동+자격) 채널이 있으면 그 우선순위, 없으면 우선순위 첫 채널
  const initial = useMemo(() => {
    const eligibleFirst = ordered.find((c) => {
      const g = myChannelGrades[c];
      return g && gradeMeets(g, minGrade);
    });
    return eligibleFirst ?? defaultChannel(ordered) ?? ordered[0];
  }, [ordered, myChannelGrades, minGrade]);

  const [selected, setSelected] = useState<SnsKind>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const myGrade: Grade | undefined = myChannelGrades[selected];
  const connected = !!myGrade;
  const eligible = connected && gradeMeets(myGrade as Grade, minGrade);
  const selectedSupport = connected ? supportFor(base, myGrade as Grade) : 0;
  const conditions = CHANNEL_REVIEW_CONDITIONS[selected] ?? [];

  async function go() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/passes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId, channel: selected }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setErr(error || "참여 실패");
      setBusy(false);
      return;
    }
    const { passId } = await res.json();
    if (!passId) {
      setErr("발급에 실패했어요. 다시 시도해주세요.");
      setBusy(false);
      return;
    }
    router.push(`/r/passes?just_issued=${encodeURIComponent(passId)}`);
  }

  return (
    <>
      {/* 채널 선택 — 칩 */}
      <section className="bg-parchment py-12 px-6">
        <h3 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-3">참여 채널 선택</h3>
        <div className="flex flex-wrap gap-2">
          {ordered.map((ch) => {
            const g = myChannelGrades[ch];
            const able = !!g && gradeMeets(g, minGrade);
            const isSel = ch === selected;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => setSelected(ch)}
                className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-pill border text-[14px] ${
                  isSel ? "bg-ink text-white border-ink" : "bg-canvas text-ink border-hairline"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-[5px] text-[10px] font-bold ${CHANNEL_BADGE_BG[ch]}`}
                >
                  {CHANNEL_SHORT[ch]}
                </span>
                <span>{CHANNEL_LABEL[ch]}</span>
                {!able && <span className={`text-[10px] ${isSel ? "text-white/70" : "text-muted"}`}>🔒</span>}
              </button>
            );
          })}
        </div>

        {/* 선택 채널 — 내 등급 → 받을 수 있는 금액 자동 계산 */}
        <div className="mt-4 rounded-lg bg-canvas border border-hairline p-5">
          <div className="text-[13px] text-muted">{CHANNEL_LABEL[selected]}로 참여 시</div>
          {connected ? (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-[34px] leading-none text-ink">
                  ₩{selectedSupport.toLocaleString()}
                </span>
                <span className="text-[13px] text-muted">내 {myGrade}등급 기준</span>
              </div>
              {!eligible && (
                <div className="mt-2 text-[13px] text-error">
                  이 채널은 {minGrade}등급부터 참여할 수 있어요 (내 {myGrade}등급)
                </div>
              )}
              {eligible && base > selectedSupport && (
                <div className="mt-1.5 text-[12px] text-muted">
                  최대 ₩{base.toLocaleString()} (S등급) · 등급이 오르면 지원금도 올라가요
                </div>
              )}
              {eligible && (
                <div className="mt-1.5 text-[12px] text-muted">
                  지원금은 매장이 결제 시 직접 할인해 드리는 금액이에요.
                </div>
              )}
            </>
          ) : (
            <div className="mt-1 text-[15px] text-ink2 leading-[1.5]">
              아직 <span className="font-semibold">{CHANNEL_LABEL[selected]}</span>를 연동하지 않았어요.<br />
              <span className="text-[13px] text-muted">SNS 채널 추가·변경은 고객센터로 문의해주세요.</span>
            </div>
          )}
        </div>

        {/* 선택 채널에 맞는 리뷰 작성 조건 */}
        <div className="mt-5">
          <h4 className="text-[12px] tracking-[0.18em] text-muted uppercase mb-2">
            {CHANNEL_LABEL[selected]} 리뷰 작성 조건
          </h4>
          <ul className="space-y-1.5">
            {conditions.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-[14px] text-ink">
                <span className="text-brand mt-0.5">·</span>
                <span>
                  {c.label}
                  <span className="text-muted text-[12px]"> — {c.hint}</span>
                </span>
              </li>
            ))}
            <li className="flex items-start gap-2 text-[14px] text-ink">
              <span className="text-brand mt-0.5">·</span>
              <span>광고 표시 문구 자동 삽입 (필수)</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Sticky CTA — 최종 선택 채널 + 금액 + 참여하기 */}
      <div className="fixed bottom-[var(--bottom-nav-h,72px)] left-0 right-0 mx-auto max-w-[480px] frosted-parchment border-t border-hairline z-20">
        <div className="px-6 pt-2.5 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-muted">
              {CHANNEL_LABEL[selected]} · 내 {connected ? `${myGrade}등급` : "미연동"}
            </span>
            <span className="text-[15px] font-semibold text-ink">
              {connected ? `₩${selectedSupport.toLocaleString()}` : "—"}
            </span>
          </div>
          {myActivePassId ? (
            <Link
              href={`/r/passes/${myActivePassId}`}
              className="cp-action block h-11 rounded-pill bg-brand text-white grid place-items-center text-[17px]"
            >
              내 체험권 보기 →
            </Link>
          ) : remain <= 0 ? (
            <button disabled className="w-full h-11 rounded-pill bg-parchment text-muted text-[17px] border border-hairline">
              마감되었습니다
            </button>
          ) : !connected ? (
            <button disabled className="w-full h-11 rounded-pill bg-parchment text-muted text-[17px] border border-hairline">
              {CHANNEL_LABEL[selected]} 미연동
            </button>
          ) : !eligible ? (
            <button disabled className="w-full h-11 rounded-pill bg-parchment text-muted text-[17px] border border-hairline">
              {minGrade}등급부터 참여 가능
            </button>
          ) : (
            <button onClick={() => setOpen(true)} className="w-full h-11 rounded-pill bg-brand text-white text-[17px]">
              참여하기
            </button>
          )}
        </div>
      </div>

      {/* 참여 확인 모달 */}
      {open && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-lg p-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-[28px] leading-[1.14] text-ink text-center">참여 신청 확인</h2>
            <p className="mt-3 text-[15px] text-ink2 text-center leading-[1.47]">
              발급 후 24시간 이내 매장 방문 시<br />결제 전 QR을 제시해주세요.
            </p>
            <div className="mt-7 space-y-3 text-[15px]">
              <div className="flex justify-between border-b border-hairline pb-3">
                <span className="text-muted">참여 채널</span>
                <span className="text-ink">{CHANNEL_LABEL[selected]}</span>
              </div>
              <div className="flex justify-between border-b border-hairline pb-3">
                <span className="text-muted">내 {CHANNEL_LABEL[selected]} 등급</span>
                <span className="text-ink">{myGrade}등급</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">받을 지원금</span>
                <span className="text-ink font-semibold">₩{selectedSupport.toLocaleString()}</span>
              </div>
            </div>
            <p className="mt-4 text-[12px] text-muted leading-[1.5] text-center">
              방문이 어려워지면 사용 전 언제든 취소할 수 있어요.<br />
              리뷰는 사용 후 72시간 이내 제출해야 해요.
            </p>
            {err && <div className="mt-4 text-error text-[13px]">{err}</div>}
            <div className="mt-7 space-y-3">
              <button onClick={go} disabled={busy} className="w-full h-11 rounded-pill bg-brand text-white text-[17px] disabled:opacity-50">
                {busy ? "발급 중..." : "발급받고 체험권 보기"}
              </button>
              <button onClick={() => setOpen(false)} className="w-full h-11 text-brand text-[15px]">취소</button>
            </div>
          </div>
        </div>
      )}
      {err && !open && <div className="fixed bottom-32 left-0 right-0 text-center text-error text-[13px] z-30">{err}</div>}
    </>
  );
}
