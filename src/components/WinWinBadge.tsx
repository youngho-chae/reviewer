import Image from "next/image";

// 상생 리뷰어 뱃지 (2026-08-07 신설 · 2026-08-18 업로드 에셋으로 교체)
// 정본 에셋 = public/winwin.png (288×78 — 불꽃+W 아이콘 + "상생 리뷰어" 텍스트 pill 일체형).
// size = 렌더 높이(px), 너비는 원본 비율(288:78)로 자동. 구 SVG 하트 악수 마크 폐기 —
// 텍스트가 포함된 pill이므로 호출부는 별도 라벨·pill 래퍼 없이 단독 사용한다.
// [P1] 표시 전용 신뢰 표식 — 지원금 배율·참여 조건에 일절 영향 없음 (운영정책서 §10.4).
// 사장님 화면에는 노출하지 않는다 (체험자 본인·어드민 전용 — 식별정보 비노출 원칙과 쌍).
const RATIO = 288 / 78;

export default function WinWinBadge({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/winwin.png"
      alt="상생 리뷰어"
      height={size}
      width={Math.round(size * RATIO)}
      className={`inline-block shrink-0 object-contain ${className}`}
    />
  );
}
