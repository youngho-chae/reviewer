import { NextRequest, NextResponse } from "next/server";
import { getDBAsync, saveDBAsync } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { rid } from "@/lib/ids";
import {
  PROPOSAL_MAX_SLOTS,
  PROPOSAL_NOTE_MAX,
  RESERVATION_TIME_SLOTS,
  fmtReservationLabel,
  reservationEpoch,
  reservationHistory,
  ownerProposalUsed,
} from "@/lib/reservation";

export const runtime = "nodejs";

// 다른 시간 제안 (2026-07-16 예약형 v2) — 사장님이 예약 요청에 대안 일시를 제안한다.
// 슬롯 최대 3개 + 수기 안내사항(선택지가 3개보다 많거나 추가 안내가 필요할 때 직접 작성 — 체험자에게 노출).
// [P1] 제안은 거절이 아니다 — 취소 결정권은 체험자에게 있다 (수락=확정 / 기타 입력=재요청 / 거절=취소).
export async function POST(req: NextRequest) {
  const s = await readSession();
  if (!s || s.role !== "owner") return NextResponse.json({ error: "사장님 로그인 필요" }, { status: 401 });
  const { passId, slots, note } = await req.json();
  const db = await getDBAsync();
  const pass = db.passes.find((p) => p.id === String(passId || ""));
  if (!pass) return NextResponse.json({ error: "체험권을 찾을 수 없습니다" }, { status: 404 });
  if (pass.ownerId !== s.userId) return NextResponse.json({ error: "내 매장의 체험권이 아닙니다" }, { status: 403 });
  if (pass.status !== "active" || !pass.reservation) {
    return NextResponse.json({ error: "제안할 예약이 없습니다" }, { status: 400 });
  }
  if (pass.reservation.status !== "requested") {
    return NextResponse.json(
      { error: pass.reservation.status === "confirmed" ? "이미 확정된 예약입니다" : "체험자 응답을 기다리는 중입니다" },
      { status: 400 },
    );
  }
  // 제안은 서로 각 1회 (2026-07-16 v3) — 사장님 제안 소진 후에는 [예약 확인]/[거절]만 가능
  if (ownerProposalUsed(pass.reservation)) {
    return NextResponse.json(
      { error: "다른 시간 제안은 1회만 보낼 수 있어요 — 체험자의 재제안을 확인하거나 거절해주세요" },
      { status: 400 },
    );
  }
  const c = db.campaigns.find((x) => x.id === pass.campaignId);
  if (!c) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다" }, { status: 400 });

  const now = Date.now();
  // 슬롯 정제 — 형식·미래·캠페인 기간 내·중복 제거, 최대 3개
  const seen = new Set<string>();
  const cleanSlots: Array<{ date: string; time: string }> = [];
  for (const raw of Array.isArray(slots) ? slots : []) {
    const date = String(raw?.date || "");
    const time = String(raw?.time || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !RESERVATION_TIME_SLOTS.includes(time)) continue;
    const epoch = reservationEpoch(date, time);
    if (!Number.isFinite(epoch) || epoch <= now || epoch > c.endAt) continue;
    const key = `${date}T${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleanSlots.push({ date, time });
    if (cleanSlots.length >= PROPOSAL_MAX_SLOTS) break;
  }
  const cleanNote = String(note || "").trim().slice(0, PROPOSAL_NOTE_MAX);
  if (cleanSlots.length === 0 && !cleanNote) {
    return NextResponse.json(
      { error: "제안 시간(최대 3개)을 선택하거나 안내사항을 작성해주세요" },
      { status: 400 },
    );
  }

  pass.reservation.status = "proposed";
  pass.reservation.proposal = { slots: cleanSlots, ...(cleanNote ? { note: cleanNote } : {}), proposedAt: now };
  // 협상 히스토리 (v3) — 구버전 데이터는 헬퍼가 최초 요청을 합성하므로 그대로 이어붙인다
  pass.reservation.history = [
    ...reservationHistory(pass.reservation),
    { at: now, by: "owner", kind: "propose", slots: cleanSlots, ...(cleanNote ? { note: cleanNote } : {}) },
  ];

  const store = db.stores.find((x) => x.id === pass.storeId);
  db.notifications.push({
    id: rid("nt"),
    userId: pass.reviewerId,
    role: "reviewer",
    title: "사장님이 다른 방문 시간을 제안했어요 📅",
    body: `${store?.name ?? "매장"}에서 ${
      cleanSlots.length > 0 ? `${fmtReservationLabel(cleanSlots[0].date, cleanSlots[0].time)}${cleanSlots.length > 1 ? ` 외 ${cleanSlots.length - 1}개` : ""} 시간을 제안했어요.` : "방문 시간 안내를 보냈어요."
    } 체험권에서 확인하고 선택해주세요.`,
    createdAt: now,
    read: false,
    link: `/r/passes/${pass.id}`,
  });

  await saveDBAsync();
  return NextResponse.json({ ok: true });
}
