---
description: 현재 프로젝트의 프로토타입/앱을 분석해 Figma에 레퍼런스 품질의 화면설계서(스토리보드)를 작성합니다. Figma 미연동·권한 부족 시 연동 안내까지 진행합니다.
argument-hint: "[편집 가능한 Figma 파일 URL] [화면 범위: 전체|화면명|화면ID]"
---

당신은 이 프로젝트의 프로토타입을 분석하여 **Figma에 실제로 화면설계서(= 화면정의서 = 스토리보드)** 를 그리는 작업을 수행합니다.
입력 인자: `$ARGUMENTS` — (선택) 편집 가능한 Figma 파일 URL과/또는 문서화할 화면 범위. 비어 있으면 아래 절차에서 사용자에게 확인합니다.

---

## 0단계 — Figma 연동 확인 & 자동화 (반드시 먼저)

1. **Figma MCP 도구 로드**: `ToolSearch`로 `select:mcp__Figma__whoami,mcp__Figma__get_metadata,mcp__Figma__get_screenshot,mcp__Figma__use_figma,mcp__Figma__create_new_file` 를 로드한다(서버가 연결 중이면 ToolSearch가 대기).
2. **도구가 없으면(= Figma 커넥터 미연결) 연동 자동화**:
   - `ToolSearch`로 `select:ListConnectors,SuggestConnectors,SearchMcpRegistry` 를 로드.
   - `ListConnectors`로 현재 연결 상태 확인 → Figma가 없으면 `SuggestConnectors`(필요 시 `SearchMcpRegistry`로 Figma 검색)로 **사용자에게 Figma 커넥터 연결을 요청**한다. 연결 전에는 진행할 수 없음을 알리고, 연결되면 1번부터 재시도.
3. **인증·편집 권한 확인**:
   - `mcp__Figma__whoami` 로 로그인 계정과 좌석(seat)을 확인.
   - 대상 파일 URL에서 `fileKey`를 추출(`/design/:fileKey/...`)하고 `mcp__Figma__get_metadata`(nodeId 생략)로 읽기 접근을 확인.
   - **쓰기 불가 신호**(get_metadata가 "no edit access" 반환, 또는 seat이 `View`라 이후 `use_figma` 쓰기 실패가 예상됨)일 때는 사용자에게 안내:
     - "편집 권한(Editor/Dev 좌석) 있는 계정으로 Figma 커넥터를 재연결"하고, **편집 가능한 파일 URL**을 주거나 "새 파일 생성"을 지시해 달라고 요청.
     - 새 파일 생성 지시 시 `mcp__Figma__create_new_file`(editorType `design`, whoami의 plan `key`를 planKey로) 사용. 단, 이 역시 편집 좌석이 필요.
   - **읽기+쓰기 가능**이 확인되면 즉시 다음 단계로 진행(추가 질문 없이).
4. **`use_figma` 사용 전 필수**: `ReadMcpResourceTool(server:"Figma", uri:"skill://figma/figma-use/SKILL.md")` 로 figma-use 스킬을 로드하고 규칙을 따른다. 모든 `use_figma` 호출에 `skillNames:"resource:figma-use"` 를 전달.

---

## 1단계 — 프로토타입 분석

- 저장소 코드를 읽어 **화면 목록·플로우·상태·컴포넌트·디자인 토큰**을 파악한다(예: 라우트/페이지, 상태머신, 컴포넌트, `DESIGN.md`/전역 CSS의 색·폰트 토큰).
- 화면마다 다음을 도출: 구성 요소, 동작/인터랙션, 이벤트, **예외처리(유효성·에러 메시지)**, 데이터/연동(요청·응답·필드·모델), **상태(빈·로딩·에러·성공)**, 이동(내비게이션), 노출/권한 조건.
- 목업은 실제 앱과 동일하게 보이도록 프로젝트의 실제 디자인 토큰(색/폰트/라운드)을 재사용한다.

---

## 2단계 — 화면설계서 표준 (반드시 준수)

**구성 3종 세트**: (좌) 화면 와이어프레임/목업 → 각 요소에 **넘버링 배지 ①②③** → (우) **Description(설명) 표**가 번호와 1:1 매핑.

**정상 케이스뿐 아니라 예외·상태·엣지케이스까지** 반드시 정의(이게 품질을 가른다).

**화면ID 규칙**: `영역코드-일련번호`(예 `HOME-01`, `CAM-01`), 모달/시트는 `.1`(`CAM-01.1`), 상태 변형은 접미사(`PLT-02_empty|_loading|_error`). 화면ID↔화면명 1:1, 삭제 ID 재사용 금지.

**Description 표 컬럼**: `No. · 구분 · 명칭 · 기능 및 설명 · 예외 · 상태 · 이동 · 연관`.
**예외/유효성 시나리오 표 컬럼**: `상황 · 노출 문구(메시지) · 처리`.

**Figma 문서 조직화(전체 작성 시)**: 페이지 `00 Cover` · `01 문서정보/개정이력` · `02 목차` · `03 용어·범례` · `04 사이트맵/IA` · `05 플로우` · `1x Screens(영역별)` · `90 Components` · `99 Scratch`. 개정이력 표 `버전·일자·상세·작성자·비고`, 화면목록 표 `화면ID·화면명·Depth·설명·상태·관련ID`.

---

## 3단계 — Figma 작성 절차 (증분 · 각 단계 후 스크린샷 검증)

**스펙 보드(화면당) 구조**:
- 상단 **다크 헤더 바**: `화면ID` 칩(라벤더) · 화면명 · Depth · Ver · 작성자 · 상태 칩.
- 좌측 **실제 화면 목업**(모바일 375~390px, 앱 실제 색/토큰으로 렌더) + `AnnotationPin` 넘버 배지 오버레이.
- 우측 **Description 표** + **예외/유효성 시나리오 표** + **상태(State) 칩** + **데이터·연동 노트**.

**재사용 컴포넌트(환경)**: 최소 `AnnotationPin`(넘버 텍스트 프로퍼티)을 COMPONENT로 만들고 인스턴스로 배치. 전체 작성 시 Description Row/Table·Scenario Table·Screen Header·State Chip·Sitemap/Flow 노드도 컴포넌트화.

**figma-use 기술 규칙(중요, 실패 예방)**:
- 스크린샷 검증은 `mcp__Figma__get_screenshot` 에 **`enableBase64Response:true`** 로 인라인 수신(이 환경은 figma.com 에셋 호스트로의 egress가 차단되어 URL curl 다운로드가 403).
- 한글 텍스트 폰트는 **`Noto Sans KR`**(스타일 `Regular`/`Medium`/`Bold`/`DemiLight`), 숫자·라틴은 `Inter`. **텍스트 생성/수정 전 해당 폰트를 `await figma.loadFontAsync`** 로 로드.
- 색은 **0–1 범위** `{r,g,b}`. 생성/수정한 **모든 노드 ID를 `return`**. 한 스크립트당 논리 작업 ≤10, `figma.setCurrentPageAsync`는 호출당 최대 1회. 최상위 노드는 (0,0)을 피해 배치.
- 구조적 자식은 `figma.createAutoLayout` 사용, `FILL`/`HUG`는 `appendChild` 이후 설정. 스크립트는 원자적이므로 오류 시 수정 후 재시도.

---

## 4단계 — 범위 & 산출

- 기본 동작: **핵심 화면 1개 샘플**을 먼저 완성해 포맷을 확인받고, 승인 시 **전체**(문서 레벨 프레임 + 나머지 화면 + 컴포넌트 라이브러리)로 확장. `$ARGUMENTS`에 "전체"가 명시되면 바로 전체 진행.
- 완료 시 **Figma 파일 링크(`?node-id=` 포함)** 와 그린 내용을 요약해 보고. 수정 요청(컬럼·용어·화면ID 규칙 등)이 있으면 반영.

**주의**: 이 명령어는 Figma에 실제 쓰기를 수행한다. 대상 파일이 명확하지 않으면 먼저 확인한다. 재료·데이터가 실제 구현과 어긋나면 구현을 우선한다.
