// Guide 페이지(0:1) 섹션 5 — 화면 인벤토리 & 작성 현황
// use_figma에 그대로 붙여넣어 실행 (guide 프레임 15:11에 이어붙임)
const FK = {
  krR: { family: "Noto Sans KR", style: "Regular" },
  krB: { family: "Noto Sans KR", style: "Bold" },
  inB: { family: "Inter", style: "Bold" },
};
for (const f of Object.values(FK)) await figma.loadFontAsync(f);
const C = {
  ink: { r: 0.078, g: 0.078, b: 0.086 }, text: { r: 0.11, g: 0.11, b: 0.12 }, sub: { r: 0.43, g: 0.43, b: 0.45 },
  hair: { r: 0.925, g: 0.925, b: 0.945 }, indigo: { r: 0.369, g: 0.416, b: 0.824 }, white: { r: 1, g: 1, b: 1 },
  green: { r: 0.12, g: 0.5, b: 0.26 },
};
const sol = (c) => [{ type: "SOLID", color: c }];
function txt(str, font, size, color, w) {
  const t = figma.createText();
  t.fontName = font; t.characters = str; t.fontSize = size; t.fills = sol(color);
  t.lineHeight = { unit: "PERCENT", value: 150 };
  if (w) { t.textAutoResize = "HEIGHT"; t.resize(w, t.height); }
  return t;
}
const guide = await figma.getNodeByIdAsync("15:11");
const s = figma.createAutoLayout("VERTICAL", { name: "section · 인벤토리", itemSpacing: 12 });
guide.appendChild(s); s.layoutSizingHorizontal = "FILL";
const tRow = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 10, counterAxisAlignItems: "CENTER" });
s.appendChild(tRow);
const bar = figma.createRectangle(); bar.resize(4, 18); bar.fills = sol(C.indigo); bar.cornerRadius = 2;
tRow.appendChild(bar);
tRow.appendChild(txt("5 · 화면 인벤토리 & 설계서 작성 현황 (PRD §3)", FK.krB, 18, C.text));
const widths = [70, 320, 300, 180, 250];
const head = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 12 });
s.appendChild(head); head.layoutSizingHorizontal = "FILL";
head.paddingTop = head.paddingBottom = 8; head.paddingLeft = 14; head.paddingRight = 14;
head.fills = sol(C.ink); head.cornerRadius = 8;
["ID", "화면명", "라우트", "설계서", "비고"].forEach((h, i) => head.appendChild(txt(h, FK.krB, 12, C.white, widths[i])));
const rows = [
  ["R-00", "가입·온보딩 (3-step + 필수 동의)", "/r/signup", "✅ 01 페이지", "약관·개인정보 동의 서버 검증"],
  ["R-00b", "로그인", "/r/login", "⬜ 미작성", ""],
  ["R-01", "홈 (큐레이팅)", "/r/home", "⬜ 미작성", "B급 카피 가이드 PRD §5.5"],
  ["R-02", "탐색 (리스트+지도)", "/r/explore", "⬜ 미작성", ""],
  ["R-03", "매장 상세 · 채널 선택 참여", "/r/store/[id]", "✅ 01 페이지", "채널별 등급·지원금 자동 계산"],
  ["R-04", "내 체험권 (방문형/기자단 탭)", "/r/passes", "⬜ 미작성", "7-상태 라벨"],
  ["R-04a", "체험권 상세 (상태 분기 + 리뷰 폼)", "/r/passes/[id]", "✅ 01 페이지", "R-05 리뷰 폼 포함"],
  ["R-06", "등급", "/r/grade", "⬜ 미작성", "채널별 등급·배율 공개"],
  ["R-06b", "혜택 (바이럴)", "/r/rewards", "⬜ 미작성", "실데이터 카운터"],
  ["R-07", "MY (+회원 탈퇴)", "/r/me", "⬜ 미작성", "약관 링크·탈퇴 2단 확인"],
  ["R-08a/09", "기자단 브리프·작성", "/r/press/[id](/write)", "⬜ 미작성", "반려 재제출 = 캠페인 종료 전"],
  ["R-10/11", "친구 초대 · 피추천자 랜딩", "/r/invite/new · /r/i/[token]", "⬜ 미작성", ""],
  ["W-01", "환영 박스", "/welcome/box", "⬜ 미작성", "보상 3종 실사용"],
  ["L-01/02", "이용약관·개인정보처리방침", "/legal/terms · /legal/privacy", "⬜ 미작성", "비로그인 접근"],
  ["O-00", "사장님 홈", "/o/home", "⬜ 미작성", ""],
  ["O-00b", "사장님 로그인·가입", "/o/login · /o/signup", "⬜ 미작성", "필수 동의 2종"],
  ["O-01", "후기 모니터링 (조회 전용)", "/o/reviews", "⬜ 미작성", "/api/passes/approve = 410"],
  ["O-02", "사용 처리 (QR/4자리)", "/o/scan", "✅ 02 페이지", "지원금 한도·부스트 자동"],
  ["O-03", "성과 리포트", "/o/report", "⬜ 미작성", ""],
  ["O-04", "더보기 (+탈퇴)", "/o/me", "⬜ 미작성", ""],
  ["O-10", "새 캠페인", "/o/campaign/new", "✅ 02 페이지", "자동 분배·quota 보너스"],
  ["O-11/12", "사용 로그 · 매장 정보", "/o/logs · /o/stores", "⬜ 미작성", ""],
  ["O-14", "멤버십 / 구독", "/o/membership", "⬜ 미작성", "PG 연동 지점 PRD §12.3"],
  ["AD-00b", "운영팀 로그인", "/admin/login", "⬜ 미작성", ""],
  ["AD-01", "후기 검수 콘솔", "/admin/reviews", "✅ 02 페이지", "반려 사유 보존·재제출 1회"],
];
for (const cells of rows) {
  const r = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 12 });
  s.appendChild(r); r.layoutSizingHorizontal = "FILL";
  r.paddingTop = r.paddingBottom = 7; r.paddingLeft = 14; r.paddingRight = 14;
  r.strokes = sol(C.hair); r.strokeBottomWeight = 1; r.strokeTopWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0;
  const done = cells[3].startsWith("✅");
  cells.forEach((c, i) => {
    const font = i === 0 ? FK.inB : (i === 3 && done ? FK.krB : FK.krR);
    const color = i === 0 ? C.indigo : (i === 3 && done ? C.green : (i >= 3 ? C.sub : C.text));
    r.appendChild(txt(c, font, 12.5, color, widths[i]));
  });
}
return { inventoryRows: rows.length, guideHeight: guide.height };
