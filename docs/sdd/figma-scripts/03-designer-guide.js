// 03 · 디자이너 작업 가이드 (v1.2) — 6개 보드에 부착된 섹션의 원본 데이터 + 적용 스크립트
// 사용: TARGET을 바꿔가며 use_figma로 보드당 1회 실행 (멱등 — 기존 DesignerGuide 제거 후 재생성)
// 이미 적용됨(2026-07-06): R-01 72559:2(보드 생성 시 내장) · R-00 72552:2 · R-03 72553:2 · R-04a 72554:2 · O-10 72555:2 · O-02 72556:2 · AD-01 72557:2
const TARGET = "R-00"; // ← "R-00" | "R-03" | "R-04a" | "O-10" | "O-02" | "AD-01"

const GUIDES = {
  "R-01": { boardId: "72559:2",
    data: [
      ["지역명","reverse-geocode 동 단위 · 한글 2~6자 · 예 \"북촌\" · brand 색 강조","폴백 시 첫 매장 지역명(예 \"강남\")"],
      ["N곳 카운트","진행 중 캠페인 수 · 정수 0~999","0이면 빈 상태(V4)로 전체 전환"],
      ["큐레이션 카운트 3종","신규(7일 내 생성)/마감(7일 내 종료)/파격(지원금 ≥₩100,000) 각 정수","0이어도 \"0개\" 그대로 표기·탭 가능"],
      ["매장 카드","4:3 실사진 · 매장명(2~20자, 1줄 말줄임) · 카테고리+지역 · 금액 ₩bold(개인화=내 최대 혜택) · 채널 아이콘 블/인/틱 1~3개 · ★평점(소수1)","사진 없음 케이스 없음(카테고리 기본 이미지) · 미자격 금액=기준 지원금"],
      ["도보 칩","\"도보 N분\" · N=1~99 정수","가까운 곳 섹션에서만 좌상단"],
      ["등급 부족 오버레이","\"{필요 등급}등급들만\" + \"몰래 가는 중 🤫\" 2줄 고정 카피 · ink 55%","자격 있으면 미노출"],
      ["알림 dot","미읽음 ≥1 → 종 우상단 brand 원형 dot(8px)","0이면 미노출"],
    ],
    defaults: [
      "진입 즉시 SSR 렌더(스켈레톤·로딩 화면 없음). GPS 권한 프롬프트는 브라우저 기본 UI — 응답 전에는 폴백 지역으로 먼저 그려짐.",
      "BottomNav 홈 탭 활성 · 스크롤 최상단 · 검색바는 입력 불가(탭 전용 트리거).",
      "가까운 곳 = 최대 4개 고정(더 있어도 4개 + [전부 보기]) · 전체 리스트 = 세로 스크롤(캐러셀 아님).",
    ],
    inter: [
      ["검색바 탭","/r/explore 이동(홈에서 입력 없음) — 키보드 미활성"],
      ["[📍 지도] 칩 탭","/r/explore?mode=map — 풀스크린 지도 모드로 직행"],
      ["큐레이션 카드/배너 탭 (필터 동작)","각각 /r/explore?sort=new·closing·topSupport로 이동 — 홈 내 필터링 없음, 탐색으로 위임"],
      ["매장 카드 탭","/r/store/[id] 상세 이동 — 등급 부족 카드도 진입 허용"],
      ["종 아이콘 탭","/r/notifications — 미읽음 dot 소멸은 알림함에서 읽음 처리 후"],
      ["[혜택 보기]/하단 배너 탭","/r/rewards"],
    ],
    variants: [
      ["V1 ★Default","기본(연동 A등급)","개인화 금액·채널 아이콘·오버레이 혼재 리스트"],
      ["V2","N등급·미연동","전 카드 금액=기준 지원금 + 등급 부족 오버레이 다수 상태"],
      ["V3","GPS 폴백","헤드라인 지역=첫 매장 지역(권한 프롬프트 무시/거부 후)"],
      ["V4","빈 상태","\"지금은 동네가 잠깐 쉬는 중\" — 큐레이션·그리드 대신 빈 카드"],
      ["V5","미읽음 알림","종 아이콘 brand dot 상태"],
    ],
    fixedFree: "고정(변경 금지): B급 카피 원문(🤫 포함)·큐레이션 3종 필터 매핑·정렬 규칙 2종·최대 4개 제한·개인화 금액 로직·오버레이 카피. 자유(재량): 타일 파스텔 팔레트·카드 그리드 비주얼·배너 일러스트·스티커 칩 각도.",
  },
  "R-00": { boardId: "72537:2",
    data: [
      ["이메일 input","사용자 입력 · type=email · placeholder \"이메일\" · 예 reviewer@naver.com","1줄 표시(입력 초과분 가로 스크롤) · 빈 값=placeholder"],
      ["비밀번호 input","type=password(● 마스킹) · placeholder \"비밀번호 (6자 이상)\"","최소 6자(미만 에러 M3) · 최대 제한 없음"],
      ["닉네임 input","type=text · placeholder \"닉네임\" · 예 북촌리뷰어","서버 글자수 제한 없음 — 디자인 기준 2~10자, 타 화면 노출부는 말줄임"],
      ["동의 체크 2종","라벨 원문 \"(필수) 이용약관에 동의합니다\" / \"(필수) 개인정보 수집·이용에 동의합니다\" + 밑줄 링크","체크/해제 2상태 · Default 해제 · 링크는 체크 토글과 독립 동작"],
      ["채널 카드 ×3","채널명+지표 라벨(블로그=일방문자, 인스타·틱톡=팔로워) 고정 · URL placeholder \"https://blog.naver.com/...\" 형식 · 영향력 numeric(숫자만)","영향력 0~9,999,999 · URL 입력 시 카드 활성(테두리 brand + ✓ 뱃지)"],
    ],
    defaults: [
      "진입 = Step 0 히어로. [시작하기] 탭 → Step 1 전환(페이지 이동 없음, 같은 라우트).",
      "Step 1 Default: input 3종 모두 빈 값 · 동의 체크 2종 해제 · [다음] 버튼은 항상 탭 가능(탭 시 검증 → 인라인 에러).",
      "Step 2 Default: 채널 3카드 모두 URL·수치 빈 값(비활성 룩). 빈 채널은 제출 시 무시 — 0개 연동이면 N등급.",
    ],
    inter: [
      ["동의 라벨 링크 탭","/legal/terms · /legal/privacy 새 탭 열림 (체크 상태 변화 없음)"],
      ["[다음] 탭","검증 실패 → 해당 input 하단 인라인 에러(red 14px, 원문 M1/M3/\"모든 항목을 입력해주세요\") · 통과 → Step 2 전환"],
      ["채널 URL 입력 시작","해당 카드가 활성 상태로 전환 — 테두리 brand + 우상단 ✓ 원형 뱃지"],
      ["[연동 후 시작하기] 탭","버튼 라벨 \"처리 중...\" + 비활성 → 성공 시 /r/home 이동(초대 토큰 보유 시 /welcome/box) · 실패 시 버튼 위 에러 원문(M2 등)"],
      ["[연동 없이 시작] 탭","확인 모달 없이 즉시 가입(N등급) — 같은 성공 이동 규칙"],
    ],
    variants: [
      ["V1 ★Default","Step 0 히어로","다크 카피 히어로 + [시작하기] + [로그인] 링크"],
      ["V2","Step 1 기본","input 3 + 동의 체크 2(해제) + [다음]"],
      ["V3","Step 1 에러","인라인 에러 텍스트 노출 — 카피는 M1~M3 원문 그대로"],
      ["V4","Step 2 기본","채널 카드 3 비활성(빈 값)"],
      ["V5","Step 2 카드 활성","URL 입력된 카드만 brand 테두리 + ✓ — 혼재 상태(1~3개 활성) 표현"],
      ["V6","제출 로딩","CTA \"처리 중...\" 비활성 상태"],
    ],
    fixedFree: "고정(변경 금지): 카피 원문·검증 규칙(6자·필수 동의)·3-Step 순서·채널 3종. 자유(디자인 재량): 히어로 비주얼·카드/체크박스 스타일·에러 표현 톤(단 인라인 위치 유지)·Step 전환 모션.",
  },
  "R-03": { boardId: "72538:2",
    data: [
      ["매장명","store.name · 한글 2~20자 · 예 \"강남 스시 오마카세\"","최대 2줄 wrap 후 말줄임"],
      ["평점·리뷰수","store.rating 0.0~5.0(소수1) · reviewCount 0~99,999 콤마 · 형식 \"★ 4.8 (네이버 리뷰 1,204건)\"","신규 매장 rating 0 → \"★ 0\" 그대로(행 유지)"],
      ["지원금(다크 히어로)","연동 시 myBest, 미연동 시 supportAmount · ₩+콤마 · 100원 단위 · 예 ₩160,000","자릿수 디자인 기준 ₩9,999,999(9자)까지 안 깨질 것"],
      ["잔여·기한·영업","remain 0~999 → \"N매\" · 사용 기한 \"24시간\" 고정 · hours \"11:00 - 21:00\" 형식","잔여 0 → \"0매\" + CTA 마감(V4)"],
      ["매장 소개","description 0~500자 · 개행 유지 · 접기 없이 전체 노출","0자면 본문 생략(제목 유지)"],
      ["강조 키워드 칩","highlightKeywords 0~5개 · 각 1~20자 · \"#키워드\" · flex-wrap 최대 2줄","0개면 섹션 전체 숨김(V7)"],
      ["채널 칩","requiredChannels 1~3개 · 라벨 \"블 네이버 블로그\" 등 · 미연동 채널은 🔒 접미","1개뿐이어도 칩 UI 유지(선택 상태 표시)"],
      ["지원금 계산 카드","\"₩{금액}\" 대형 + \"내 {등급}등급 기준\" + \"최대 ₩{기준} (S등급)…\" + 부담 주체 고지 1줄","미연동 채널 선택 시 카드 전체가 안내 문구로 교체(V2)"],
    ],
    defaults: [
      "채널 Default = requiredChannels 중 우선순위 첫 채널 자동 선택. 우선순위: 네이버 블로그 → 인스타그램 → 틱톡 (내 연동 여부와 무관하게 이 순서).",
      "모달 닫힘 · 스크롤 최상단 · Sticky CTA는 Default 채널 기준 금액으로 시작.",
      "잔여 0(마감)이어도 페이지 진입·채널 전환은 가능 — 참여 버튼만 비활성.",
    ],
    inter: [
      ["채널 칩 탭 (필터 동작)","라디오식 단일 선택 전환 → ⑤지원금 카드 금액·⑥리뷰 조건 리스트·Sticky CTA 금액이 즉시 갱신(전환 애니메이션 없음, 스냅)"],
      ["미연동 채널 칩 탭","칩은 선택되지만 지원금 카드가 \"아직 {채널}를 연동하지 않았어요\" 안내로 교체 + CTA가 \"{채널} 미연동\" 회색 비활성으로 전환"],
      ["[참여하기] 탭","하단 시트 모달 오픈(dim ink/45) — 채널·등급·금액 3행 요약 + 취소 가능/72h 고지 2줄"],
      ["모달 [발급받고 체험권 보기]","라벨 \"발급 중...\" 비활성 → 성공 시 체험권 상세(R-04a) 이동 · 실패 시 모달 내부 하단 에러 원문(M5~M8)"],
      ["모달 배경 탭 / [취소]","모달 닫힘 — 선택 상태·스크롤 유지"],
    ],
    variants: [
      ["V1 ★Default","기본(참여 가능)","연동+자격 OK — CTA 파랑 \"참여하기\" 활성, 금액 카드 정상"],
      ["V2","미연동 채널 선택","금액 카드=연동 안내 문구 · CTA \"{채널} 미연동\" 비활성"],
      ["V3","등급 부족","금액 카드에 에러 카피 \"이 채널은 {최소}등급부터 참여할 수 있어요\" · CTA \"{최소}등급부터 참여 가능\" 비활성"],
      ["V4","잔여 0 · 마감","다크 히어로 잔여 \"0매\" · CTA \"마감되었습니다\" 비활성 — 정보 열람은 그대로"],
      ["V5","이미 참여","CTA가 링크 버튼 \"내 체험권 보기 →\"(파랑 활성)로 교체"],
      ["V6","참여 확인 모달","하단 시트 — 요약 3행+고지+버튼 2"],
      ["V7","키워드 없음","'후기에 꼭 강조해주세요' 섹션 숨김(소개만)"],
    ],
    fixedFree: "고정(변경 금지): CTA 5분기 카피·Default 채널 우선순위·금액 계산식(등급 배율)·부담 주체 고지·네이버 평점 출처 표기. 자유(재량): 히어로/카드 비주얼·칩 형태(단 미연동 🔒 시각 구분 유지)·모달 스타일·섹션 간 배경 리듬.",
  },
  "R-04a": { boardId: "72539:2",
    data: [
      ["등급 배지","pass.reviewerGrade = S/A/B/C/N 5종 — GradeBadge 컴포넌트(CP-00 토큰 색)","항상 존재(없는 경우 없음)"],
      ["할인 금액","displaySupport · ₩+콤마 · 100원 단위 · 예 ₩176,000 · 부스트 보유 시 아래 1줄 추가 \"🎁 초대 보상 +N% 부스트 포함\"(N=10/20/30/50)","부스트 없으면 그 줄 자체가 미노출(공간 차지 X)"],
      ["카운트다운(active)","남은 시간 HH:MM:SS · 1초 갱신 · 예 11:42:10","00:00:00 도달 → 다음 로드에서 expired 화면(V7)"],
      ["QR","pass.code 8자(A-HJ-NP-Z2-9 · 헷갈리는 0/O/1/I 제외) 인코딩 · 정사각 최소 120px","다크 티켓 위 흰 카드 안에 배치"],
      ["4자리 input","placeholder \"0000\" · numeric · maxlength 4 · 결제액 input placeholder = 지원금 한도값 콤마 표기","결제액 미입력 제출 = 한도 전액 적용"],
      ["리뷰 마감(used)","\"N일 N시간\" dhm 형식 · 예 \"2일 23시간\"","0 도달 → \"마감 지남\" 빨간 표기"],
      ["반려 사유(rejected)","rejectReason 1~500자 원문 · 다중행 그대로 노출","말줄임 없이 전체(길면 세로로 김)"],
    ],
    defaults: [
      "라우트 진입 시 pass.status 값에 따라 7개 화면 중 하나로 즉시 분기 — active만 풀스크린 다크 티켓, 나머지 6개는 라이트 배경.",
      "active Default: 4자리·결제액 input 빈 값 · [참여 취소]는 텍스트 링크(접힘) 상태.",
      "used Default: 리뷰 폼 전체 미입력 — URL 빈 값 · 광고 확인 해제 · 자가점검 전부 해제 → [제출하고 인증 받기] 비활성(40% 불투명).",
    ],
    inter: [
      ["4자리 입력 + [사용 처리]","라벨 \"처리 중...\" 비활성 → 성공 시 같은 화면이 used 상태 UI로 갱신 · 실패 시 input 아래 에러 원문(M9/M12/M13)"],
      ["[참여 취소] 탭","제자리에서 확인 카드 펼침 — \"참여를 취소할까요?\" + [참여 취소]/[계속 사용할게요] → 확정 시 /r/passes 목록 이동, 취소 시 접힘"],
      ["광고 문구 [복사] 탭","클립보드 복사 + 버튼 라벨 \"복사됨\"으로 1.8초 전환 후 원복"],
      ["자가점검 체크 진행","URL 입력 + 광고 확인 + 전 항목 체크 완료 순간 [제출] 버튼 활성(파랑 100%)"],
      ["[제출하고 인증 받기]","\"등록 중...\" → 성공 시 review_submitted 안내 화면으로 갱신 · 실패 시 버튼 위 에러 원문(M14~M18)"],
      ["재제출(rejected)","조건 충족 시 동일 리뷰 폼이 반려 카드 아래 재노출 — 제출 성공 시 review_submitted로 전환(사장님에게 \"후기 재제출\" 알림)"],
    ],
    variants: [
      ["V1 ★Default","active 기본","다크 티켓+QR+사용처리 폼+취소 링크 (부스트 줄 없음)"],
      ["V2","active + 부스트","할인 금액 아래 \"🎁 +N% 부스트 포함\" 1줄 추가"],
      ["V3","취소 확인 펼침","V1에서 취소 확인 카드가 인라인 확장"],
      ["V4","used + 리뷰 폼","사용 완료 카드+72h 카운트다운+폼 — 제출 버튼 비활성/활성 2상태 모두"],
      ["V5","review_submitted","\"운영팀이 검수합니다 (최대 72시간)\" 안내 단일 카드"],
      ["V6","completed","검수 통과 카드 + 친구 초대 유도 카드(T2)"],
      ["V7","expired","\"24시간이 지나 만료… 모집 자리는 다른 체험자에게\" 안내"],
      ["V8","cancelled","\"직접 취소한 체험권… 다시 참여할 수 있어요\" 안내"],
      ["V9","rejected · 재제출 가능","반려 카드(사유 원문)+재제출 안내+리뷰 폼 재노출"],
      ["V10","rejected · 기한 지남","반려 카드+\"재제출 기한이 지났거나…\" 고객센터 안내(폼 없음)"],
    ],
    fixedFree: "고정(변경 금지): 7-상태 분기와 각 카피·카운트다운 형식(HH:MM:SS/dhm)·제출 활성 조건·사유 원문 노출·4자리 미노출 원칙. 자유(재량): 티켓 비주얼(절취선·그림자)·QR 프레임·폼 단계 시각화·상태별 일러스트.",
  },
  "O-10": { boardId: "72541:2",
    data: [
      ["매장 선택","내 매장 목록 1~N개 · 항목 = 매장명+지역 · 예 \"강남 스시 오마카세 · 강남\"","1개면 자동 선택 상태로 시작"],
      ["모집 현황 카드","플랜명(Free/Basic/Standard/Premium) · 월 한도(5/15/50/∞) · 사용 N팀 · 보너스 +N팀(있을 때만) · 잔여 N팀 — 전부 정수","잔여 0 → 빨간 카피 + [캠페인 생성] 비활성(V3)"],
      ["총 모집 인원","numeric · 최소 1 · 예 12 → 자동 분배 결과 안내(Standard: S2 A6 B2 C2)","0 이하 입력 시 제출에서 에러 M19"],
      ["진행 일수 · 지원금","numeric 2필드 · 지원금은 S등급 100% 기준치 · 예 50,000","지원금 표시 자릿수 ₩9,999,999 기준으로 레이아웃"],
      ["4자리 코드","numeric · maxlength 4 · placeholder \"예: 1234\" · 중앙 정렬 대형(문자 간격 넓게 tracking 0.4em)","4자 미만이면 제출 비활성 · 중복 시 에러 M21"],
      ["채널 토글 칩","블/인/틱 3개 · 다중 선택 · 최소 1개","0개로 만들면 제출 시 에러 M22"],
      ["강조 키워드","text input(쉼표 구분) → 하단 칩 미리보기 0~5개 · 각 20자 초과분 절삭","6개째부터 무시(칩 5개까지만 렌더)"],
      ["필수 메뉴","행 배열 — 메뉴명 text + 가격 numeric(선택) + [＋추가]/[삭제] · 세로 나열(상한 없음, 페이지 스크롤)","빈 이름 행은 제출 시 자동 제거"],
      ["매장 소개","textarea + 우하단 \"N/500\" 실시간 카운터","500자 도달 시 추가 입력 차단"],
    ],
    defaults: [
      "Default 값(코드 확정): 총 모집 20 · 진행 일수 30 · 지원금 50,000 · 채널 = [네이버 블로그, 인스타그램] 2개 선택 · 메뉴 = 빈 행 1개 · 4자리/키워드/소개 = 빈 값.",
      "매장은 목록 첫 항목 자동 선택. 모집 현황 카드는 진입 즉시 현재 플랜 기준으로 로드.",
    ],
    inter: [
      ["채널 칩 탭 (필터 동작)","다중 토글 — 선택=진한 배경, 해제=회색. 마지막 1개까지 해제는 허용하되 제출 시 M22 에러로 차단"],
      ["키워드 입력","쉼표(,) 입력 즉시 아래 칩 미리보기 갱신 — 5개 초과분·20자 초과분은 잘려서 표시"],
      ["[＋추가] / [삭제]","메뉴 행 아래로 추가/해당 행 제거 — 추가 시 새 행에 포커스"],
      ["총 모집 인원 입력","입력값 기준 자동 분배 안내 문구 갱신(등급별 수동 조정 UI 없음)"],
      ["[캠페인 생성] 탭","비활성 조건: 매장 미선택·모집<1·4자리 미완성·월 한도 초과. 활성 탭 → \"생성 중...\" → 성공 시 /o/home 이동, 실패 시 폼 상단 에러 원문(M19~M23)"],
    ],
    variants: [
      ["V1 ★Default","기본 작성","Default 값 채워진 폼 + [캠페인 생성] 활성"],
      ["V2","보너스 보유","모집 현황 카드에 \"보너스 +N팀\" 항목 추가 표기"],
      ["V3","월 한도 초과","현황 카드 빨간 카피 + 제출 버튼 \"월 한도 초과\" 비활성"],
      ["V4","서버 에러","폼 상단 에러 배너 — M21(4자리 중복) 원문 예시로"],
      ["V5","제출 로딩","버튼 \"생성 중...\" 비활성"],
    ],
    fixedFree: "고정(변경 금지): Default 값 5종·자동 분배 규칙(수동 조정 UI 금지)·부담 주체 고지 문구·4자리 미노출 안내·입력 검증 규칙. 자유(재량): 폼 섹션 그룹핑·카드/칩 비주얼·분배 결과의 시각화 방식(문구/그래프).",
  },
  "O-02": { boardId: "72542:2",
    data: [
      ["카메라 뷰","html5-qrcode 라이브 프리뷰 · 4:3 비율 영역","권한 거부 시 영역이 안내 카드로 교체(V2) — 4자리 조회로 폴백"],
      ["4자리 input","numeric · maxlength 4 · placeholder \"4자리 사용처리 코드\"","4자 입력 시 [조회] 활성 · 미만이면 비활성"],
      ["조회 결과 카드","매장명 · \"익명 #1242\"(체험자 id 끝 4자리) · \"{채널} {등급}등급\" · \"지원 한도 ₩176,000 (부스트 +10% 포함)\" · \"발급 11시간 전\"","닉네임·이메일·SNS URL 절대 미노출(익명 정책) · 부스트 없으면 괄호 미노출"],
      ["결제액 input","numeric · 콤마 자동 표기 · 예 200,000","빈 값 제출 = 지원금 한도 전액 적용"],
      ["완료 카드","\"결제 ₩200,000 · 지원 적용 ₩176,000\" + \"체험자는 72시간 내 리뷰 제출\" 안내","적용액 = min(결제액, 한도) 자동 계산값"],
    ],
    defaults: [
      "Default: 카메라 프리뷰 대기 + 4자리 input 빈 값 · 조회 결과/완료 카드는 숨김(DOM 미노출).",
      "조회 성공 시에만 결과 카드가 input 아래로 확장 노출 — 화면이 카드 위치로 스크롤.",
    ],
    inter: [
      ["QR 스캔 성공","별도 확인 없이 즉시 조회 결과 카드 노출(스캔음/진동 없음)"],
      ["[조회] 탭","4자리 일치 → 결과 카드 노출 · 불일치/없음 → input 아래 에러 원문 \"유효하지 않은 체험권 코드입니다\"(M10)"],
      ["[사용 처리] 탭","\"처리 중...\" 비활성 → 성공 시 완료 카드 노출 + input 초기화(연속 처리 가능) · 실패 시 에러 원문(M11~M13)"],
      ["연속 처리","완료 후 다음 손님 스캔/입력 즉시 가능 — 이전 완료 카드는 새 조회 시 제거"],
    ],
    variants: [
      ["V1 ★Default","스캔 대기","카메라 프리뷰 + 4자리 입력 영역"],
      ["V2","카메라 권한 거부","프리뷰 영역 = 안내 카드(\"4자리 코드로 조회해주세요\") — 조회만"],
      ["V3","조회 결과","결과 카드 확장 + 결제액 input + [사용 처리]"],
      ["V4","처리 완료","완료 카드(적용 내역+72h 안내)"],
      ["V5","에러","input 하단 에러 원문 — M10~M13 각 1줄"],
    ],
    fixedFree: "고정(변경 금지): 익명 #last4 노출 정책·한도/적용액 계산 표기·에러 원문·연속 처리 흐름. 자유(재량): 스캔 프레임 비주얼·결과/완료 카드 레이아웃·성공 피드백 톤(단 사운드/진동은 없음).",
  },
  "AD-01": { boardId: "72543:2",
    data: [
      ["통계 카드","검수 대기 N건(=review_submitted 수) · 최근 7일 처리 N건 — 정수 0~999","대기 0 → 큐 영역이 빈 상태 카드로 교체(V2)"],
      ["검수 카드","등급 배지(S~N) · \"익명 #1242\" · 방문형/기자단 · 매장명 · 채널명 · \"제출 8시간 전\"(상대시간) · [게시물 열기 ↗](URL 1줄 truncate) · 재제출 건만 \"재제출\" 뱃지","닉네임·이메일·SNS 계정 절대 미노출(익명 정책)"],
      ["자가점검 칩","채널별 4~5개(광고표기 포함) — 체험자가 체크한 값(서버 보존) · 전부 ✓ 상태로 표시","칩 flex-wrap 최대 2줄"],
      ["반려 사유 input","0~500자 · placeholder 원문 \"반려 사유 — 체험자 화면에 그대로 표시되어 재작성 근거가 됩니다\"","미입력 확정 시 \"작성 조건 미충족\" 자동 대입"],
    ],
    defaults: [
      "Default: 오래된 제출 우선 정렬 큐(최상단 = 가장 오래 대기) · 반려 사유 input은 접힘 — [반려] 탭한 카드에서만 펼침.",
      "데스크톱 뷰포트 기준(모바일 대응 불필요) — 카드형/테이블형 중 디자이너 선택 가능.",
    ],
    inter: [
      ["[게시물 열기 ↗] 탭","리뷰 URL 새 탭 열림 — 운영자는 실제 게시물과 자가점검 칩을 대조"],
      ["[검수 통과] 탭","\"처리 중...\" → 성공 시 해당 카드가 목록에서 제거(리스트 위로 당겨짐) · 체험자·사장님 양측 알림 자동 발행"],
      ["[반려] 탭","해당 카드 안에서 사유 input + [반려 확정]/[취소] 펼침 — 다른 카드는 영향 없음"],
      ["[반려 확정] 탭","사유 저장(rejectReason·rejectedAt) → 카드 제거 · 체험자 화면에 사유 원문 노출 + 72h 내 1회 재제출 가능"],
      ["재제출 건 도착","동일 카드가 \"재제출\" 뱃지를 달고 큐에 다시 등장 — 2차 반려 시 종착(재제출 불가)"],
    ],
    variants: [
      ["V1 ★Default","큐 기본","통계 + 검수 카드 리스트(2~3장 예시)"],
      ["V2","빈 큐","\"검수 대기 중인 후기가 없습니다\" 빈 상태 카드"],
      ["V3","반려 입력 펼침","한 카드만 사유 input+버튼 2개 확장된 상태"],
      ["V4","재제출 카드","\"재제출\" 뱃지가 붙은 카드 변형"],
      ["V5","처리 로딩","버튼 \"처리 중...\" 비활성"],
    ],
    fixedFree: "고정(변경 금지): 익명 #last4 정책·정렬 규칙(오래된 순)·사유 placeholder 원문·반려→재제출 1회 규칙. 자유(재량): 데스크톱 레이아웃(카드형/테이블형)·칩·뱃지 스타일·처리 완료 트랜지션.",
  },
};

// ── 이하 적용 코드 (변경 불필요) ──
const GUIDE = GUIDES[TARGET];
const FK = { krR:{family:"Noto Sans KR",style:"Regular"}, krM:{family:"Noto Sans KR",style:"Medium"}, krB:{family:"Noto Sans KR",style:"Bold"} };
for (const f of Object.values(FK)) await figma.loadFontAsync(f);
const C = { text:{r:0.11,g:0.11,b:0.12}, sub:{r:0.43,g:0.43,b:0.45}, hair:{r:0.925,g:0.925,b:0.945}, bgSoft:{r:0.961,g:0.961,b:0.969}, indigo:{r:0.369,g:0.416,b:0.824}, indigoBg:{r:0.94,g:0.95,b:0.99}, pink:{r:0.85,g:0.35,b:0.55} };
const sol = c => [{type:"SOLID",color:c}];
function txt(str,font,size,color,w){ const t=figma.createText(); t.fontName=font; t.characters=String(str); t.fontSize=size; t.fills=sol(color); t.lineHeight={unit:"PERCENT",value:148}; if(w){t.textAutoResize="HEIGHT"; t.resize(w,t.height);} return t; }
const board = await figma.getNodeByIdAsync(GUIDE.boardId);
const old = board.findOne(n=>n.name==="DesignerGuide"); if (old) old.remove();
const g = figma.createAutoLayout("VERTICAL",{name:"DesignerGuide",itemSpacing:14});
board.appendChild(g); g.layoutSizingHorizontal="FILL";
g.paddingTop=18; g.strokes=sol(C.hair); g.strokeTopWeight=2; g.strokeBottomWeight=0; g.strokeLeftWeight=0; g.strokeRightWeight=0;
const head=figma.createAutoLayout("HORIZONTAL",{itemSpacing:8,counterAxisAlignItems:"CENTER"}); g.appendChild(head);
const bar=figma.createRectangle(); bar.resize(4,16); bar.fills=sol(C.pink); bar.cornerRadius=2; head.appendChild(bar);
head.appendChild(txt("🎨 디자이너 작업 가이드 — 데이터 · Default · 인터랙션 · 디자인 대상 상태 (v1.2)",FK.krB,16,C.text));
function sub(label){ g.appendChild(txt(label,FK.krB,13,C.indigo)); }
function table(heads,widths,rows){ const tb=figma.createAutoLayout("VERTICAL",{name:"gtable"}); g.appendChild(tb); tb.layoutSizingHorizontal="FILL"; tb.cornerRadius=10; tb.strokes=sol(C.hair); tb.strokeWeight=1;
  const mk=(cells,h)=>{ const r=figma.createAutoLayout("HORIZONTAL",{itemSpacing:10}); tb.appendChild(r); r.layoutSizingHorizontal="FILL"; r.paddingLeft=r.paddingRight=12; r.paddingTop=r.paddingBottom=8; if(h) r.fills=sol(C.bgSoft); else {r.strokes=sol(C.hair); r.strokeTopWeight=1; r.strokeBottomWeight=0; r.strokeLeftWeight=0; r.strokeRightWeight=0;} cells.forEach((c,i)=>r.appendChild(txt(c,h?FK.krB:(i===0?FK.krM:FK.krR),11.5,h?C.sub:(i===0?C.text:C.sub),widths[i]))); };
  mk(heads,true); for(const row of rows) mk(row,false); }
sub("A · 요소별 데이터 정의 (무엇이 어떤 값으로 들어가나)");
table(["요소","데이터 · 형식 · 예시","한계값 · 비어있을 때"],[200,640,384],GUIDE.data);
sub("B · Default 상태 (첫 진입 시 화면)");
const dcard=figma.createAutoLayout("VERTICAL",{itemSpacing:4}); g.appendChild(dcard); dcard.layoutSizingHorizontal="FILL"; dcard.paddingLeft=dcard.paddingRight=14; dcard.paddingTop=dcard.paddingBottom=12; dcard.fills=sol(C.bgSoft); dcard.cornerRadius=10;
for (const ln of GUIDE.defaults) dcard.appendChild(txt("· "+ln,FK.krR,12,C.text,1214));
sub("C · 인터랙션 동작 (트리거 → 결과)");
table(["트리거","동작 결과"],[260,984],GUIDE.inter);
sub("D · 디자인해야 할 화면 상태 (Variants) — 아래 개수만큼 시안 필요");
table(["V#","상태","화면이 어떻게 다른가"],[110,200,914],GUIDE.variants);
const ff=figma.createAutoLayout("VERTICAL"); g.appendChild(ff); ff.layoutSizingHorizontal="FILL"; ff.paddingLeft=ff.paddingRight=14; ff.paddingTop=ff.paddingBottom=11; ff.fills=sol(C.indigoBg); ff.cornerRadius=10;
ff.appendChild(txt("🔒/🎨 "+GUIDE.fixedFree,FK.krM,12,C.indigo,1214));
const inh = board.findOne(n=>n.name==="InheritNote"); if (inh) board.appendChild(inh);
return { boardId: board.id, guideId: g.id, target: TARGET };
