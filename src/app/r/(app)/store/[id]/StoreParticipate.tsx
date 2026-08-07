"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grade, SnsKind } from "@/lib/types";
import {
  CHANNEL_ORDER,
  CHANNEL_LABEL,
  CHANNEL_REVIEW_CONDITIONS,
  CHANNEL_AD_NOTICE,
  RECEIPT_LABEL,
  RECEIPT_AD_NOTICE,
  RECEIPT_REVIEW_CONDITIONS,
} from "@/lib/channels";
import { SUPPORT_MULTIPLIER } from "@/lib/grade";
import { SBUI, sbNum } from "@/lib/storyboard";
import { fmtKoDateTime } from "@/lib/dates";
import { PASS_VALIDITY_MS } from "@/lib/pass-lifecycle";
import type { ReservationPicker } from "@/lib/reservation";
import ReserveSheet from "./ReserveSheet";

interface Props {
  campaignId: string;
  // 배송형(2026-07-12 레뷰 벤치마크) — 신청 시 배송지 입력, 혜택 = 제품(균일) + 포인트(등급 배율)
  kind?: "visit" | "delivery";
  base: number; // 기준 지원금 (S 등급 = 최대) / 배송형은 제공 상품 정가
  pointReward?: number; // 배송형 기준 포인트 (리뷰 검수 승인 시 등급 배율 적용 적립)
  requiredChannels: SnsKind[];
  myChannelGrades: Partial<Record<SnsKind, Grade>>;
  myActivePassId: string | null;
  remain: number;
  // 예약형 (2026-07-23 시안 — "언제 방문할까요?" 시트에서 캘린더·시간 칩·인원 선택)
  reservationRequired?: boolean;
  // 날짜/시간 선택지 — 서버가 스케줄·차단·시간대 정원 기준으로 계산 (§3-2·§7-1).
  // 예약 가능 시작일(opensAt)은 캘린더에서 이전 날짜만 비활성 — 신청 게이트가 아니다 (2026-07-23 정정).
  rsvPicker?: ReservationPicker;
  // 배송형 상품 옵션 (2026-07-16) — 설정 시 신청에서 택1 필수
  productOptions?: string[];
  ended?: boolean; // 캠페인 기간 종료 — 상세는 열람 가능하되 신청 차단 (관심 목록 경유)
  // 노출 상태 (campaign-visibility) — issued_out = 일시 소진 (미사용 만료 시 복구 가능 · 종료 아님)
  exposure?: "open" | "issued_out" | "closed";
  // 취소 후 12h 재신청 쿨다운 잔여 시간 — 서버(/api/passes)와 동일 판정을 CTA에 사전 반영
  cooldownLeftH?: number | null;
  // 게스트 브라우징 (2026-07-24) — 미로그인이면 금액 마스크 + CTA [로그인 하러가기]
  guest?: boolean;
  loginHref?: string; // /r/login?next=... (로그인 후 이 상세로 복귀)
  children?: ReactNode; // 라디오 섹션과 리뷰 조건 사이의 정적 섹션들 (서버 렌더)
}

function supportFor(base: number, g: Grade): number {
  return Math.round((base * SUPPORT_MULTIPLIER[g]) / 100) * 100;
}

/* 어느 SNS로 체험할까요? — radio-select-card + cta-bar (DESIGN.md v2)
   [P1] 등급은 참여 자격이 아님 — 채널 연동 여부만 선택 가능 조건이고, 등급은 금액만 바꾼다. */
export default function StoreParticipate({
  campaignId,
  kind = "visit",
  base,
  pointReward = 0,
  requiredChannels,
  myChannelGrades,
  myActivePassId,
  remain,
  reservationRequired = false,
  rsvPicker = { dates: [], slotsByDate: {} },
  productOptions = [],
  ended = false,
  exposure = "open",
  cooldownLeftH = null,
  guest = false,
  loginHref = "/r/login",
  children,
}: Props) {
  const router = useRouter();

  const ordered = useMemo(
    () => CHANNEL_ORDER.filter((c) => requiredChannels.includes(c)),
    [requiredChannels],
  );

  // 영수증 리뷰 (2026-08-07) — SNS 미연동(N)의 방문형 참여 경로. 배송형은 대상 아님.
  const receiptAvailable = kind !== "delivery";

  // Default = 연동된 채널 중 우선순위(블로그→인스타→틱톡) 첫 번째 — 없으면 영수증 리뷰(방문형)
  const initial = useMemo<SnsKind | "receipt" | null>(() => {
    return ordered.find((c) => !!myChannelGrades[c]) ?? (receiptAvailable ? "receipt" : null);
  }, [ordered, myChannelGrades, receiptAvailable]);

  const [selected, setSelected] = useState<SnsKind | "receipt" | null>(initial);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 배송형 — 신청 시 배송지 입력 (발송 목적 한정으로 사장님에게 노출 — 데이터정책서 §1.0b)
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [option, setOption] = useState(""); // 상품 옵션 (옵션 캠페인 택1 필수)

  const isDelivery = kind === "delivery";
  const isReserve = !isDelivery && reservationRequired;
  const isReceipt = selected === "receipt";
  // 영수증 리뷰 = N 등급 적용 (지원금 10%) — 채널 등급이 아니라 참여 방식의 등급
  const myGrade: Grade | undefined = isReceipt ? "N" : selected ? myChannelGrades[selected] : undefined;
  const connected = !!myGrade;
  const selectedSupport = connected ? supportFor(base, myGrade as Grade) : 0;
  // 배송형 적립 포인트 — 기준 포인트 × 등급 배율 (points.ts pointsForGrade와 동일 반올림)
  const selectedPoints = connected && pointReward > 0 ? supportFor(pointReward, myGrade as Grade) : 0;
  // [2026-07-12 회의 §10-3] 리뷰 조건에는 실제 작성 요건만 — 90일 유지(keep)는 유의사항으로 분리
  const conditions = isReceipt
    ? RECEIPT_REVIEW_CONDITIONS.filter((c) => !c.keep)
    : selected
      ? (CHANNEL_REVIEW_CONDITIONS[selected] ?? []).filter((c) => !c.keep)
      : [];
  const anyConnected = ordered.some((c) => !!myChannelGrades[c]);
  const adNotice = isReceipt ? RECEIPT_AD_NOTICE : selected ? CHANNEL_AD_NOTICE[selected] : "";
  const shippingValid =
    !isDelivery || (recipient.trim() && phone.trim() && address.trim() && (productOptions.length === 0 || !!option));

  async function copyNotice() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(adNotice);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function go(reservation?: { date: string; time: string; partySize: number }) {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/passes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId,
        channel: selected,
        ...(isDelivery
          ? {
              shipping: {
                recipient: recipient.trim(),
                phone: phone.trim(),
                address: address.trim(),
                ...(option ? { option } : {}),
              },
            }
          : {}),
        ...(reservation ? { reservation } : {}),
      }),
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
                  {/* 미연동 채널은 선택 불가 유지 — 채널 관리에서 본인 인증 연동 후 참여 (2026-07-10).
                      게스트는 로그인 후 이 상세로 복귀해 연동을 이어간다 (2026-07-24) */}
                  <Link href={guest ? loginHref : "/r/me/channels"} className="cp-action text-[12px] font-semibold text-brand shrink-0">
                    연동하기 →
                  </Link>
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
                  {isDelivery
                    ? pointReward > 0
                      ? sbNum(SBUI.point, `+${supportFor(pointReward, g).toLocaleString()}P`)
                      : "제품 제공"
                    : sbNum(SBUI.support, `${supportFor(base, g).toLocaleString()}원`)}
                </span>
              </button>
            );
          })}

          {/* 영수증 리뷰 (2026-08-07) — SNS 연동 없이 참여하는 N등급 경로 (방문형 전용, 지원금 10%).
              [P1] 미연동은 채널 선택이 불가할 뿐 참여 자체를 막지 않는다. */}
          {receiptAvailable && !guest && (
            <button
              type="button"
              onClick={() => setSelected("receipt")}
              aria-pressed={isReceipt}
              className={`w-full rounded-md px-4 py-3.5 flex items-center gap-3 bg-canvas text-left ${
                isReceipt ? "border-[1.5px] border-brand" : "border border-hairline"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full shrink-0 grid place-items-center ${
                  isReceipt ? "border-[6px] border-brand bg-canvas" : "border-[1.5px] border-borderStrong bg-canvas"
                }`}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-ink truncate">{RECEIPT_LABEL}</span>
                <span className="block text-[11px] text-muted mt-0.5">SNS 연동 없이 참여 · 영수증 리뷰 작성</span>
              </span>
              <span className="text-[16px] font-bold text-ink tabular-nums shrink-0">
                {sbNum(SBUI.support, `${supportFor(base, "N").toLocaleString()}원`)}
              </span>
            </button>
          )}
        </div>
        {/* [2026-07-07 회의] 타 등급 최대 지원금 비교·동기부여 문구는 노출하지 않는다 — 등급별 상이 사실만 안내 */}
        <p className="mt-2 text-[12px] text-muted">
          {isDelivery
            ? "체험 상품은 동일하게 제공돼요 · 포인트는 채널별 내 등급에 따라 달라지고 리뷰 검수 승인 후 적립돼요."
            : "지원금은 채널별 내 등급에 따라 달라져요 · 매장이 결제 시 직접 할인해 드리는 금액이에요. 영수증 리뷰는 SNS 연동 없이 참여할 수 있어요."}
        </p>
      </section>

      {/* 정적 섹션들 (필수 메뉴 · 키워드 · 소개 · 지도 · 이용 방법) */}
      {children}

      {/* 리뷰 작성 조건 — 선택 채널 기준.
          [2026-07-08] 광고 표시 문구 원문·복사 버튼과 세부 조건을 여기(작성 전)에 노출한다.
          작성 후 확인·수정하는 일이 없도록 사전 인지가 목적 — 리뷰 제출 화면은 자가 점검만 수행.
          조건 자체는 채널별 가변 데이터(CHANNEL_REVIEW_CONDITIONS)로 유지한다. */}
      <section className="px-5 mt-9">
        <h3 className="text-[18px] font-bold text-ink tracking-title">리뷰 작성 조건</h3>
        {selected ? (
          <>
            <p className="mt-1 text-[13px] text-muted">
              리뷰를 작성하기 <span className="font-semibold text-ink2">전에</span> 아래 조건을 미리 확인해주세요. 제출 화면에서는 자가 점검만 진행해요.
            </p>
            <div className="mt-3 rounded-md border border-hairline overflow-hidden">
              {conditions.map((cnd, i) => (
                <div
                  key={cnd.key}
                  className={`px-4 py-3.5 ${i < conditions.length - 1 ? "border-b border-hairlineSoft" : ""}`}
                >
                  <div className="text-[15px] font-semibold text-ink">{cnd.label}</div>
                  {cnd.hint && <div className="text-[12px] text-muted mt-0.5">{cnd.hint}</div>}
                </div>
              ))}
            </div>

            {/* 광고 표시 문구 — 게시물에 반드시 포함 (공정위 추천·보증 광고 안내) */}
            <div className="mt-3 rounded-md border border-brand bg-brandSoft p-4">
              <div className="text-[14px] font-semibold text-ink">광고 표시 문구 (필수 포함)</div>
              <div className="mt-2 p-3 bg-canvas rounded-sm text-[14px] text-ink leading-[1.5] break-keep">
                {adNotice}
              </div>
              <button
                type="button"
                onClick={copyNotice}
                className="cp-action mt-2.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-hairline bg-canvas text-[12px] font-semibold"
              >
                <span>📋</span>
                <span>{copied ? "복사됨" : "문구 복사"}</span>
              </button>
              <div className="text-[11px] text-ink2 mt-3 pt-3 border-t border-dashed border-hairline leading-[1.5]">
                공정거래위원회 추천·보증 광고 안내에 따라 경제적 이해관계는 명확히 표시되어야 합니다.
              </div>
            </div>
          </>
        ) : guest ? (
          <>
            {/* 게스트 — 채널 선택 전이라 필수 채널별 조건을 모두 공개 (2026-07-24 시안) */}
            <p className="mt-1 text-[13px] text-muted">
              리뷰를 작성하기 <span className="font-semibold text-ink2">전에</span> 아래 조건을 미리 확인해주세요. 제출 화면에서는 자가 점검만 진행해요.
            </p>
            {ordered.map((ch) => (
              <div key={ch} className="mt-3">
                {ordered.length > 1 && <div className="text-[13px] font-semibold text-ink2 mb-1.5">{CHANNEL_LABEL[ch]}</div>}
                <div className="rounded-md border border-hairline overflow-hidden">
                  {CHANNEL_REVIEW_CONDITIONS[ch].filter((cnd) => !cnd.keep).map((cnd, i, arr) => (
                    <div key={cnd.key} className={`px-4 py-3.5 ${i < arr.length - 1 ? "border-b border-hairlineSoft" : ""}`}>
                      <div className="text-[15px] font-semibold text-ink">{cnd.label}</div>
                      {cnd.hint && <div className="text-[12px] text-muted mt-0.5">{cnd.hint}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {ordered[0] && (
              <div className="mt-3 rounded-md border border-brand bg-brandSoft p-4">
                <div className="text-[14px] font-semibold text-ink">광고 표시 문구 (필수 포함)</div>
                <div className="mt-2 p-3 bg-canvas rounded-sm text-[14px] text-ink leading-[1.5] break-keep">
                  {CHANNEL_AD_NOTICE[ordered[0]]}
                </div>
                <div className="text-[11px] text-ink2 mt-3 pt-3 border-t border-dashed border-hairline leading-[1.5]">
                  공정거래위원회 추천·보증 광고 안내에 따라 경제적 이해관계는 명확히 표시되어야 합니다.
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-[14px] text-muted">채널을 연동하면 작성 조건이 표시돼요.</p>
        )}
      </section>

      {/* cta-bar — 하단 고정: 지원 금액 + 체험권 발급받기 */}
      <div className="fixed bottom-[var(--bottom-nav-h,72px)] left-0 right-0 mx-auto max-w-[480px] bg-canvas border-t border-hairlineSoft z-20">
        <div className="px-5 py-3 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-[12px] text-muted">{isDelivery ? "적립 포인트" : "지원 금액"}</div>
            <div className={`font-bold tabular-nums leading-tight ${guest ? "text-[14px] text-muted" : "text-[18px] text-ink"}`}>
              {guest
                ? "로그인 후 확인"
                : !connected
                ? "—"
                : isDelivery
                  ? pointReward > 0
                    ? sbNum(SBUI.point, `+${selectedPoints.toLocaleString()}P`)
                    : "제품 제공"
                  : sbNum(SBUI.support, `${selectedSupport.toLocaleString()}원`)}
            </div>
          </div>
          {/* CTA 우선순위 (2026-07-10 §1): [게스트 로그인 유도(2026-07-24 시안 — 최우선)] >
              종료 > 신청 완료 > 12h 쿨다운 > 일시 소진 > 채널 미연동 > 발급 */}
          {guest ? (
            <Link
              href={loginHref}
              className="cp-action flex-1 h-[52px] rounded-md bg-brand text-white grid place-items-center text-[16px] font-bold"
            >
              로그인 하러가기
            </Link>
          ) : ended || (remain <= 0 && exposure === "closed") ? (
            <button disabled className="flex-1 h-[52px] rounded-md bg-sunken text-mutedSoft text-[16px] font-bold">
              종료된 체험입니다
            </button>
          ) : myActivePassId ? (
            <Link
              href={`/r/passes/${myActivePassId}`}
              className="cp-action flex-1 h-[52px] rounded-md bg-brand text-white grid place-items-center text-[16px] font-bold"
            >
              내 체험권 보기
            </Link>
          ) : cooldownLeftH != null ? (
            <button disabled className="flex-1 h-[52px] rounded-md bg-sunken text-mutedSoft text-[15px] font-bold">
              12시간 후 재신청 가능 ({sbNum("약 00시간", `약 ${cooldownLeftH}시간`)} 남음)
            </button>
          ) : remain <= 0 ? (
            <button disabled className="flex-1 h-[52px] rounded-md bg-sunken text-mutedSoft text-[15px] font-bold">
              현재 신청 가능한 체험권이 없습니다
            </button>
          ) : !anyConnected && isDelivery ? (
            /* 배송형만 SNS 연동 필수 — 방문형은 영수증 리뷰(N 10%)로 미연동도 참여 가능 (2026-08-07) */
            <button disabled className="flex-1 h-[52px] rounded-md bg-sunken text-mutedSoft text-[16px] font-bold">
              SNS 연동 필요
            </button>
          ) : (
            <button
              onClick={() => setOpen(true)}
              disabled={!connected}
              className="cp-action flex-1 h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:bg-sunken disabled:text-mutedSoft"
            >
              {isDelivery ? "배송 체험 신청하기" : isReserve ? "예약 요청하기" : "체험권 발급받기"}
            </button>
          )}
        </div>
      </div>

      {/* 예약형 — "언제 방문할까요?" 시트 (2026-07-23 시안: 캘린더·시간 칩·인원 스테퍼) */}
      {open && selected && isReserve && (
        <ReserveSheet
          channelLabel={isReceipt ? RECEIPT_LABEL : CHANNEL_LABEL[selected as SnsKind]}
          gradeLabel={`${myGrade}등급`}
          supportText={sbNum(SBUI.support, `${selectedSupport.toLocaleString()}원`) as string}
          picker={rsvPicker}
          busy={busy}
          err={err}
          onClose={() => {
            setOpen(false);
            setErr(null);
          }}
          onSubmit={(date, time, partySize) => go({ date, time, partySize })}
        />
      )}

      {/* 참여 확인 모달 — 하단 시트 (방문형·배송형) */}
      {open && selected && !isReserve && (
        <div className="fixed inset-0 bg-ink/45 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-canvas w-full max-w-[480px] mx-auto rounded-t-xl p-6 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pb-3">
              <span className="w-9 h-1 rounded-pill bg-borderStrong" />
            </div>
            <h2 className="text-[20px] font-bold text-ink tracking-title text-center">
              {isDelivery ? "배송 체험을 신청할까요?" : "체험권을 발급받을까요?"}
            </h2>

            {/* 기한 카드 — 방문형: 발급 + 72h 결제 / 배송형: 발송 후 7일 리뷰 */}
            <div className="mt-5 rounded-md bg-brandSoft px-4 py-4 text-center">
              {isDelivery ? (
                <>
                  <div className="text-[13px] text-ink2">신청하면 사장님이 상품을 발송해요</div>
                  <div className="mt-1 text-[17px] font-bold text-brand">발송 후 7일 이내 리뷰 제출</div>
                  <div className="mt-1.5 text-[12px] text-muted">발송되면 알림으로 운송장을 알려드려요</div>
                </>
              ) : (
                <>
                  <div className="text-[13px] text-ink2">지금 발급하면</div>
                  <div className="mt-1 text-[17px] font-bold text-brand tabular-nums">
                    {sbNum(SBUI.dateTime, fmtKoDateTime(Date.now() + PASS_VALIDITY_MS))}까지 결제
                  </div>
                  <div className="mt-1.5 text-[12px] text-muted">발급 후 72시간 · 결제 전 QR을 제시해주세요</div>
                </>
              )}
            </div>

            <div className="mt-5 space-y-3 text-[15px]">
              <div className="flex justify-between">
                <span className="text-muted">{isReceipt ? "참여 방식" : "참여 채널"}</span>
                <span className="text-ink font-semibold">{isReceipt ? RECEIPT_LABEL : CHANNEL_LABEL[selected as SnsKind]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{isReceipt ? "적용 등급" : "채널 등급"}</span>
                <span className="text-ink font-semibold">{myGrade}등급</span>
              </div>
              {isDelivery ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted">제공 상품</span>
                    <span className="text-ink font-bold tabular-nums">{sbNum(SBUI.price, `${base.toLocaleString()}원 상당`)}</span>
                  </div>
                  {pointReward > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted">적립 포인트 (검수 승인 후)</span>
                      <span className="text-ink font-bold tabular-nums">{sbNum(SBUI.point, `+${selectedPoints.toLocaleString()}P`)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted">지원 금액</span>
                  <span className="text-ink font-bold tabular-nums">{sbNum(SBUI.support, `${selectedSupport.toLocaleString()}원`)}</span>
                </div>
              )}
            </div>

            {/* 배송지 입력 — 배송형 필수 (발송 목적 한정으로 사장님에게 노출) */}
            {isDelivery && (
              <div className="mt-5">
                <div className="text-[13px] font-bold text-ink">배송지 입력</div>
                <div className="mt-2 space-y-2">
                  {productOptions.length > 0 && (
                    <select
                      value={option}
                      onChange={(e) => setOption(e.target.value)}
                      aria-label="상품 옵션 선택"
                      className={`w-full h-11 px-3 rounded-sm border border-hairline bg-canvas text-[14px] ${option ? "text-ink" : "text-mutedSoft"}`}
                    >
                      <option value="">상품 옵션 선택 (필수)</option>
                      {productOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="수령인 이름"
                    className="w-full h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="연락처 (발송 안내용)"
                    inputMode="tel"
                    className="w-full h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft"
                  />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="주소 (상세주소 포함)"
                    className="w-full h-11 px-3.5 rounded-sm border border-hairline bg-canvas text-[14px] text-ink placeholder:text-mutedSoft"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted">배송지 정보는 상품 발송 목적으로만 사장님에게 전달돼요.</p>
              </div>
            )}

            {/* [2026-07-12 회의 §10-1] '꼭 확인해주세요' 반복 고지 삭제 — 발급 바텀시트는
                발급되는 체험권 핵심 정보만. 정책 안내는 상세 페이지 하단 유의사항으로 통합. */}

            {err && <p className="mt-3 text-[13px] text-error">{err}</p>}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="cp-action h-[52px] px-6 rounded-md bg-sunken text-[15px] font-semibold text-ink"
              >
                취소
              </button>
              <button
                onClick={() => go()}
                disabled={busy || !shippingValid}
                className="cp-action flex-1 h-[52px] rounded-md bg-brand text-white text-[16px] font-bold disabled:opacity-60"
              >
                {busy ? (isDelivery ? "신청 중..." : "발급 중...") : isDelivery ? "신청하고 체험권 보기" : "발급받고 체험권 보기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
