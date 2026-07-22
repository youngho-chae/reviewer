import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid, isUseCode, normalizeUseCode } from "@/lib/ids";
import { Campaign, RequiredMenu, ReservationSchedule, SnsKind } from "@/lib/types";
import { timeToMin, SLOT_CAPACITY_MIN, SLOT_CAPACITY_MAX } from "@/lib/reservation";
import { distributeQuota, PLAN_POLICY, currentMonthStart } from "@/lib/plan-policy";
import { CHANNEL_ORDER } from "@/lib/channels";
import { isDeliveryCategory } from "@/lib/delivery-categories";
import { availableQuotaBonus, consumeQuotaBonus } from "@/lib/referral";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const body = await req.json();
  const db = await getDBAsync();
  const owner = db.owners.find((o) => o.id === s.userId);
  if (!owner) return NextResponse.json({ error: "사장님 정보를 찾을 수 없습니다" }, { status: 400 });
  const store = db.stores.find((x) => x.id === body.storeId && x.ownerId === s.userId);
  if (!store) return NextResponse.json({ error: "잘못된 매장" }, { status: 400 });

  const totalQuota = Math.max(0, Math.floor(Number(body.totalQuota) || 0));
  if (totalQuota <= 0) return NextResponse.json({ error: "모집 인원을 1명 이상 입력해주세요" }, { status: 400 });

  // 사용처리 4자리 숫자 코드 — 방문형 필수.
  // 배송형(2026-07-12)은 QR/코드 사용 처리가 없어 미입력 시 자동 생성한다 (스키마 필수 필드 유지).
  const isDeliveryKind = body.kind === "delivery";
  let useCode = normalizeUseCode(String(body.useCode ?? ""));
  if (!isUseCode(useCode)) {
    if (!isDeliveryKind) {
      return NextResponse.json({ error: "사용처리 코드는 숫자 4자리로 입력해주세요" }, { status: 400 });
    }
    useCode = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  }
  // 동일 사장님의 진행 중(미마감) 캠페인 간 4자리 코드 중복 방지 (조회 모호성 제거)
  const ownerStoreIdSet = new Set(db.stores.filter((x) => x.ownerId === owner.id).map((x) => x.id));
  const codeInUse = (code: string) =>
    db.campaigns.some((c) => ownerStoreIdSet.has(c.storeId) && c.endAt > Date.now() && c.useCode === code);
  // 배송형 자동 생성 코드가 충돌하면 재생성 (사장님 입력이 아니므로 오류 대신 해소)
  if (isDeliveryKind && !isUseCode(normalizeUseCode(String(body.useCode ?? "")))) {
    let guard = 0;
    while (codeInUse(useCode) && guard++ < 50) {
      useCode = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    }
  }
  const dupActive = codeInUse(useCode);
  if (dupActive) {
    return NextResponse.json(
      { error: `사용처리 코드 ${useCode}는 진행 중인 다른 캠페인에서 사용 중입니다. 다른 4자리를 입력해주세요.` },
      { status: 400 },
    );
  }

  // 월간 모집 팀 수 정책 검증 — 초대 보상(quota_bonus)은 플랜 한도에 가산되며 사용 시 소진
  const policy = PLAN_POLICY[owner.plan];
  if (policy.monthlyTeamLimit !== null) {
    const monthStart = currentMonthStart();
    const ownerStoreIds = new Set(db.stores.filter((x) => x.ownerId === owner.id).map((x) => x.id));
    const monthlyUsed = db.campaigns
      .filter((c) => ownerStoreIds.has(c.storeId) && c.createdAt >= monthStart)
      .reduce((sum, c) => sum + c.quota.S + c.quota.A + c.quota.B + c.quota.C, 0);
    const bonus = availableQuotaBonus(db, owner.id);
    const remaining = policy.monthlyTeamLimit + bonus - monthlyUsed;
    if (totalQuota > remaining) {
      return NextResponse.json(
        {
          error: `${owner.plan} 플랜은 월 ${policy.monthlyTeamLimit}팀까지 모집 가능합니다 (이번 달 ${monthlyUsed}팀 사용${bonus > 0 ? ` · 보너스 +${bonus}팀` : ""} · 잔여 ${Math.max(0, remaining)}팀).`,
        },
        { status: 400 },
      );
    }
    // 플랜 한도를 초과하는 분량만큼 보너스 소진
    const overPlan = monthlyUsed + totalQuota - policy.monthlyTeamLimit;
    if (overPlan > 0) consumeQuotaBonus(db, owner.id, overPlan);
  }

  // 필수 주문 메뉴 — { name, price? } 형태로 정규화
  const requiredMenus: RequiredMenu[] = Array.isArray(body.requiredMenus)
    ? body.requiredMenus
        .map((m: unknown) => {
          if (typeof m === "string") return { name: m.trim() };
          if (m && typeof m === "object") {
            const obj = m as { name?: unknown; price?: unknown };
            const name = String(obj.name ?? "").trim();
            const priceNum =
              typeof obj.price === "number"
                ? obj.price
                : typeof obj.price === "string" && obj.price.trim() !== ""
                  ? Number(String(obj.price).replace(/\D/g, ""))
                  : NaN;
            const price = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined;
            return { name, price };
          }
          return { name: "" };
        })
        .filter((m: RequiredMenu) => m.name.length > 0)
        .slice(0, 5) // 필수 주문 메뉴는 선택 입력·최대 5개 (확정 정책 6)
    : [];

  // 필수 채널 — 허용 채널(블/인/틱)만 통과, 중복 제거
  const requiredChannels = ((body.requiredChannels || []) as SnsKind[]).filter(
    (ch, i, arr) => CHANNEL_ORDER.includes(ch) && arr.indexOf(ch) === i,
  );
  if (requiredChannels.length === 0) {
    return NextResponse.json({ error: "필수 채널을 1개 이상 선택해주세요" }, { status: 400 });
  }

  // 강조 키워드 — 최대 5개, 각 20자
  const highlightKeywords: string[] = Array.isArray(body.highlightKeywords)
    ? body.highlightKeywords
        .map((k: unknown) => String(k ?? "").trim().slice(0, 20))
        .filter((k: string) => k.length > 0)
        .slice(0, 5)
    : [];

  const now = Date.now();
  // 캠페인명 — 사장님 내부 관리용 제목 (확정 정책 7). 미입력 시 매장명 자동.
  // 체험자 화면은 항상 매장명(store.name) 중심으로 노출한다.
  const ownerTitle = String(body.title || "").trim().slice(0, 40);
  // 캠페인 유형 (2026-07-12 레뷰 벤치마크) — 방문형 | 배송형. 배송형은 체험 포인트(선택) 지급 가능.
  const kind: Campaign["kind"] = body.kind === "delivery" ? "delivery" : "visit";
  // 기준 포인트 — 100P 단위 절사, 최대 100만P (배송형 전용, 실지급은 등급 배율 적용)
  const pointReward =
    kind === "delivery" ? Math.min(1000000, Math.floor((Number(body.pointReward) || 0) / 100) * 100) : 0;
  // 상품 카테고리 — 배송형 필수. 플레이스 카테고리가 아닌 상품군 분류 (delivery-categories.ts)
  const productCategory = kind === "delivery" ? String(body.productCategory || "").trim() : "";
  if (kind === "delivery" && !isDeliveryCategory(productCategory)) {
    return NextResponse.json({ error: "상품 카테고리를 선택해주세요" }, { status: 400 });
  }
  // 예약형 (2026-07-22 작업 리스트 1-1 — 방문형과 구분되는 유형으로 승격, 데이터는 visit+reservationRequired)
  const reservationRequired = kind === "visit" && body.reservationRequired === true;
  // 예약 안내 (2026-07-16 리뷰노트 벤치마크 — 가능 요일·시간대 등) — 예약형 전용, 선택 입력
  const reservationNote = reservationRequired ? String(body.reservationNote || "").trim().slice(0, 80) : "";
  // 예약 운영 스케줄 (2026-07-22 §2) — 예약형 필수: 요일·운영시간(30분 단위)·브레이크(선택)·
  // 예약 가능 시작일(선택, 기본 즉시)·시간대 정원(1~5, 기본 1팀)
  let reservationSchedule: ReservationSchedule | undefined;
  if (reservationRequired) {
    const rs = (body.reservationSchedule ?? {}) as Partial<ReservationSchedule>;
    const days = Array.isArray(rs.days)
      ? Array.from(new Set(rs.days.map((d) => Math.floor(Number(d))))).filter((d) => d >= 0 && d <= 6).sort()
      : [];
    if (days.length === 0) {
      return NextResponse.json({ error: "예약 가능한 요일을 1개 이상 선택해주세요" }, { status: 400 });
    }
    const isHalfHour = (t: unknown): t is string =>
      typeof t === "string" && /^([01]\d|2[0-4]):(00|30)$/.test(t) && timeToMin(t) <= 24 * 60;
    const open = rs.open;
    const close = rs.close;
    if (!isHalfHour(open) || !isHalfHour(close) || timeToMin(close) <= timeToMin(open)) {
      return NextResponse.json({ error: "예약 가능 시간을 확인해주세요 (시작 시간이 종료 시간보다 빨라야 해요)" }, { status: 400 });
    }
    reservationSchedule = { days, open, close };
    // 브레이크 타임 — 선택 입력, 운영시간 내 구간만 (단일 구간 — 2-4)
    if (rs.breakStart || rs.breakEnd) {
      const bs = rs.breakStart;
      const be = rs.breakEnd;
      if (
        !isHalfHour(bs) ||
        !isHalfHour(be) ||
        timeToMin(be) <= timeToMin(bs) ||
        timeToMin(bs) < timeToMin(open) ||
        timeToMin(be) > timeToMin(close)
      ) {
        return NextResponse.json({ error: "브레이크 타임은 운영시간 내에서 시작·종료를 선택해주세요" }, { status: 400 });
      }
      reservationSchedule.breakStart = bs;
      reservationSchedule.breakEnd = be;
    }
    // 예약 가능 시작일 (2-5) — 오늘 이후만, 캠페인 종료일보다 이르게. 미설정 = 즉시 예약 가능.
    const opensAt = Number(rs.opensAt);
    if (Number.isFinite(opensAt) && opensAt > now) {
      const endAtCandidate = now + (Number(body.days) || 30) * 86400000;
      if (opensAt >= endAtCandidate) {
        return NextResponse.json({ error: "예약 가능 시작일은 캠페인 종료일보다 이르게 설정해주세요" }, { status: 400 });
      }
      reservationSchedule.opensAt = opensAt;
    }
    // 시간대 정원 (§13-A 기본안) — 같은 시간 최대 팀 수 1~5, 기본 1
    const cap = Math.floor(Number(rs.slotCapacity) || 1);
    reservationSchedule.slotCapacity = Math.min(SLOT_CAPACITY_MAX, Math.max(SLOT_CAPACITY_MIN, cap));
  }
  // 배송형 상품 옵션 (2026-07-16) — 최대 5개, 각 30자, 중복 제거. 설정 시 신청에서 택1 필수.
  const productOptions: string[] =
    kind === "delivery" && Array.isArray(body.productOptions)
      ? (body.productOptions as unknown[])
          .map((o) => String(o ?? "").trim().slice(0, 30))
          .filter((o, i, arr) => o.length > 0 && arr.indexOf(o) === i)
          .slice(0, 5)
      : [];
  // 캠페인 사진 (2026-07-17 회의) — [0]=플레이스 대표 이미지 + 사장님 추가, 3~20장 필수.
  // dataURL(클라이언트 리사이즈) 또는 URL만 허용, 장당 300KB 제한 (단일 키 DB 비대화 방지).
  const photos: string[] = Array.isArray(body.photos)
    ? (body.photos as unknown[])
        .map((p) => String(p ?? ""))
        .filter((p) => (p.startsWith("data:image/") || p.startsWith("http") || p.startsWith("/")) && p.length <= 300 * 1024)
        .slice(0, 20)
    : [];
  if (photos.length < 3) {
    return NextResponse.json({ error: "매장·상품 사진을 3장 이상 등록해주세요 (최대 20장)" }, { status: 400 });
  }

  const c: Campaign = {
    id: rid("cp"),
    storeId: store.id,
    kind,
    title: ownerTitle || store.name,
    startAt: now,
    endAt: now + (Number(body.days) || 30) * 86400000,
    supportAmount: Number(body.supportAmount) || 0,
    quota: distributeQuota(owner.plan, totalQuota),
    used: { S: 0, A: 0, B: 0, C: 0 },
    requiredChannels,
    requiredMenus,
    description: String(body.description || "").slice(0, 500),
    highlightKeywords,
    createdAt: now,
    useCode,
    ...(pointReward > 0 ? { pointReward } : {}),
    ...(productCategory ? { productCategory } : {}),
    ...(reservationRequired ? { reservationRequired: true } : {}),
    ...(reservationNote ? { reservationNote } : {}),
    ...(reservationSchedule ? { reservationSchedule } : {}),
    ...(productOptions.length > 0 ? { productOptions } : {}),
    photos,
  };
  db.campaigns.push(c);
  await saveDBAsync();
  return NextResponse.json({ ok: true, id: c.id });
}
