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

// 아이콘 배경색 (브랜드 톤 유지) — 임시 글자 아이콘용.
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
}

// 채널별 리뷰 작성 조건 (자가 점검 항목) — 채널 특성에 맞게 분기 (v2.16).
// 수치는 가변 데이터로 유지 (2026-07-07 회의). 블로그 기준 상향: 사진 15장·본문 1000자·90일 유지 (2026-07-08).
export const CHANNEL_REVIEW_CONDITIONS: Record<SnsKind, ReviewCondition[]> = {
  naver_blog: [
    { key: "photos15", label: "사진 15장 이상", hint: "메뉴/매장/분위기를 골고루 담았어요" },
    { key: "body1000", label: "본문 1000자 이상", hint: "방문 경험을 충분히 묘사했어요" },
    { key: "days90", label: "90일 이상 게시 유지", hint: "조기 삭제 시 등급 점수가 차감될 수 있어요" },
  ],
  instagram: [
    { key: "photos3", label: "피드 사진/영상 3장 이상", hint: "메뉴와 매장이 보이게 담았어요" },
    { key: "caption100", label: "캡션 100자 이상", hint: "방문 경험을 자연스럽게 적었어요" },
    { key: "tags", label: "지정 해시태그 + 위치 태그", hint: "매장 위치 태그와 안내 해시태그를 넣었어요" },
    { key: "days30", label: "30일 이상 게시 유지", hint: "조기 삭제 시 등급 점수가 차감될 수 있어요" },
  ],
  tiktok: [
    { key: "video15", label: "15초 이상 영상", hint: "메뉴/매장이 충분히 담기게 촬영했어요" },
    { key: "appear", label: "매장 / 메뉴 영상에 등장", hint: "실제 방문이 드러나게 담았어요" },
    { key: "caption2", label: "캡션 + 해시태그", hint: "안내 해시태그를 넣었어요" },
    { key: "days30", label: "30일 이상 게시 유지", hint: "조기 삭제 시 등급 점수가 차감될 수 있어요" },
  ],
};

// 캠페인의 필수 채널 중 우선순위(블로그→인스타→틱톡)가 가장 높은 채널.
export function defaultChannel(required: SnsKind[]): SnsKind | null {
  for (const ch of CHANNEL_ORDER) {
    if (required.includes(ch)) return ch;
  }
  return required[0] ?? null;
}
