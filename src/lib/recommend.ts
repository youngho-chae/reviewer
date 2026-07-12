// 추천순 정렬 (2026-07-10 확정) — 홈 '내가 체험할 수 있는' 리스트와 탐색 탭이 공유.
//
// 기준: ① 신청 가능 여부(issued_out=체험권 일시 소진은 최후순위 — 참여 불가 상태이므로)
//       ② 캠페인을 만든 **사장님의 멤버십 플랜 랭크**(Premium > Standard > Basic > Free)
//       ③ 캠페인 생성일 최신순
// 플랜은 조회 시점의 '현재 플랜'을 적용한다(생성 당시 플랜 아님).
// [P1] 리뷰어 등급과 무관한 사장님 멤버십 기준의 마케팅 노출 우대 — 참여 자격에는 영향 없음.

export interface Recommendable {
  soldOut?: boolean; // campaignExposure === "issued_out"
  planRank: number; // PLAN_RANK[owner.plan]
  createdAt: number; // Campaign.createdAt
}

export function compareRecommended(a: Recommendable, b: Recommendable): number {
  const aSold = a.soldOut ? 1 : 0;
  const bSold = b.soldOut ? 1 : 0;
  if (aSold !== bSold) return aSold - bSold;
  if (a.planRank !== b.planRank) return b.planRank - a.planRank;
  return b.createdAt - a.createdAt;
}
