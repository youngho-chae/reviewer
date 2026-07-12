// SNS 연동 상태 쿠키 스톱갭 (2026-07-10) — recent-passes-cookie와 동일 패턴.
//
// 서버리스 다중 인스턴스 + KV 미연결 환경에서는 연동/해제 뮤테이션이 인스턴스 A의
// 메모리에만 반영되고, 다음 페이지 렌더가 인스턴스 B(연동 전 시드)에 떨어지면
// UI가 그대로인 문제가 생긴다. 뮤테이션 응답과 함께 본인 sns 배열을 쿠키에 적재하고,
// 체험자 화면·발급 API가 서버 데이터에 이 쿠키를 병합해 **본인 시점에서는 항상
// 최신 연동 상태**로 동작하게 한다. KV 연결 환경에서는 값이 동일해 무해.
//
// 한계(recent-passes와 동일): 사장님 등 다른 액터·다른 세션에는 적용되지 않음 —
// 진짜 cross-actor 동기화는 Vercel KV 연결이 정답(운영정책서 §9 출시 체크리스트).

import { cookies } from "next/headers";
import type { Grade, Reviewer, SnsAccount, SnsKind } from "./types";
import { bestGrade, channelGradesFromSns } from "./grade";

const COOKIE_NAME = "cp_sns_state_v1";
const MAX_AGE_SEC = 60 * 60; // 1시간 — 그 사이 KV/인스턴스가 따라잡는다

interface SnsStateCookie {
  reviewerId: string;
  at: number;
  sns: SnsAccount[];
}

// 뮤테이션(연동/해제/검증) 직후 최신 sns 배열 적재 — route handler에서 호출
export async function writeSnsState(reviewerId: string, sns: SnsAccount[]): Promise<void> {
  try {
    const jar = await cookies();
    const payload: SnsStateCookie = { reviewerId, at: Date.now(), sns };
    jar.set({
      name: COOKIE_NAME,
      value: Buffer.from(JSON.stringify(payload), "utf-8").toString("base64"),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_SEC,
    });
  } catch {}
}

// OAuth 콜백(redirect 응답)용 — NextResponse.cookies.set에 넣을 값 직렬화
export function encodeSnsState(reviewerId: string, sns: SnsAccount[]): { name: string; value: string; maxAge: number } {
  const payload: SnsStateCookie = { reviewerId, at: Date.now(), sns };
  return {
    name: COOKIE_NAME,
    value: Buffer.from(JSON.stringify(payload), "utf-8").toString("base64"),
    maxAge: MAX_AGE_SEC,
  };
}

export async function readSnsState(): Promise<SnsStateCookie | null> {
  try {
    const jar = await cookies();
    const c = jar.get(COOKIE_NAME);
    if (!c) return null;
    const decoded = JSON.parse(Buffer.from(c.value, "base64").toString("utf-8"));
    if (!decoded || typeof decoded.reviewerId !== "string" || !Array.isArray(decoded.sns)) return null;
    return decoded as SnsStateCookie;
  } catch {
    return null;
  }
}

export interface EffectiveChannelState {
  sns: SnsAccount[];
  channelGrades: Partial<Record<SnsKind, Grade>>;
  grade: Grade; // 표기용 대표 등급 (연동 채널 중 최고)
}

// 서버 데이터 + 쿠키 병합 — 본인 쿠키가 있으면 쿠키 sns를 진실원천으로 등급 재계산.
// 체험자 화면(me/grade/채널 관리/매장 상세/홈/탐색)과 발급 API가 공용으로 사용한다.
export async function effectiveChannelState(me: Reviewer): Promise<EffectiveChannelState> {
  const cookie = await readSnsState();
  if (cookie && cookie.reviewerId === me.id) {
    const channelGrades = channelGradesFromSns(cookie.sns);
    return { sns: cookie.sns, channelGrades, grade: bestGrade(Object.values(channelGrades)) };
  }
  return {
    sns: me.sns,
    channelGrades: me.channelGrades ?? channelGradesFromSns(me.sns),
    grade: me.grade,
  };
}
