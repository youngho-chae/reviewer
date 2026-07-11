import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { rid, passCode } from "@/lib/ids";
import { readSession } from "@/lib/auth";
import { Pass, Grade, SnsKind } from "@/lib/types";
import { CHANNEL_LABEL } from "@/lib/channels";
import { PASS_VALIDITY_MS, CANCEL_REAPPLY_COOLDOWN_MS } from "@/lib/pass-lifecycle";
import { PRESS_ENABLED } from "@/lib/flags";
import { appendRecentPass } from "@/lib/recent-passes-cookie";

// 동시 보유 가능한 체험권(사용 전 active) 최대 수 — 2026-07-07 회의 확정
const MAX_ACTIVE_PASSES = 5;
// 취소 후 동일 캠페인 재신청 제한(12h)은 매장 상세 CTA와 공유 — src/lib/pass-lifecycle.ts

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { campaignId, channel } = await req.json();
  const db = await getDBAsync();
  const me = db.reviewers.find((r) => r.id === s.userId);
  const c = db.campaigns.find((x) => x.id === campaignId);
  if (!me || !c) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  // 참여 채널 / 자격 등급 결정.
  //  - 방문형(visit): 참여 시점에 채널 확정. 선택 채널의 내 등급으로 자격·지원금 결정.
  //  - 기자단(press): 작성 시점에 채널 선택. 표기 등급(연동 채널 중 최고)으로 자격 판정. (MVP 제외)
  const isPress = c.kind === "press";
  // [MVP] 기자단은 1차 출시 범위에서 제외 — 발급 차단 (src/lib/flags.ts)
  if (isPress && !PRESS_ENABLED) {
    return NextResponse.json({ error: "기자단 캠페인은 준비 중입니다" }, { status: 403 });
  }
  const selectedChannel: SnsKind | undefined = isPress
    ? undefined
    : (channel as SnsKind | undefined);
  let channelGrade: Grade;
  if (isPress) {
    channelGrade = me.grade;
  } else {
    if (!selectedChannel || !c.requiredChannels.includes(selectedChannel)) {
      return NextResponse.json({ error: "참여할 채널을 선택해주세요" }, { status: 400 });
    }
    const cg = me.channelGrades?.[selectedChannel];
    if (!cg) {
      return NextResponse.json({ error: "선택한 채널이 연동되어 있지 않습니다" }, { status: 403 });
    }
    channelGrade = cg;
  }

  // 기간 종료 캠페인 — 상세는 열람 가능(관심 목록 경유)하지만 발급은 차단
  if (c.endAt <= Date.now()) return NextResponse.json({ error: "마감된 체험입니다" }, { status: 400 });

  const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
  const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
  if (totalQ - usedQ <= 0) return NextResponse.json({ error: "마감되었습니다" }, { status: 400 });

  // 동시 보유 제한 — 사용 전(active) 체험권은 최대 5장 (2026-07-07 회의 확정)
  const activeCount = db.passes.filter((p) => p.reviewerId === me.id && p.status === "active").length;
  if (activeCount >= MAX_ACTIVE_PASSES) {
    return NextResponse.json(
      { error: `체험권은 동시에 ${MAX_ACTIVE_PASSES}장까지 보유할 수 있어요. 보유한 체험권을 사용하거나 취소한 뒤 발급받아주세요.` },
      { status: 400 },
    );
  }

  // 취소 후 동일 캠페인 재신청 제한 12시간 — 장기 점유 후 취소·재발급 악용 방지
  const now0 = Date.now();
  const recentCancel = db.passes.find(
    (p) =>
      p.reviewerId === me.id &&
      p.campaignId === c.id &&
      p.status === "cancelled" &&
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
          requiredChannels: c.requiredChannels, pressMaterials: c.pressMaterials,
          pressKeywords: c.pressKeywords, pressMinChars: c.pressMinChars, description: c.description,
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
  // 자기 등급 버킷 우선 소진, 소진 시 잔여 버킷(하위→상위 순) 사용. N등급은 C 버킷부터.
  const order: Array<"S" | "A" | "B" | "C"> = ["S", "A", "B", "C"];
  const fromIdx = order.indexOf(channelGrade === "N" ? "C" : (channelGrade as any));
  let consumedSlot: "S" | "A" | "B" | "C" | null = null;
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

  const now = Date.now();
  const pass: Pass = {
    id: rid("ps"),
    code: passCode(),
    reviewerId: me.id,
    campaignId: c.id,
    storeId: c.storeId,
    ownerId: db.stores.find((s) => s.id === c.storeId)!.ownerId,
    reviewerGrade: channelGrade,
    consumedSlot, // 만료/취소 시 이 슬롯을 복구
    reviewChannel: selectedChannel,
    issuedAt: now,
    // 방문형은 발급 후 72시간 사용 기한(연장·복구 없음), 기자단은 캠페인 종료까지 작성 가능
    expiresAt: isPress ? c.endAt : now + PASS_VALIDITY_MS,
    status: "active",
  };
  db.passes.push(pass);
  // 사장님 알림
  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: isPress ? "기자단 신청" : "체험권 발급",
    // [확정 정책 8·10] 체험자 실명·등급은 사장님에게 비노출 — 익명·채널만 전달
    body: `익명 #${me.id.slice(-4)} 체험자가 캠페인에 참여했습니다${selectedChannel ? ` (${CHANNEL_LABEL[selectedChannel]})` : ""}.`,
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
        requiredChannels: c.requiredChannels, pressMaterials: c.pressMaterials,
        pressKeywords: c.pressKeywords, pressMinChars: c.pressMinChars, description: c.description,
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
