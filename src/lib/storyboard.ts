// ─────────────────────────────────────────────────────────────
// [스토리보드 모드] design/storyboard-schema 브랜치 전용 라벨 사전.
//
// 숫자·이미지·복합 표현(₩지원금액, 평점, 잔여 N자리, 도보 N분 등)은
// 시드 데이터만으로 한글 스키마 라벨로 바꿀 수 없으므로,
// 화면 컴포넌트에서 이 사전을 참조하여 "어떤 데이터가 들어가는 자리인지"를 노출한다.
//
// STORYBOARD=false 로 두면 (또는 backup/real-mockdata 브랜치) 실데이터 렌더로 원복.
// ─────────────────────────────────────────────────────────────

export const STORYBOARD = true;

export const SBUI = {
  support: "지원금액",
  rating: "평점",
  reviewCount: "리뷰수",
  remain: "잔여수량",
  walk: "도보시간",
  grade: "등급",
  gradeReq: "참여등급",
  deadline: "마감일",
  quota: "모집인원",
  payout: "정산금액",
  price: "가격",
  count: "개수",
  count2: "수량",
  avgSupport: "평균지원금액",
  date: "날짜",
  status: "상태",
  channel: "채널",
  token: "초대코드",
  matrix: "유형",
  reward: "보상",
  boxGrade: "박스등급",
  liveCount: "참여자수",
  // 디자인 시스템 v2 시안 필드
  distance: "거리",
  saved: "아낀금액",
  endDate: "체험마감일",
  reviewDue: "리뷰마감기한",
  area: "지역",
} as const;

// 숫자 자리표시 — "지원금액"처럼 라벨을 그대로 반환 (실데이터일 땐 포맷된 값 반환)
export function sbNum(label: string, realFormatted: string): string {
  return STORYBOARD ? label : realFormatted;
}
