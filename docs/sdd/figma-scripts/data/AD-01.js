// AD-01 · 운영팀 후기 검수 콘솔 (PRD v3.0 §4-E-1 · §6.7)
const DATA = {
  pageId: "14:14", x: 3000, y: 0,
  id: "AD-01", title: "후기 검수 콘솔 (운영팀 백오피스)", route: "/admin/reviews",
  device: "Desktop Web", ver: "1.0", date: "2026-07-06", author: "PO",
  status: "작성완료", prdRef: "PRD §4-E-1 · §6.7",
  mockups: [
    {
      name: "AD-01 · 검수 콘솔", caption: "review_submitted 큐 — 통과/반려(사유 필수 권장)",
      blocks: [
        { t: "bar", left: "운영팀 검수 콘솔", label: " ", right: "로그아웃" },
        { t: "card", dark: true, title: "검수 대기 4건 · 최근 7일 처리 12건", lines: ["오래된 제출 우선 정렬"], pin: 1 },
        { t: "card", title: "A등급 · 익명 #1242 · 방문형 · 강남 스시", lines: ["네이버 블로그 · 제출 8시간 전 · 재제출 여부 표기", "[게시물 열기 ↗] https://blog.naver.com/…"], pin: 2 },
        { t: "chips", items: [{ label: "광고표기 ✓", kind: "green" }, { label: "사진5+ ✓", kind: "green" }, { label: "본문500+ ✓", kind: "green" }, { label: "30일 유지 ✓", kind: "green" }], pin: 3 },
        { t: "btn", label: "검수 통과", kind: "dark", pin: 4 },
        { t: "input", label: "반려 사유 — 체험자 화면에 그대로 표시되어 재작성 근거가 됩니다 (최대 500자)", pin: 5 },
        { t: "btn", label: "반려 확정", kind: "ghost", pin: 6 },
      ],
    },
  ],
  desc: [
    ["1", "표시", "통계 카드", "검수 대기 = review_submitted 수. admin 세션이 아니면 /admin/login으로 redirect (인증 게이트).", "비 admin 401", "AD-00b"],
    ["2", "표시", "검수 항목 카드", "익명 #last4 · 등급 · 캠페인 종류 · 채널 · 제출 시각 · 게시물 URL 새 탭. 재제출 건은 \"후기 재제출\" 알림으로 다시 큐에 등장.", "—", "—"],
    ["3", "표시", "자가점검 칩", "채널별 CHANNEL_REVIEW_CONDITIONS 키 렌더 (블로그 4종 / 인스타 4종 / 틱톡 4종) + 광고표기(adNoticeConfirmed — 서버 보존값). 운영팀은 실제 게시물과 대조.", "—", "R-04a ⑦"],
    ["4", "액션", "[검수 통과]", "decide { decision:\"approve\" } → completed · reviewer.completedReviews +1 (등급 반영) · 체험자/사장님 양측 알림 · 목록에서 제거.", "이미 처리된 건 400", "—"],
    ["5", "입력", "반려 사유", "최대 500자. 미입력 시 \"작성 조건 미충족\" 기본값. rejectReason·rejectedAt으로 pass에 구조화 보존 — 체험자 화면·알림에 원문 노출 (분쟁 근거).", "—", "R-04a ⑧"],
    ["6", "액션", "[반려 확정]", "decide { decision:\"reject\", reason } → rejected. 체험자는 반려 후 72h 내 1회 재제출 가능(기자단은 캠페인 종료 전). 2차 반려는 종착 — 고객센터 경로만.", "—", "R-04a ⑧"],
  ],
  exceptions: [
    ["운영팀 미로그인", "\"운영팀 로그인 필요\"", "401 → /admin/login"],
    ["검수 대기 아닌 상태", "\"검수 대기 상태의 후기만 처리할 수 있습니다\"", "400"],
    ["decision 값 오류", "\"decision은 approve 또는 reject\"", "400"],
    ["사장님이 직접 검수 시도", "(경로 없음 — /api/passes/approve)", "410 Gone (정책 §6.7)"],
  ],
  states: [["대기 큐", "gray"], ["통과 → completed", "green"], ["반려 → rejected (재제출 1회)", "red"], ["재제출 → 재검수", "blue"]],
  data: [
    "POST /api/admin/reviews/decide — { passId, decision: approve|reject, reason? } · admin 세션 전용",
    "approve: completed + completedReviews++ · reject: rejectReason(≤500)·rejectedAt 보존 · 양측 알림 발행",
    "검수 SLA 최대 72시간 (체험자 안내 카피와 동일) · admin 계정은 보상/화면 대상에서 제외",
  ],
  changelog: [["2026-07-06", "1.0", "VER.1 최초 작성 — 반려 사유 보존·노출, 1회 재제출 정책(v3.0) 반영", "PO"]],
};
