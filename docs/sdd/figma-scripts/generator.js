// ─────────────────────────────────────────────────────────────
// CATCHPASS 화면설계서 BOARD 생성기 (공용)
// 사용: data/*.js 의 `const DATA = {...}` 뒤에 이 파일을 이어붙여
//       Figma MCP `use_figma` 코드로 1회 실행 (build.sh가 자동 결합)
// 전제: AnnotationPin 컴포넌트 = 노드 4:2 (📕 00 페이지)
// ─────────────────────────────────────────────────────────────

const FK = {
  krR: { family: "Noto Sans KR", style: "Regular" },
  krM: { family: "Noto Sans KR", style: "Medium" },
  krB: { family: "Noto Sans KR", style: "Bold" },
  inB: { family: "Inter", style: "Bold" },
  inM: { family: "Inter", style: "Medium" },
};
for (const f of Object.values(FK)) await figma.loadFontAsync(f);

const C = {
  ink: { r: 0.078, g: 0.078, b: 0.086 },
  text: { r: 0.11, g: 0.11, b: 0.12 },
  sub: { r: 0.43, g: 0.43, b: 0.45 },
  faint: { r: 0.62, g: 0.62, b: 0.65 },
  hair: { r: 0.925, g: 0.925, b: 0.945 },
  bgSoft: { r: 0.961, g: 0.961, b: 0.969 },
  indigo: { r: 0.369, g: 0.416, b: 0.824 },
  white: { r: 1, g: 1, b: 1 },
  red: { r: 0.82, g: 0.2, b: 0.16 }, redBg: { r: 0.99, g: 0.93, b: 0.92 },
  green: { r: 0.12, g: 0.5, b: 0.26 }, greenBg: { r: 0.9, g: 0.97, b: 0.92 },
  blue: { r: 0, g: 0.38, b: 0.76 }, blueBg: { r: 0.9, g: 0.94, b: 0.99 },
  amber: { r: 0.78, g: 0.44, b: 0.03 }, amberBg: { r: 1, g: 0.95, b: 0.85 },
  mockBorder: { r: 0.85, g: 0.85, b: 0.88 },
  imgGray: { r: 0.9, g: 0.9, b: 0.92 },
};
const sol = (c) => [{ type: "SOLID", color: c }];
const TONE = {
  gray: [C.bgSoft, C.sub], blue: [C.blueBg, C.blue], green: [C.greenBg, C.green],
  red: [C.redBg, C.red], amber: [C.amberBg, C.amber], indigo: [C.indigo, C.white],
};

function txt(str, font, size, color, w, lh) {
  const t = figma.createText();
  t.fontName = font; t.characters = String(str); t.fontSize = size; t.fills = sol(color);
  t.lineHeight = { unit: "PERCENT", value: lh || 148 };
  if (w) { t.textAutoResize = "HEIGHT"; t.resize(w, t.height); }
  return t;
}
function chip(label, tone, size) {
  const [bg, fg] = TONE[tone] || TONE.gray;
  const c = figma.createAutoLayout("HORIZONTAL", { name: "chip" });
  c.paddingLeft = c.paddingRight = 10; c.paddingTop = c.paddingBottom = 4;
  c.cornerRadius = 999; c.fills = sol(bg);
  c.appendChild(txt(label, FK.krM, size || 11.5, fg));
  return c;
}

// ── 대상 페이지로 이동 ──
const page = await figma.getNodeByIdAsync(DATA.pageId);
await figma.setCurrentPageAsync(page);

// ── BOARD 루트 ──
const board = figma.createAutoLayout("VERTICAL", { name: "BOARD · " + DATA.id, itemSpacing: 22 });
board.x = DATA.x || 0; board.y = DATA.y || 0;
board.paddingLeft = board.paddingRight = 40; board.paddingTop = board.paddingBottom = 40;
board.fills = sol(C.white); board.cornerRadius = 24;
board.resize(1360, board.height);
board.primaryAxisSizingMode = "AUTO"; board.counterAxisSizingMode = "FIXED";
page.appendChild(board);

// ── DocHeader ──
const hdr = figma.createAutoLayout("HORIZONTAL", { name: "DocHeader", itemSpacing: 12, counterAxisAlignItems: "CENTER" });
board.appendChild(hdr); hdr.layoutSizingHorizontal = "FILL";
hdr.paddingLeft = hdr.paddingRight = 22; hdr.paddingTop = hdr.paddingBottom = 15;
hdr.fills = sol(C.ink); hdr.cornerRadius = 14;
hdr.primaryAxisAlignItems = "SPACE_BETWEEN";
const hl = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 12, counterAxisAlignItems: "CENTER" });
hdr.appendChild(hl);
const idChip = figma.createAutoLayout("HORIZONTAL");
idChip.paddingLeft = idChip.paddingRight = 10; idChip.paddingTop = idChip.paddingBottom = 4;
idChip.cornerRadius = 7; idChip.fills = sol(C.indigo);
idChip.appendChild(txt(DATA.id, FK.inB, 13, C.white));
hl.appendChild(idChip);
hl.appendChild(txt(DATA.title, FK.krB, 16, C.white));
const routeChip = figma.createAutoLayout("HORIZONTAL");
routeChip.paddingLeft = routeChip.paddingRight = 9; routeChip.paddingTop = routeChip.paddingBottom = 3;
routeChip.cornerRadius = 6; routeChip.fills = [{ type: "SOLID", color: C.white, opacity: 0.12 }];
routeChip.appendChild(txt(DATA.route, FK.inM, 11.5, { r: 0.8, g: 0.82, b: 0.9 }));
hl.appendChild(routeChip);
const hr = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 14, counterAxisAlignItems: "CENTER" });
hdr.appendChild(hr);
for (const m of [DATA.device, "Ver " + DATA.ver, DATA.date, "작성 " + DATA.author, DATA.prdRef]) {
  hr.appendChild(txt(m, FK.krR, 11.5, { r: 0.66, g: 0.66, b: 0.7 }));
}
const stChip = figma.createAutoLayout("HORIZONTAL");
stChip.paddingLeft = stChip.paddingRight = 10; stChip.paddingTop = stChip.paddingBottom = 4;
stChip.cornerRadius = 999; stChip.fills = sol({ r: 0.16, g: 0.35, b: 0.22 });
stChip.appendChild(txt(DATA.status, FK.krM, 11.5, { r: 0.65, g: 0.92, b: 0.72 }));
hr.appendChild(stChip);

// ── body: 좌 목업 / 우 설명 ──
const body = figma.createAutoLayout("HORIZONTAL", { name: "body", itemSpacing: 34 });
board.appendChild(body); body.layoutSizingHorizontal = "FILL";
const leftCol = figma.createAutoLayout("VERTICAL", { name: "left · mockup", itemSpacing: 14 });
body.appendChild(leftCol);
const rightCol = figma.createAutoLayout("VERTICAL", { name: "right · description", itemSpacing: 22 });
body.appendChild(rightCol); rightCol.layoutSizingHorizontal = "FILL";

// ── 목업 블록 DSL ──
// AnnotationPin 인라인 생성 (파일에 마스터 컴포넌트가 없어도 자체 완결)
function makePin(n) {
  const f = figma.createFrame();
  f.resize(24, 24); f.cornerRadius = 999;
  f.fills = sol(C.indigo); f.strokes = sol(C.white); f.strokeWeight = 2;
  f.layoutMode = "NONE"; f.clipsContent = false;
  const t = txt(String(n), FK.inB, 12, C.white);
  f.appendChild(t); t.x = (24 - t.width) / 2; t.y = (24 - t.height) / 2;
  return f;
}
function buildMock(mk) {
  const mock = figma.createAutoLayout("VERTICAL", { name: "MOCKUP · " + mk.name, itemSpacing: 10 });
  leftCol.appendChild(mock);
  mock.resize(390, mock.height);
  mock.counterAxisSizingMode = "FIXED"; mock.primaryAxisSizingMode = "AUTO";
  mock.paddingLeft = mock.paddingRight = 16; mock.paddingTop = mock.paddingBottom = 18;
  mock.fills = sol(C.white); mock.cornerRadius = 20;
  mock.strokes = sol(C.mockBorder); mock.strokeWeight = 1.5;
  const pinTargets = [];
  const W = 390 - 32;
  for (const b of mk.blocks) {
    let node = null;
    if (b.t === "bar") {
      node = figma.createAutoLayout("HORIZONTAL", { counterAxisAlignItems: "CENTER" });
      mock.appendChild(node); node.layoutSizingHorizontal = "FILL";
      node.primaryAxisAlignItems = "SPACE_BETWEEN";
      node.paddingTop = node.paddingBottom = 6;
      node.appendChild(txt(b.left || "‹ 뒤로", FK.krM, 12, C.blue));
      node.appendChild(txt(b.label || "", FK.krM, 12, C.text));
      node.appendChild(txt(b.right || " ", FK.krR, 12, C.sub));
    } else if (b.t === "h") {
      node = txt(b.text, FK.krB, b.size || 20, b.dark ? C.white : C.text, W); mock.appendChild(node);
    } else if (b.t === "p") {
      node = txt(b.text, FK.krR, b.size || 12, b.dark ? { r: 0.75, g: 0.75, b: 0.78 } : C.sub, W); mock.appendChild(node);
    } else if (b.t === "input") {
      node = figma.createAutoLayout("HORIZONTAL", { counterAxisAlignItems: "CENTER" });
      mock.appendChild(node); node.layoutSizingHorizontal = "FILL";
      node.paddingLeft = node.paddingRight = 14; node.paddingTop = node.paddingBottom = 12;
      node.cornerRadius = 10; node.strokes = sol(C.mockBorder); node.strokeWeight = 1; node.fills = sol(C.white);
      node.appendChild(txt(b.label, FK.krR, 13, C.faint));
    } else if (b.t === "btn") {
      node = figma.createAutoLayout("HORIZONTAL", { counterAxisAlignItems: "CENTER" });
      mock.appendChild(node); node.layoutSizingHorizontal = "FILL";
      node.primaryAxisAlignItems = "CENTER";
      node.paddingTop = node.paddingBottom = 13; node.cornerRadius = 999;
      const kind = b.kind || "primary";
      if (kind === "primary") { node.fills = sol(C.blue); }
      else if (kind === "dark") { node.fills = sol(C.ink); }
      else if (kind === "disabled") { node.fills = sol(C.bgSoft); }
      else { node.fills = sol(C.white); node.strokes = sol(C.mockBorder); node.strokeWeight = 1; }
      node.appendChild(txt(b.label, FK.krM, 14, kind === "disabled" ? C.faint : (kind === "ghost" ? C.blue : C.white)));
    } else if (b.t === "check") {
      node = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 8, counterAxisAlignItems: "CENTER" });
      mock.appendChild(node); node.layoutSizingHorizontal = "FILL";
      const box = figma.createRectangle(); box.resize(16, 16); box.cornerRadius = 4;
      box.fills = b.checked ? sol(C.blue) : sol(C.white);
      box.strokes = sol(b.checked ? C.blue : C.mockBorder); box.strokeWeight = 1.5;
      node.appendChild(box);
      node.appendChild(txt(b.label, FK.krR, 12.5, C.text, W - 26));
    } else if (b.t === "card") {
      node = figma.createAutoLayout("VERTICAL", { itemSpacing: 6 });
      mock.appendChild(node); node.layoutSizingHorizontal = "FILL";
      node.paddingLeft = node.paddingRight = 14; node.paddingTop = node.paddingBottom = 12;
      node.cornerRadius = 12;
      node.fills = sol(b.dark ? C.ink : C.bgSoft);
      if (b.title) node.appendChild(txt(b.title, FK.krB, b.big ? 22 : 13, b.dark ? C.white : C.text, W - 28));
      for (const ln of b.lines || []) node.appendChild(txt(ln, FK.krR, 11.5, b.dark ? { r: 0.72, g: 0.72, b: 0.76 } : C.sub, W - 28));
    } else if (b.t === "chips") {
      node = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 6 });
      mock.appendChild(node);
      for (const it of b.items) node.appendChild(chip(it.label, it.kind || "gray", 11));
    } else if (b.t === "img") {
      node = figma.createFrame(); node.resize(W, b.h || 120);
      node.fills = sol(C.imgGray); node.cornerRadius = 12;
      mock.appendChild(node);
      const cap = txt(b.label || "이미지", FK.krR, 11, C.faint);
      node.appendChild(cap); cap.x = (W - cap.width) / 2; cap.y = ((b.h || 120) - cap.height) / 2;
    } else if (b.t === "qr") {
      node = figma.createFrame(); node.resize(120, 120);
      node.fills = sol(C.white); node.strokes = sol(C.text); node.strokeWeight = 2; node.cornerRadius = 8;
      mock.appendChild(node);
      const q = txt("QR", FK.inB, 26, C.text); node.appendChild(q);
      q.x = (120 - q.width) / 2; q.y = (120 - q.height) / 2;
    } else if (b.t === "divider") {
      node = figma.createRectangle(); node.resize(W, 1); node.fills = sol(C.hair);
      mock.appendChild(node);
    } else if (b.t === "kv") {
      node = figma.createAutoLayout("VERTICAL", { itemSpacing: 5 });
      mock.appendChild(node); node.layoutSizingHorizontal = "FILL";
      for (const [k, v] of b.pairs) {
        const r = figma.createAutoLayout("HORIZONTAL", { counterAxisAlignItems: "CENTER" });
        node.appendChild(r); r.layoutSizingHorizontal = "FILL";
        r.primaryAxisAlignItems = "SPACE_BETWEEN";
        r.appendChild(txt(k, FK.krR, 12, C.sub));
        r.appendChild(txt(v, FK.krM, 12, C.text));
      }
    } else if (b.t === "pill") {
      node = chip(b.label, b.kind || "gray", 11.5);
      mock.appendChild(node);
    }
    if (node && b.pin) pinTargets.push({ node, n: b.pin });
  }
  // 핀 부착 — 요소 우측 상단, 절대 배치
  for (const { node, n } of pinTargets) {
    const pin = makePin(n);
    mock.appendChild(pin);
    pin.layoutPositioning = "ABSOLUTE";
    const yOff = node.absoluteTransform[1][2] - mock.absoluteTransform[1][2];
    pin.x = 390 - 34; pin.y = Math.max(4, yOff - 3);
  }
  return mock;
}
for (const mk of DATA.mockups) {
  buildMock(mk);
  const cap = txt("▲ " + mk.caption, FK.krR, 11, C.faint, 390);
  cap.textAlignHorizontal = "CENTER";
  leftCol.appendChild(cap);
}

// ── 우측 섹션 헬퍼 ──
function sectionTitle(label) {
  const tRow = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 8, counterAxisAlignItems: "CENTER" });
  rightCol.appendChild(tRow);
  const bar = figma.createRectangle(); bar.resize(4, 15); bar.fills = sol(C.indigo); bar.cornerRadius = 2;
  tRow.appendChild(bar);
  tRow.appendChild(txt(label, FK.krB, 15, C.text));
}
function table(headers, widths, rows, rowFont) {
  const tb = figma.createAutoLayout("VERTICAL", { name: "table" });
  rightCol.appendChild(tb); tb.layoutSizingHorizontal = "FILL";
  tb.cornerRadius = 10; tb.strokes = sol(C.hair); tb.strokeWeight = 1;
  const mkRow = (cells, isHead) => {
    const r = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 10 });
    tb.appendChild(r); r.layoutSizingHorizontal = "FILL";
    r.paddingLeft = r.paddingRight = 12; r.paddingTop = r.paddingBottom = isHead ? 8 : 9;
    if (isHead) { r.fills = sol(C.bgSoft); }
    else { r.strokes = sol(C.hair); r.strokeTopWeight = 1; r.strokeBottomWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0; }
    cells.forEach((c, i) => {
      const isNo = !isHead && i === 0;
      const f = isHead ? FK.krB : (isNo ? FK.inB : (rowFont || FK.krR));
      const col = isHead ? C.sub : (isNo ? C.indigo : (i === cells.length - 1 ? C.sub : C.text));
      r.appendChild(txt(c, f, isHead ? 11.5 : 12, col, widths[i]));
    });
  };
  mkRow(headers, true);
  for (const row of rows) mkRow(row, false);
  return tb;
}

// Description 표 (6열, 합 762 + gap/padding = 836)
sectionTitle("Description · 화면 구성요소 정의");
table(["No.", "구분", "명칭", "기능 및 설명", "예외 · 상태", "이동 · 연관"], [30, 52, 122, 322, 152, 84], DATA.desc);

// 예외·유효성 표
sectionTitle("예외처리 · 유효성 시나리오");
table(["상황", "노출 문구 (실제 카피)", "처리"], [186, 420, 156], DATA.exceptions);

// 상태 칩
sectionTitle("상태(State) · 화면 전환");
const stRow = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 8 });
rightCol.appendChild(stRow);
stRow.layoutWrap = "WRAP"; stRow.layoutSizingHorizontal = "FILL"; stRow.counterAxisSpacing = 8;
for (const [label, tone] of DATA.states) stRow.appendChild(chip(label, tone, 12));

// 데이터 · 연동
const dn = figma.createAutoLayout("VERTICAL", { name: "DataNote", itemSpacing: 6 });
rightCol.appendChild(dn); dn.layoutSizingHorizontal = "FILL";
dn.paddingLeft = dn.paddingRight = 16; dn.paddingTop = dn.paddingBottom = 14;
dn.fills = sol(C.bgSoft); dn.cornerRadius = 12;
dn.appendChild(txt("데이터 · 연동", FK.krB, 13, C.text));
for (const ln of DATA.data) dn.appendChild(txt(ln, FK.krR, 12, C.sub, 804));

// 변경이력
const cl = figma.createAutoLayout("VERTICAL", { name: "Changelog", itemSpacing: 0 });
board.appendChild(cl); cl.layoutSizingHorizontal = "FILL";
const clHead = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 10 });
cl.appendChild(clHead); clHead.layoutSizingHorizontal = "FILL";
clHead.paddingTop = clHead.paddingBottom = 6; clHead.paddingLeft = 12;
["일자", "Ver", "변경 내용", "작성자"].forEach((h, i) => clHead.appendChild(txt(h, FK.krB, 11, C.sub, [90, 46, 980, 100][i])));
for (const row of DATA.changelog) {
  const r = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 10 });
  cl.appendChild(r); r.layoutSizingHorizontal = "FILL";
  r.paddingTop = r.paddingBottom = 6; r.paddingLeft = 12;
  r.strokes = sol(C.hair); r.strokeTopWeight = 1; r.strokeBottomWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0;
  row.forEach((c, i) => r.appendChild(txt(c, FK.krR, 11.5, C.sub, [90, 46, 980, 100][i])));
}

await board.screenshot();
return { boardId: board.id, name: board.name, page: page.name, height: board.height };
