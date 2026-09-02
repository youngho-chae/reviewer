import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { passRefNo } from "@/lib/owner-review-status";
import { rid, passCode } from "@/lib/ids";
import { readSession } from "@/lib/auth";
import { Pass, PassReservation, Grade, SnsKind, ShippingInfo } from "@/lib/types";
import { CHANNEL_LABEL } from "@/lib/channels";
import { PASS_VALIDITY_MS, CANCEL_REAPPLY_COOLDOWN_MS } from "@/lib/pass-lifecycle";
import { validateReservationForCampaign, reservationDayEnd, fmtReservationLabel } from "@/lib/reservation";
import { DELIVERY_ENABLED } from "@/lib/flags";
import { appendRecentPass } from "@/lib/recent-passes-cookie";
import { effectiveChannelState } from "@/lib/sns-cookie";

// 동시 보유 가능한 체험권(사용 전 active) 최대 수 — 2026-07-07 회의 확정
const MAX_ACTIVE_PASSES = 5;
// 취소 후 동일 캠페인 재신청 제한(12h)은 매장 상세 CTA와 공유 — src/lib/pass-lifecycle.ts

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { campaignId, channel, shipping, reservation } = await req.json();
  const db = await getDBAsync();
  const me = db.reviewers.find((r) => r.id === s.userId);
  const c = db.campaigns.find((x) => x.id === campaignId);
  if (!me || !c) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  // 참여 채널 / 자격 등급 결정 — 방문형(visit)은 참여 시점에 채널 확정.
  // 선택 채널의 내 등급으로 자격·지원금 결정.
  // 배송형(2026-07-12 레뷰 벤치마크) — 신청 시 배송지 필수, 발송 처리 후 리뷰 7일
  const isDelivery = c.kind === "delivery";
  if (isDelivery && !DELIVERY_ENABLED) {
    return NextResponse.json({ error: "배송형 캠페인은 준비 중입니다" }, { status: 403 });
  }
  let shippingInfo: ShippingInfo | undefined;
  if (isDelivery) {
    const sh = shipping as Partial<ShippingInfo> | undefined;
    const recipient = String(sh?.recipient || "").trim().slice(0, 30);
    const phone = String(sh?.phone || "").trim().slice(0, 20);
    const address = String(sh?.address || "").trim().slice(0, 120);
    if (!recipient || !phone || !address) {
      return NextResponse.json({ error: "배송지 정보(수령인·연락처·주소)를 입력해주세요" }, { status: 400 });
    }
    shippingInfo = { recipient, phone, address };
    // 상품 옵션 (2026-07-16 리뷰노트 벤치마크) — 옵션 캠페인은 택1 필수 (목록에 있는 값만)
    if (c.productOptions && c.productOptions.length > 0) {
      const option = String(sh?.option || "").trim();
      if (!c.productOptions.includes(option)) {
        return NextResponse.json({ error: "상품 옵션을 선택해주세요" }, { status: 400 });
      }
      shippingInfo.option = option;
    }
  }
  // 예약형 방문 (2026-07-16 리뷰노트 벤치마크) — 신청 시 희망 방문 일시 필수.
  // 예약은 선정이 아니라 일정 조율(P1) — 발급은 즉시, 사장님은 확인만 한다.
  let reservationInfo: PassReservation | undefined;
  if (!isDelivery && c.reservationRequired) {
    const rd = String(reservation?.date || "");
    const rt = String(reservation?.time || "");
    // 종합 검증 (2026-07-22 §3-2) — 오픈일·요일·브레이크·차단·시간대 정원·과거·종료일
    const rerr = validateReservationForCampaign(c, db.passes, c.id, rd, rt);
    if (rerr) return NextResponse.json({ error: rerr }, { status: 400 });
    // 방문 인원수 필수 (2026-07-17 회의) — 사장님이 예약 큐에서 확인
    const partySize = Math.floor(Number(reservation?.partySize) || 0);
    if (partySize < 1 || partySize > 10) {
      return NextResponse.json({ error: "방문 인원수를 선택해주세요 (1~10명)" }, { status: 400 });
    }
    const at = Date.now();
    reservationInfo = {
      date: rd,
      time: rt,
      partySize,
      status: "requested",
      requestedAt: at,
      // 협상 히스토리 시작 (v3) — 이후 제안/재제안/확정/거절이 append 된다
      history: [{ at, by: "reviewer", kind: "request", date: rd, time: rt }],
    };
  }
  // 영수증 리뷰 참여 (2026-08-07) — SNS 미연동(N)의 방문형 참여 경로: 채널 없이 참여하고
  // 매장 영수증 리뷰를 작성한다. 지원금 = N 배율(10%). 배송형은 영수증 개념이 없어 대상 제외.
  const isReceipt = channel === "receipt";
  if (isReceipt && isDelivery) {
    return NextResponse.json({ error: "배송형 체험은 SNS 채널 연동 후 참여할 수 있어요" }, { status: 400 });
  }
  let selectedChannel: SnsKind | undefined;
  let channelGrade: Grade;
  if (isReceipt) {
    channelGrade = "N";
  } else {
    selectedChannel = channel as SnsKind | undefined;
    // 인스턴스 불일치 스톱갭 — 연동 직후 다른 인스턴스에서도 최신 연동 상태로 참여 판정 (sns-cookie.ts)
    const eff = await effectiveChannelState(me);
    if (!selectedChannel || !c.requiredChannels.includes(selectedChannel)) {
      return NextResponse.json({ error: "참여할 채널을 선택해주세요" }, { status: 400 });
    }
    const g: Grade | undefined = eff.channelGrades[selectedChannel];
    if (!g) {
      return NextResponse.json({ error: "선택한 채널이 연동되어 있지 않습니다" }, { status: 403 });
    }
    channelGrade = g;
  }

  // 기간 종료 캠페인 — 상세는 열람 가능(관심 목록 경유)하지만 발급은 차단
  if (c.endAt <= Date.now()) return NextResponse.json({ error: "마감된 체험입니다" }, { status: 400 });

  // 영수증 리뷰(N) 참여는 모집 인원을 차감하지 않는다 (2026-08-07) — 캠페인이 열려 있는
  // 동안(종료 전)은 슬롯 소진과 무관하게 모집. 소진 게이트는 SNS 채널 참여에만 적용.
  if (!isReceipt) {
    const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
    const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
    if (totalQ - usedQ <= 0) return NextResponse.json({ error: "마감되었습니다" }, { status: 400 });
  }

  // 동시 보유 제한 — 사용 전(active) 체험권은 최대 5장 (2026-07-07 회의 확정)
  const activeCount = db.passes.filter((p) => p.reviewerId === me.id && p.status === "active").length;
  if (activeCount >= MAX_ACTIVE_PASSES) {
    return NextResponse.json(
      { error: `체험권은 동시에 ${MAX_ACTIVE_PASSES}장까지 보유할 수 있어요. 보유한 체험권을 사용하거나 취소한 뒤 발급받아주세요.` },
      { status: 400 },
    );
  }

  // 취소 후 동일 캠페인 재신청 제한 12시간 — 장기 점유 후 취소·재발급 악용 방지.
  // cancelledVia가 있는 취소(제안 거절·사장님 거절/취소·운영자 취소·무응답 자동 취소)는
  // 체험자 귀책이 아니므로 제한하지 않는다 — 즉시 재신청 가능 (2026-07-22 §5-1·§5-3).
  const now0 = Date.now();
  const recentCancel = db.passes.find(
    (p) =>
      p.reviewerId === me.id &&
      p.campaignId === c.id &&
      p.status === "cancelled" &&
      !p.cancelledVia &&
      typeof p.cancelledAt === "number" &&
      now0 - p.cancelledAt < CANCEL_REAPPLY_COOLDOWN_MS,
  );
  if (recentCancel) {
    const leftH = Math.max(1, Math.ceil((CANCEL_REAPPLY_COOLDOWN_MS - (now0 - (recentCancel.cancelledAt as number))) / 3600000));
    return NextResponse.json(
      { error: `취소한 캠페인은 12시간 뒤에 다시 신청할 수 있어요. (약 ${leftH}시간 남음)` },
      { status: 400 },
    );
  }

  // 이미 활성 패스 있으면 중복 발급 금지
  const dup = db.passes.find((p) => p.reviewerId === me.id && p.campaignId === c.id && ["active", "used", "review_submitted"].includes(p.status));
  if (dup) {
    const dupStore = db.stores.find((s) => s.id === dup.storeId);
    if (dupStore) {
      await appendRecentPass({
        pass: dup,
        campaign: {
          id: c.id, title: c.title, kind: c.kind, supportAmount: c.supportAmount,
          requiredChannels: c.requiredChannels, description: c.description,
        },
        store: {
          id: dupStore.id, name: dupStore.name, area: dupStore.area, category: dupStore.category,
          coverEmoji: dupStore.coverEmoji, lat: dupStore.lat, lng: dupStore.lng,
          naverPlaceId: dupStore.naverPlaceId, address: dupStore.address, hours: dupStore.hours,
          rating: dupStore.rating, reviewCount: dupStore.reviewCount, ownerId: dupStore.ownerId,
        },
      });
    }
    return NextResponse.json({ passId: dup.id });
  }

  // [정책 원칙 P1] 등급은 참여 자격이 아니다 — 모든 등급이 모든 캠페인에 참여할 수 있으며,
  // 등급은 지원금 배율(혜택 크기)만 결정한다. 자격 조건은 ①진행 중 ②채널 연동 ③잔여 슬롯뿐.

  // 등급별 quota 차감 — 버킷은 참여 자격이 아니라 배분 기록용.
  // 자기 등급 버킷 우선 소진, 소진 시 잔여 버킷(하위→상위 순) 사용.
  // 영수증 리뷰(N) 참여는 차감하지 않는다 (2026-08-07 — consumedSlot 없음·복구 대상 아님).
  let consumedSlot: "S" | "A" | "B" | "C" | null = null;
  if (!isReceipt) {
    const order: Array<"S" | "A" | "B" | "C"> = ["S", "A", "B", "C"];
    const fromIdx = order.indexOf(channelGrade === "N" ? "C" : (channelGrade as any));
    for (let i = order.length - 1; i >= fromIdx; i--) {
      const g = order[i];
      if (c.used[g] < c.quota[g]) { c.used[g] += 1; consumedSlot = g; break; }
    }
    if (!consumedSlot) {
      // 상위 슬롯도 시도
      for (let i = fromIdx - 1; i >= 0; i--) {
        const g = order[i];
        if (c.used[g] < c.quota[g]) { c.used[g] += 1; consumedSlot = g; break; }
      }
    }
    if (!consumedSlot) return NextResponse.json({ error: "마감되었습니다" }, { status: 400 });
  }

  const now = Date.now();
  const pass: Pass = {
    id: rid("ps"),
    code: passCode(),
    reviewerId: me.id,
    campaignId: c.id,
    storeId: c.storeId,
    ownerId: db.stores.find((s) => s.id === c.storeId)!.ownerId,
    reviewerGrade: channelGrade,
    ...(consumedSlot ? { consumedSlot } : {}), // 만료/취소 시 이 슬롯을 복구 (영수증 참여는 미차감·없음)
    ...(isReceipt ? { receiptReview: true } : { reviewChannel: selectedChannel }),
    issuedAt: now,
    // 방문형은 발급 후 72시간 사용 기한(연장·복구 없음).
    // 배송형은 캠페인 종료까지 발송 대기(발송 후 리뷰 7일).
    // 예약형 방문은 예약일 당일 말(KST)까지 — 72h 고정 기한의 명시적 예외 (운영정책서 §15).
    expiresAt: isDelivery
      ? c.endAt
      : reservationInfo
        ? reservationDayEnd(reservationInfo.date)
        : now + PASS_VALIDITY_MS,
    ...(shippingInfo ? { shipping: shippingInfo } : {}),
    ...(reservationInfo ? { reservation: reservationInfo } : {}),
    status: "active",
  };
  db.passes.push(pass);
  // 사장님 알림
  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: isDelivery ? "배송형 신청 (발송 대기)" : reservationInfo ? "예약 방문 신청" : "체험권 발급",
    // [2026-07-31 §4-5] 체험자 식별정보(익명 ID 포함) 비노출 — 체험권 번호로 구분
    // (배송형 수령인 정보는 알림이 아니라 발송 처리 화면에서만 — 목적 제한 노출)
    body: `새 체험자가 캠페인에 참여했습니다 (체험권 ${passRefNo(pass.id)})${selectedChannel ? ` (${CHANNEL_LABEL[selectedChannel]})` : isReceipt ? " (영수증 리뷰)" : ""}.${
      isDelivery
        ? " 발송 처리를 진행해주세요."
        : reservationInfo
          ? ` ${fmtReservationLabel(reservationInfo.date, reservationInfo.time)} 방문 희망 — 예약을 확인해주세요. 방문 시간까지 확정하지 않으면 자동 취소됩니다.`
          : ""
    }`,
    createdAt: now,
    read: false,
    link: "/o/home",
  });
  await saveDBAsync();

  // 멀티 인스턴스 polyfill — 같은 세션이 같은 인스턴스로 라우팅되지 않아도
  // 발급한 패스를 본인 시점에서 즉시 볼 수 있도록 쿠키에 적재.
  const sForCookie = db.stores.find((s) => s.id === c.storeId);
  if (sForCookie) {
    await appendRecentPass({
      pass,
      campaign: {
        id: c.id, title: c.title, kind: c.kind, supportAmount: c.supportAmount,
        requiredChannels: c.requiredChannels, description: c.description,
      },
      store: {
        id: sForCookie.id, name: sForCookie.name, area: sForCookie.area, category: sForCookie.category,
        coverEmoji: sForCookie.coverEmoji, lat: sForCookie.lat, lng: sForCookie.lng,
        naverPlaceId: sForCookie.naverPlaceId, address: sForCookie.address, hours: sForCookie.hours,
        rating: sForCookie.rating, reviewCount: sForCookie.reviewCount, ownerId: sForCookie.ownerId,
      },
    });
  }

  return NextResponse.json({ passId: pass.id });
}
