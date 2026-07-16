// 택배사 정본 (2026-07-16 리뷰노트 벤치마크 — 배송형 운송장 조회).
// 사장님 발송 처리(택배사 선택)와 체험자 배송 조회 링크가 이 목록을 공유한다.
// 클라이언트 안전 모듈 (서버 전용 import 없음).

export interface Courier {
  code: string;
  label: string;
  // 운송장 조회 URL 템플릿 — {no} 자리에 운송장 번호. 없으면 조회 링크 미제공.
  trackUrl?: string;
}

export const COURIERS: Courier[] = [
  { code: "cj", label: "CJ대한통운", trackUrl: "https://trace.cjlogistics.com/next/tracking.html?wblNo={no}" },
  { code: "post", label: "우체국택배", trackUrl: "https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1={no}" },
  { code: "hanjin", label: "한진택배", trackUrl: "https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2={no}" },
  { code: "lotte", label: "롯데택배", trackUrl: "https://www.lotteglogis.com/open/tracking?invno={no}" },
  { code: "logen", label: "로젠택배", trackUrl: "https://www.ilogen.com/web/personal/trace/{no}" },
  { code: "etc", label: "기타 택배사" },
];

export function courierOf(code: string | undefined | null): Courier | undefined {
  return COURIERS.find((c) => c.code === code);
}

export function courierLabel(code: string | undefined | null): string {
  return courierOf(code)?.label ?? "택배";
}

// 배송 조회 URL — 택배사 미지정/기타 또는 운송장 없음이면 null
export function trackingUrl(code: string | undefined | null, trackingNo: string | undefined | null): string | null {
  const c = courierOf(code);
  if (!c?.trackUrl || !trackingNo) return null;
  return c.trackUrl.replace("{no}", encodeURIComponent(trackingNo));
}
