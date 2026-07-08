"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grade, SnsKind } from "@/lib/types";
import {
  CHANNEL_ORDER,
  CHANNEL_LABEL,
  CHANNEL_REVIEW_CONDITIONS,
} from "@/lib/channels";
import { SUPPORT_MULTIPLIER } from "@/lib/grade";
import { SBUI, sbNum } from "@/lib/storyboard";

interface Props {
  campaignId: string;
  base: number; // 기준 지원금 (S 등급 = 최대)
  requiredChannels: SnsKind[];
  myChannelGrades: Partial<Record<SnsKind, Grade>>;
  myActivePassId: string | null;
  remain: number;
  ended?: boolean; // 캠페인 기간 종료 — 상세는 열람 가능하되 신청 차단 (관심 목록 경유)
  children?: ReactNode; // 라디오 섹션과 리뷰 조건 사이의 정적 섹션들 (서버 렌더)
}

function supportFor(base: number, g: Grade): number {
  return Math.round((base * SUPPORT_MULTIPLIER[g]) / 100) * 100;
}

/* 어느 SNS로 체험할까요? — radio-select-card + cta-bar (DESIGN.md v2)
   [P1] 등급은 참여 자격이 아님 — 채널 연동 여부만 선택 가능 조건이고, 등급은 금액만 바꾼다. */
export default function StoreParticipate({
  campaignId,
  base,
  requiredChannels,
  myChannelGrades,
  myActivePassId,
  remain,
  ended = false,
  children,
}: Props) {
  const router = useRouter();

  const ordered = useMemo(
    () => CHANNEL_ORDER.filter((c) => requiredChannels.includes(c)),
    [requiredChannels],
  );

  // Default = 연동된 채널 중 우선순위(블로그→인스타→틱톡) 첫 번째
  const initial = useMemo(() => {
    return ordered.find((c) => !!myChannelGrades[c]) ?? null;
  }, [ordered, myChannelGrades]);

  const [selected, setSelected] = useState<SnsKind | null>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const myGrade: Grade | undefined = selected ? myChannelGrades[selected] : undefined;
  const connected = !!myGrade;
  const selectedSupport = connected ? supportFor(base, myGrade as Grade) : 0;
  const conditions = selected ? CHANNEL_REVIEW_CONDITIONS[selected] ?? [] : [];
  const anyConnected = ordered.some((c) => !!myChannelGrades[c]);

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
      {/* 채널 선택 — radio-select-card */}
      <section className="px-5 mt-9">
        <h3 className="text-[18px] font-bold text-ink tracking-title">어느 SNS로 체험할까요?</h3>
        <p className="mt-1 text-[13px] text-muted">채널을 선택하면 혜택과 리뷰 작성 조건이 달라져요.</p>
        <div className="mt-3 space-y-2.5">
          {ordered.map((ch) => {
            const g = myChannelGrades[ch];
            const isConnected = !!g;
            const isSel = ch === selected;
            if (!isConnected) {
              return (
                <div
                  key={ch}
                  className="rounded-md border border-hairlineSoft bg-parchment px-4 py-3.5 flex items-center gap-3"
                  aria-disabled
                >
                  <span className="w-5 h-5 rounded-full border-[1.5px] border-borderStrong bg-canvas shrink-0" />
                  <span className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-[15px] font-semibold text-mutedSoft truncate">{CHANNEL_LABEL[ch]}</span>
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-pill border border-hairline text-[11px] text-muted">연동 필요</span>
                  </span>
                  <span className="text-[14px] font-semibold text-mutedSoft shrink-0">확인불가</span>
                </div>
              );
            }
            return (
              <button
                key={ch}
                type="button"
                onClick={() => setSelected(ch)}
                aria-pressed={isSel}
                className={`w-full rounded-md px-4 py-3.5 flex items-center gap-3 bg-canvas text-left ${
                  isSel ? "border-[1.5px] border-brand" : "border border-hairline"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full shrink-0 grid place-items-center ${
                    isSel ? "border-[6px] border-brand bg-canvas" : "border-[1.5px] border-borderStrong bg-canvas"
                  }`}
                />
                <span className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-[15px] font-semibold text-ink truncate">
                    {CHANNEL_LABEL[ch]} · {g}등급
                  </span>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-pill border border-success text-[11px] font-semibold text-successStrong">
                    연동 완료
                  </span>
                </span>
                <span className="text-[16px] font-bold text-ink tabular-nums shrink-0">
                  {sbNum(SBUI.support, `${supportFor(base, g).toLocaleString()}원`)}
                </span>
              </button>
            );
          })}
        </div>
        {/* [2026-07-07 회의] 타 등급 최대 지원금 비교·동기부여 문구는 노출하지 않는다 — 등급별 상이 사실만 안내 */}
        <p className="mt-2 text-[12px] text-muted">지원금은 채널별 내 등급에 따라 달라져요 · 매장이 결제 시 직접 할인해 드리는 금액이에요.</p>
      </section>

      {/* 정적 섹션들 (필수 메뉴 · 키워드 · 소개 · 지도 · 이용 방법) */}
      {children}

      {/* 리뷰 작성 조건 — 선택 채널 기준.
          [2026-07-07 회의] 장문 세부 요구 대신 사진 수·글자 수 등 핵심 조건 중심으로 단순화.
          조건 자체는 채널별 가변 데이터(CHANNEL_REVIEW_CONDITIONS)로 유지한다. */}
      <section className="px-5 mt-9">
        <h3 className="text-[18px] font-bold text-ink tracking-title">리뷰 작성 조건</h3>
        {selected ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {conditions.map((cnd) => (
                <span key={cnd.key} className="px-3 py-1.5 rounded-pill bg-sunken text-[14px] text-ink2 font-medium">
                  {cnd.label}
                </span>
              ))}
              <span className="px-3 py-1.5 rounded-pill bg-errorSoft text-[14px] text-error font-semibold">
                광고 표시 문구 필수
              </span>
            </div>
            <p className="mt-2 text-[12px] text-muted">세부 조건은 리뷰 제출 화면에서 자가 점검으로 확인해요.</p>
          </>
        ) : (
          <p className="mt-3 text-[14px] text-muted">채널을 연동하면 작성 조건이 표시돼요.</p>
        )}
      </section>

      {/* cta-bar — 하단 고정: 지원 금액 + 체험권 발급받기 */}
      <div className="fixed bottom-[var(--bottom-nav-h,72px)] left-0 right-0 mx-auto max-w-[480px] bg-canvas border-t border-hairlineSoft z-20">
        <div className="px-5 py-3 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-[12px] text-muted">지원 금액</div>
            <div className="text-[18px] font-bold text-ink tabular-nums leading-tight">
              {connected ? sbNum(SBUI.support, `${selectedSupport.toLocaleString()}원`) : "—"}
            </div>
          </div>
          {ended ? (
            <button disabled className="flex-1 h-[52px] rounded-md bg-sunken text-mutedSoft text-[16px] font-bold">
              마감된 체험이에요
            </button>
          ) : myActivePassId ? (
            <Link
              href={`/r/passes/${myActivePassId}`}
              className="cp-action flex-1 h-[52px] rounded-md bg-brand text-white grid place-items-center text-[16px] font-bold"
            >
              내 체험권 보기
            </Link>
          ) : remain <= 0 ? (
            <button disabled className="flex-1 h-[52px] rounded-md bg-sunken text-mutedSoft text-[16px] font-bold">
              마감되었습니다
            </button>
          ) : !anyConnected ? (
            <button disabled className="flex-1 h-[52px] rounded-md bg-sunken text-mutedSoft text-[16px] font-bold">
              SNS 연동 필요
            </button>
          ) : (
            <button
              onClick={() => setOpen(true)}
              disabled={!connected}
              className="cp-action flex-1 h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
            >
              체험권 발급받기
            </button>
          )}
        </div>
      </div>

      {/* 참여 확인 모달 — 하단 시트 */}
      {open && selected && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl p-6 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pb-3">
              <span className="w-9 h-1 rounded-pill bg-borderStrong" />
            </div>
            <h2 className="text-[20px] font-bold text-ink tracking-title text-center">체험권을 발급받을까요?</h2>
            <p className="mt-2 text-[14px] text-muted text-center leading-[1.5]">
              발급 후 72시간 이내 매장 방문 시<br />결제 전 QR을 제시해주세요.
            </p>
            <div className="mt-6 space-y-3 text-[15px]">
              <div className="flex justify-between border-b border-hairlineSoft pb-3">
                <span className="text-muted">참여 채널</span>
                <span className="text-ink font-semibold">{CHANNEL_LABEL[selected]}</span>
              </div>
              <div className="flex justify-between border-b border-hairlineSoft pb-3">
                <span className="text-muted">내 {CHANNEL_LABEL[selected]} 등급</span>
                <span className="text-ink font-semibold">{myGrade}등급</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted">받을 지원금</span>
                <span className="text-ink font-bold tabular-nums">{sbNum(SBUI.support, `${selectedSupport.toLocaleString()}원`)}</span>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-muted leading-[1.5]">
              방문이 어려워지면 사용 전 언제든 취소할 수 있어요(같은 캠페인 재신청은 12시간 뒤부터).
              기한이 지난 체험권은 연장·복구되지 않아요. 리뷰는 이용 후 7일 이내 제출해야 해요.
            </p>
            {err && <p className="mt-3 text-[13px] text-error">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="cp-action h-[52px] px-5 rounded-md border border-hairline text-[15px] font-semibold text-ink"
              >
                취소
              </button>
              <button
                onClick={go}
                disabled={busy}
                className="cp-action flex-1 h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:opacity-60"
              >
                {busy ? "발급 중..." : "발급받고 체험권 보기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
