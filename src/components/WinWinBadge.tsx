// 상생 리뷰어 뱃지 (2026-08-07 신설) — 인스타그램 인증 배지처럼 닉네임 옆에 붙는
// 아이콘. 시안: 두 손의 악수가 하트를 이루는 글로시 핑크 마크.
// [P1] 표시 전용 신뢰 표식 — 지원금 배율·참여 조건에 일절 영향 없음 (운영정책서 §10.4).
// 사장님 화면에는 노출하지 않는다 (체험자 본인·어드민 전용 — 식별정보 비노출 원칙과 쌍).
export default function WinWinBadge({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="상생 리뷰어"
      className={`inline-block shrink-0 ${className}`}
    >
      <defs>
        {/* 인스턴스가 여러 개여도 정의가 동일해 id 중복은 무해 */}
        <linearGradient id="wwbG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FBCFE8" />
          <stop offset="0.55" stopColor="#F472B6" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      {/* 하트 몸통 — 핑크 그라디언트 + 딥핑크 외곽선 */}
      <path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.51 4.04 3 5.5l7 7Z"
        fill="url(#wwbG)"
        stroke="#BE185D"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* 맞잡은 손 — 하트 안 악수 라인 */}
      <path
        d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"
        fill="none"
        stroke="#9D174D"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m18 15-2-2" fill="none" stroke="#9D174D" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m15 18-2-2" fill="none" stroke="#9D174D" strokeWidth="1.5" strokeLinecap="round" />
      {/* 글로시 하이라이트 */}
      <ellipse cx="6.8" cy="6.4" rx="2.1" ry="1.1" fill="#fff" opacity="0.5" transform="rotate(-22 6.8 6.4)" />
    </svg>
  );
}
