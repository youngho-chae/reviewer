import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { rid, passCode } from "@/lib/ids";
import { readSession } from "@/lib/auth";
import { Pass } from "@/lib/types";
import { gradeMeets } from "@/lib/grade";
import { appendRecentPass } from "@/lib/recent-passes-cookie";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "reviewer") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { campaignId } = await req.json();
  const db = await getDBAsync();
  const me = db.reviewers.find((r) => r.id === s.userId);
  const c = db.campaigns.find((x) => x.id === campaignId);
  if (!me || !c) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const totalQ = c.quota.S + c.quota.A + c.quota.B + c.quota.C;
  const usedQ = c.used.S + c.used.A + c.used.B + c.used.C;
  if (totalQ - usedQ <= 0) return NextResponse.json({ error: "마감되었습니다" }, { status: 400 });

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

  // 등급 검증 — 가장 낮은 자격(C 우선)이 입장 기준
  const minGrade: "S" | "A" | "B" | "C" =
    c.quota.C > 0 ? "C" : c.quota.B > 0 ? "B" : c.quota.A > 0 ? "A" : "S";
  if (me.grade !== "S" && !gradeMeets(me.grade, minGrade)) {
    return NextResponse.json({ error: `${minGrade}등급부터 이용 가능합니다` }, { status: 403 });
  }

  // 등급별 quota 차감 (자기 등급 우선, 부족 시 상위 권한이 빈 슬롯 사용)
  const order: Array<"S" | "A" | "B" | "C"> = ["S", "A", "B", "C"];
  const fromIdx = order.indexOf(me.grade === "N" ? "C" : (me.grade as any));
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
    reviewerGrade: me.grade,
    issuedAt: now,
    expiresAt: now + 1000 * 60 * 60 * 24,
    status: "active",
  };
  db.passes.push(pass);
  // 사장님 알림
  db.notifications.push({
    id: rid("nt"),
    userId: pass.ownerId,
    role: "owner",
    title: "체험권 발급",
    body: `${me.nickname}님(${me.grade}등급)이 캠페인에 참여했습니다.`,
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
