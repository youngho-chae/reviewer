import { SnsKind } from "./types";

// 연동/참여 가능한 채널 — 네이버 블로그 / 인스타그램 / 틱톡 3종 (v2.16).
// CHANNEL_ORDER는 우선순위(블로그 → 인스타 → 틱톡)이며,
// 매장 상세의 기본 선택 채널을 정할 때 이 순서를 따른다.
export const CHANNEL_ORDER: SnsKind[] = ["naver_blog", "instagram", "tiktok"];

export const CHANNEL_LABEL: Record<SnsKind, string> = {
  naver_blog: "네이버 블로그",
  instagram: "인스타그램",
  tiktok: "틱톡",
};

// 임시 사각 라운드 아이콘에 표기할 1글자 라벨.
export const CHANNEL_SHORT: Record<SnsKind, string> = {
  naver_blog: "블",
  instagram: "인",
  tiktok: "틱",
};

// 브랜드 아이콘 PNG (2026-08-18 — public/ 업로드분, 96×96). 렌더는 next/image —
// 배지형은 ChannelIcons, 타일형(채널 관리·등급 화면)은 각 화면이 크기만 달리 사용.
export const CHANNEL_ICON_SRC: Record<SnsKind, string> = {
  naver_blog: "/blog.png",
  instagram: "/instagram.png",
  tiktok: "/tiktok.png",
};

// 아이콘 배경색 (브랜드 톤 유지) — 구 글자 아이콘용 (2026-08-18 아이콘 전환으로 도먼트).
export const CHANNEL_BADGE_BG: Record<SnsKind, string> = {
  naver_blog: "bg-[#03c75a] text-white", // 네이버 그린
  instagram: "bg-[#d62976] text-white", // 인스타 핑크
  tiktok: "bg-ink text-white", // 틱톡 블랙
};

export const CHANNEL_AD_NOTICE: Record<SnsKind, string> = {
  naver_blog: "본 게시물은 캐치랭크를 통해 방문 혜택을 제공받아 작성한 후기입니다.",
  instagram: "#광고 캐치랭크를 통해 방문 혜택을 제공받았습니다.",
  tiktok: "#광고 #협찬 — 캐치랭크 방문 혜택 제공",
};

export const CHANNEL_URL_PLACEHOLDER: Record<SnsKind, string> = {
  naver_blog: "https://blog.naver.com/...",
  instagram: "https://instagram.com/p/...",
  tiktok: "https://tiktok.com/@.../video/...",
};

export interface ReviewCondition {
  key: string;
  label: string;
  hint: string;
  // 게시 유지 의무 항목 — 제출 시점에 "완료된 사실"로 확인할 수 없어
  // 자가 점검 리스트에서 제외되고 별도 필수 동의(keepAgreed)로 분리된다.
  keep?: boolean;
}

// 채널별 리뷰 작성 조건 (자가 점검 항목) — 채널 특성에 맞게 분기 (v2.16).
// 수치는 가변 데이터로 유지 (2026-07-07 회의). 블로그 기준 상향: 사진 15장·본문 1000자 (2026-07-08).
// 게시 유지 기간은 전 채널 90일로 통일 (2026-07-10 확정).
export const KEEP_DAYS = 90;

export const CHANNEL_REVIEW_CONDITIONS: Record<SnsKind, ReviewCondition[]> = {
  naver_blog: [
    { key: "photos15", label: "사진 15장 이상", hint: "메뉴/매장/분위기를 골고루 담았어요" },
    { key: "body1000", label: "본문 1000자 이상", hint: "방문 경험을 충분히 묘사했어요" },
    { key: "days90", label: "90일 이상 게시 유지", hint: "조기 삭제 시 등급 점수가 차감될 수 있어요", keep: true },
  ],
  instagram: [
    { key: "photos3", label: "피드 사진/영상 3장 이상", hint: "메뉴와 매장이 보이게 담았어요" },
    { key: "caption100", label: "캡션 100자 이상", hint: "방문 경험을 자연스럽게 적었어요" },
    { key: "tags", label: "지정 해시태그 + 위치 태그", hint: "매장 위치 태그와 안내 해시태그를 넣었어요" },
    { key: "days90", label: "90일 이상 게시 유지", hint: "조기 삭제 시 등급 점수가 차감될 수 있어요", keep: true },
  ],
  tiktok: [
    { key: "video15", label: "15초 이상 영상", hint: "메뉴/매장이 충분히 담기게 촬영했어요" },
    { key: "appear", label: "매장 / 메뉴 영상에 등장", hint: "실제 방문이 드러나게 담았어요" },
    { key: "caption2", label: "캡션 + 해시태그", hint: "안내 해시태그를 넣었어요" },
    { key: "days90", label: "90일 이상 게시 유지", hint: "조기 삭제 시 등급 점수가 차감될 수 있어요", keep: true },
  ],
};

// 리뷰 제출 화면의 자가 점검 대상 = "제출 시점에 완료된 사실"만 (keep 항목 제외).
// ReviewForm(클라)·/api/passes/review(서버 재검증)·시드가 반드시 같은 목록을 써야 한다.
export function selfCheckConditions(channel: SnsKind): ReviewCondition[] {
  return CHANNEL_REVIEW_CONDITIONS[channel].filter((c) => !c.keep);
}

// ── 영수증 리뷰 (2026-08-07 — SNS 미연동(N) 참여 경로, 방문형 전용) ──────────
// SNS 채널이 아니라 매장 결제 영수증 기반 리뷰로 참여한다. 지원금 = N 배율(10%),
// 제출물 = 작성한 영수증 리뷰 화면 캡처(URL 없음). 배송형은 대상 아님(영수증 개념 없음).
export const RECEIPT_LABEL = "영수증 리뷰";
// 광고 문구 표기 대상 아님(2026-08-07 — 매장 방문 인증 기반 리뷰, 구 RECEIPT_AD_NOTICE 폐기).
// 제출 = 작성한 영수증 리뷰의 **URL**(2026-08-07 개정 — 구 캡처 업로드 폐기).
// URL은 네이버 > My 플레이스에서 확인 — 제출 폼이 안내 카드와 이동 버튼을 제공한다.
export const NAVER_MY_PLACE_URL = "https://m.place.naver.com/my/review";
export const RECEIPT_REVIEW_CONDITIONS: ReviewCondition[] = [
  { key: "receiptWrite", label: "네이버 영수증 리뷰 작성", hint: "결제 영수증으로 방문을 인증하고 리뷰를 남겼어요" },
  { key: "receiptText", label: "방문 경험이 담긴 내용", hint: "메뉴·매장 경험을 한두 줄 이상 적었어요" },
  { key: "days90", label: "90일 이상 게시 유지", hint: "조기 삭제 시 등급 점수가 차감될 수 있어요", keep: true },
];
export function receiptSelfCheckConditions(): ReviewCondition[] {
  return RECEIPT_REVIEW_CONDITIONS.filter((c) => !c.keep);
}

// 캠페인의 필수 채널 중 우선순위(블로그→인스타→틱톡)가 가장 높은 채널.
export function defaultChannel(required: SnsKind[]): SnsKind | null {
  for (const ch of CHANNEL_ORDER) {
    if (required.includes(ch)) return ch;
  }
  return required[0] ?? null;
}
