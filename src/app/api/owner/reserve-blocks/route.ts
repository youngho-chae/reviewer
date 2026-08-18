import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { campaignTimeSlots, scheduleOf, kstTodayStr } from "@/lib/reservation";

export const runtime = "nodejs";

// 사장님 예약 가능 일정 관리 (2026-07-22 §6) — 예약형 캠페인 전용 (방문형 미제공 — 6-4).
//  - block_date / unblock_date : 특정 날짜 전체 차단·해제 (휴무·대관·예약 포화)
//  - block_slot / unblock_slot : 특정 날짜의 특정 시간만 차단·해제 (외부 플랫폼 예약 수동 반영)
//    block_slot은 time 단건 또는 times 배열(2026-08-18 멀티셀렉 — 같은 날짜의 여러 시간 일괄 차단)
//  - pause_today / resume_today: 당일 예약 일시중지·해제 (자정이 지나면 자연 해제 — 6-3)
// 차단해도 **이미 확정된 예약은 자동 취소하지 않는다** (6-1 — 개별 [예약 취소]로 처리, 경고는 클라이언트).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { campaignId, action, date, time, times } = await req.json();
  const db = await getDBAsync();
  const c = db.campaigns.find((x) => x.id === String(campaignId || ""));
  if (!c) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 404 });
  const store = db.stores.find((x) => x.id === c.storeId);
  if (!store || store.ownerId !== s.userId) {
    return NextResponse.json({ error: "내 매장의 캠페인이 아닙니다" }, { status: 403 });
  }
  if (c.kind !== "visit" || !c.reservationRequired) {
    return NextResponse.json({ error: "일정 차단은 예약형 캠페인에서만 사용할 수 있어요" }, { status: 400 });
  }

  const blocks = (c.reservationBlocks ??= {});
  const d = String(date || "");
  const t = String(time || "");
  const today = kstTodayStr();

  switch (action) {
    case "block_date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today) {
        return NextResponse.json({ error: "차단할 날짜를 선택해주세요" }, { status: 400 });
      }
      blocks.dates = Array.from(new Set([...(blocks.dates ?? []), d])).sort();
      break;
    }
    case "unblock_date": {
      blocks.dates = (blocks.dates ?? []).filter((x) => x !== d);
      break;
    }
    case "block_slot": {
      const list = Array.from(new Set(Array.isArray(times) ? times.map(String) : [t]));
      const slots = campaignTimeSlots(scheduleOf(c));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < today || list.length === 0 || !list.every((x) => slots.includes(x))) {
        return NextResponse.json({ error: "차단할 날짜와 시간을 선택해주세요" }, { status: 400 });
      }
      const existing = blocks.slots ?? [];
      const add = list.filter((x) => !existing.some((sl) => sl.date === d && sl.time === x));
      blocks.slots = [...existing, ...add.map((x) => ({ date: d, time: x }))].sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
      );
      break;
    }
    case "unblock_slot": {
      blocks.slots = (blocks.slots ?? []).filter((x) => !(x.date === d && x.time === t));
      break;
    }
    case "pause_today": {
      // 오늘 남은 예약 가능 시간 전체 차단 — 이미 확정된 예약은 유지 (6-3)
      blocks.pausedDate = today;
      break;
    }
    case "resume_today": {
      delete blocks.pausedDate;
      break;
    }
    default:
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  // 지난 날짜 차단 기록 자동 정리 (표시·데이터 비대화 방지 — 이력 아님)
  blocks.dates = (blocks.dates ?? []).filter((x) => x >= today);
  blocks.slots = (blocks.slots ?? []).filter((x) => x.date >= today);
  if (blocks.pausedDate && blocks.pausedDate !== today) delete blocks.pausedDate;

  await saveDBAsync();
  return NextResponse.json({ ok: true, blocks });
}
