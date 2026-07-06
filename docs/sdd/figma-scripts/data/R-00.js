// R-00 · 가입·온보딩 — 화면설계서 데이터 (PRD v3.0 §3.1 / §4-A / §6.1 / §14)
const DATA = {
  pageId: "14:13", x: 0, y: 0,
  id: "R-00", title: "가입 · 온보딩 (3-Step + 필수 동의)", route: "/r/signup",
  device: "Mobile Web 480", ver: "1.0", date: "2026-07-06", author: "PO",
  status: "작성완료", prdRef: "PRD §4-A · §6.1 · §14",
  mockups: [
    {
      name: "R-00 · Step 1 (계정 + 동의)", caption: "Step 1 — 계정 생성 + 필수 동의 2종",
      blocks: [
        { t: "bar", left: "← 이전", label: "1 / 2", right: " " },
        { t: "h", text: "계정 만들기", size: 22 },
        { t: "p", text: "이메일과 닉네임만 있으면 바로 시작할 수 있어요." },
        { t: "input", label: "이메일", pin: 1 },
        { t: "input", label: "비밀번호 (6자 이상)", pin: 2 },
        { t: "input", label: "닉네임", pin: 3 },
        { t: "check", label: "(필수) 이용약관에 동의합니다 → /legal/terms 새 탭", checked: true, pin: 4 },
        { t: "check", label: "(필수) 개인정보 수집·이용에 동의합니다 → /legal/privacy 새 탭", checked: true, pin: 5 },
        { t: "btn", label: "다음", kind: "primary", pin: 6 },
      ],
    },
    {
      name: "R-00 · Step 2 (SNS 연동)", caption: "Step 2 — 채널 연동 (채널별 등급 산정)",
      blocks: [
        { t: "bar", left: "← 이전", label: "2 / 2", right: " " },
        { t: "h", text: "SNS 채널 연동", size: 22 },
        { t: "p", text: "채널 영향력을 분석해 등급을 산정합니다. 1개 이상 연동을 권장합니다." },
        { t: "card", title: "네이버 블로그 · 일방문자 수치 기반", lines: ["URL 입력 + 일방문자 수 (숫자만)"], pin: 7 },
        { t: "card", title: "인스타그램 · 팔로워 수치 기반", lines: ["URL 입력 + 팔로워 수 (숫자만)"] },
        { t: "card", title: "틱톡 · 팔로워 수치 기반", lines: ["URL 입력 + 팔로워 수 (숫자만)"] },
        { t: "btn", label: "연동 후 시작하기", kind: "primary", pin: 8 },
        { t: "btn", label: "연동 없이 시작 (N등급)", kind: "ghost", pin: 9 },
      ],
    },
  ],
  desc: [
    ["1", "입력", "이메일", "가입 식별자. 소문자 트림 후 저장. 중복 검사는 서버에서 수행.", "중복 시 409", "—"],
    ["2", "입력", "비밀번호", "6자 이상. bcrypt 단방향 해시로만 저장 (평문 저장 금지).", "6자 미만 클라+서버 400", "—"],
    ["3", "입력", "닉네임", "매장·검수 화면에서는 노출되지 않고 익명 #last4 정책 적용 (PRD §6.6).", "미입력 시 진행 불가", "—"],
    ["4", "동의", "이용약관 (필수)", "체크 필수. 라벨의 링크는 /legal/terms 새 탭 (비로그인 접근 가능).", "미동의 시 [다음] 차단", "L-01"],
    ["5", "동의", "개인정보 수집·이용 (필수)", "체크 필수. 서버도 agreeTerms를 재검증하고 동의 시각을 termsAgreedAt으로 기록 (개인정보보호법 §22).", "누락 시 서버 400", "L-02"],
    ["6", "액션", "버튼 [다음]", "1~5 클라이언트 검증 통과 시 Step 2로 전환. 이 시점엔 서버 호출 없음.", "검증 실패 시 인라인 에러", "Step 2"],
    ["7", "입력", "채널 카드 ×3", "블로그/인스타/틱톡 3종 한정 (유튜브 없음). URL+영향력 수치 직접 입력. 채널별 독립 등급: 가중 영향력(블로그 ×1.2) A≥50,000 / B≥10,000 / C≥1,000 / N 미만. 종합 등급 = 최상위 채널.", "0개 연동 허용 (→⑨)", "R-06 등급"],
    ["8", "액션", "[연동 후 시작하기]", "POST /api/auth/signup 호출. 성공 시 세션 쿠키(httpOnly, 30d) 발급. ?invite=토큰 보존 시 /welcome/box?token=…으로, 없으면 /r/home.", "우측 예외 표 참조", "R-01 / W-01"],
    ["9", "액션", "[연동 없이 시작]", "sns 빈 배열로 가입 → N등급 (지원금 배율 10%). 등급 탭에서 상향 경로 안내.", "—", "R-01"],
  ],
  exceptions: [
    ["필수 동의 미체크", "\"이용약관과 개인정보 수집·이용에 동의해주세요\"", "클라 차단 + 서버 400"],
    ["이메일 중복", "\"이미 가입된 이메일입니다\"", "409"],
    ["비밀번호 6자 미만", "\"비밀번호는 6자 이상이어야 합니다\"", "400"],
    ["필드 누락", "\"모든 항목을 입력해주세요\"", "클라 인라인"],
    ["invite 토큰 만료(14일)", "랜딩(R-11)에서 \"14일이 지났어요…\" — 가입은 정상 진행", "보상만 미발행"],
  ],
  states: [
    ["Step 0 · 컨셉 히어로", "gray"], ["Step 1 · 계정+동의", "blue"], ["Step 2 · SNS 연동", "blue"],
    ["가입 완료 → /r/home", "green"], ["invite 보유 → /welcome/box", "green"],
  ],
  data: [
    "POST /api/auth/signup — { role:\"reviewer\", email, password, nickname, sns[{kind,url,influence}], agreeTerms:true }",
    "응답 200 { ok, grade } · 저장: passwordHash(bcrypt) · channelGrades(channelGradesFromSns) · grade(bestGrade) · termsAgreedAt",
    "등급 lib: src/lib/grade.ts — 블로그 가중치 1.2 · 임계 50k/10k/1k · 배율 S100/A80/B60/C40/N10 (PRD §6.1)",
  ],
  changelog: [["2026-07-06", "1.0", "VER.1 최초 작성 — v3.0 필수 동의(약관·개인정보) 단계 반영", "PO"]],
};
