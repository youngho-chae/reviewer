# CATCHPASS · 정보 구조 (Information Architecture) — VER.1

> 화면 인벤토리·라우트·네비게이션 구조의 **단일 기준 문서**. 화면별 기능은 [`기능정의서.md`](기능정의서.md),
> 유저 여정은 [`../flow.md`](../flow.md), 정책은 [`운영정책서.md`](운영정책서.md), 데이터는 [`데이터정책서.md`](데이터정책서.md).
> 좌측 **화면 코드(R-xx/O-xx/AD-xx)** 는 화면설계서·추적용 라벨, 우측은 실제 Next.js 라우트. 모든 라우트는 브랜치 `mvp/ver1` 구현 기준.

---

## 1. 앱 구조 개관

- **모바일 우선 웹앱** (Next.js 15 App Router). 뷰포트 폭 480px 기준, 초과 시 중앙 정렬.
- 진입 경로로 역할 분리: **체험자 `/r/*`**, **사장님 `/o/*`**, **운영팀 `/admin/*`**. 같은 데이터(매장·캠페인·체험권)를 양측이 다른 권한으로 본다.
- 라우트 그룹 `(app)`: 로그인 게이트가 걸린 메인 화면들. 그룹 **바깥**은 비회원 접근 허용(랜딩·법적 고지·초대 랜딩·환영 박스).
- 인증: JWT httpOnly·secure 쿠키 30일. 미인증 접근 시 로그인 화면 redirect.

---

## 2. 화면 인벤토리

### 2.1 체험자 (Reviewer) — `/r/...`

| 코드 | 화면명 | 라우트 |
|---|---|---|
| R-00 | 가입·온보딩 (3-step: 컨셉 → 계정+필수동의 → SNS 연동) | `/r/signup` |
| R-00b | 로그인 | `/r/login` |
| R-01 | 홈 (큐레이팅·발견 전용) | `/r/home` |
| R-02 | 탐색 (리스트 + 지도 통합) | `/r/explore` (`?mode=map` `?sort=` `?cat=`) |
| R-03 | 매장 상세 · 채널 선택 참여 | `/r/store/[id]` |
| R-04 | 내 체험권 (방문형/기자단 탭) | `/r/passes` |
| R-04a | 체험권 상세 (7-상태 분기, QR/사용/리뷰/재제출/취소) | `/r/passes/[id]` |
| R-05 | 리뷰 인증 폼 | `/r/passes/[id]` (used 상태에서 같은 페이지) |
| R-06 | 등급 (배지·진행도·채널별 등급·혜택 사다리) | `/r/grade` |
| R-06b | 혜택 (바이럴: 박스·라이브 카운터·내 보상·보낸 초대) | `/r/rewards` |
| R-07 | MY (프로필·메뉴 허브·약관·회원 탈퇴) | `/r/me` |
| R-07a | 알림함 | `/r/notifications` |
| R-08a | 기자단 브리프 | `/r/press/[id]` |
| R-09 | 기자단 작성 | `/r/press/[id]/write?pass=<id>` |
| R-10 | 친구에게 쏘기 (매트릭스 + 공유 시트) | `/r/invite/new` |
| R-11 | 피추천자 랜딩 (비회원 진입) | `/r/i/[token]` |
| W-01 | 환영 박스 (가입 직후 슬롯 박스) — reviewer/owner 공용 | `/welcome/box?token=<token>` |
| L-01 | 이용약관 (비로그인 접근) | `/legal/terms` |
| L-02 | 개인정보처리방침 (비로그인 접근) | `/legal/privacy` |

> **기자단 보관소(구 R-08)는 별도 화면이 아니다.** 기자단 신청·작성·검수·정산 현황은 모두 `/r/passes`의 **기자단 탭**에서 본다.
> (재설계 전 잔재였던 독립 `/r/press` 인덱스 화면은 도달 경로가 없어 VER.1에서 제거됨 — `/r/press/[id]`(브리프)·`/r/press/[id]/write`(작성)만 존재.)

**체험자 BottomNav (5탭, 하단 고정 72px):** **홈** `/r/home` · **탐색** `/r/explore` · **체험권** `/r/passes` · **혜택** `/r/rewards` · **MY** `/r/me`.
- 아이콘: home / navigation / ticket / trophy / user. Default=border, 활성=bold.
- **등급(`/r/grade`)** 은 BottomNav에서 제외 — MY 하위 진입(프로필 등급 칩 + "내 등급 / 등급별 혜택" 메뉴).
- **내 체험권(`/r/passes`)** 은 홈·탐색·등급 헤더 카드에서도 진입.
- 알림함(`/r/notifications`)은 전 화면 상단 종 아이콘(미읽음 1건+ 시 brand dot).
- 탭 책임 분리: **등급 탭** = 지금 받을 수 있는 정적 혜택(매장/지원금/등급 권한), **혜택 탭** = 친구와 함께 키우는 동적 보상(박스/카운터/보상/초대).

### 2.2 사장님 (Owner) — `/o/...`

| 코드 | 화면명 | 라우트 |
|---|---|---|
| O-00 | 홈 (플랜·모집 현황·진행 캠페인 탭) | `/o/home` |
| O-00b | 로그인 · 가입 | `/o/login` · `/o/signup` |
| O-01 | 후기 모니터링 (조회 전용) | `/o/reviews` |
| O-02 | 사용 처리 (QR 스캔 + 4자리 입력) | `/o/scan` |
| O-03 | 성과 리포트 | `/o/report` |
| O-04 | 더보기 (메뉴 허브) | `/o/me` |
| O-04a | 알림함 | `/o/notifications` |
| O-10 | 새 캠페인 | `/o/campaign/new` |
| O-11 | 체험권 사용 로그 | `/o/logs` |
| O-12 | 매장 정보 | `/o/stores` |
| O-14 | 멤버십 / 구독 관리 | `/o/membership` |

**사장님 BottomNav (4탭):** **홈** `/o/home` · **QR 스캔** `/o/scan` · **후기** `/o/reviews` · **MY** `/o/me`.
- 아이콘: home / camera / clipboard / user. 리포트·멤버십·로그·매장정보는 MY 허브 진입.

### 2.3 운영팀 (Admin) — `/admin/...`

| 코드 | 화면명 | 라우트 |
|---|---|---|
| AD-00b | 운영팀 로그인 | `/admin/login` |
| AD-01 | 후기 검수 콘솔 | `/admin/reviews` |

- `admin` 역할 전용. `/admin/(app)/layout.tsx` 세션 게이트(admin 아니면 `/admin/login` redirect). `/admin` → `/admin/reviews` redirect.
- BottomNav 없음 — 데스크톱 백오피스 톤. reviewer/owner 화면·보상 대상에서 제외.

### 2.4 공통 / 비회원

| 라우트 | 설명 | 접근 |
|---|---|---|
| `/` | 역할 선택 랜딩 | 비회원 |
| `/legal/terms` · `/legal/privacy` | 법적 고지 | 비회원 |
| `/r/i/[token]` | 피추천자 초대 랜딩 | 비회원 |
| `/welcome/box` | 환영 박스 | 로그인 필요(미로그인 시 `/r/i/<token>`로) |

---

## 3. 전체 라우트 맵

```
/                                   역할 선택 랜딩
─ 체험자 ─────────────────────────────────────────────
/r/signup  /r/login                 가입 · 로그인
/r/home                             홈(큐레이팅)         /r/explore            탐색(리스트+지도)
/r/store/[id]                       매장 상세·참여        /r/passes             내 체험권(방문형/기자단 탭)
/r/passes/[id]                      체험권 상세(7-상태)   /r/grade              등급
/r/rewards                          혜택(바이럴)          /r/me                 MY(+탈퇴)
/r/notifications                    알림함
/r/press/[id]  /r/press/[id]/write  기자단 브리프 · 작성
/r/invite/new                       친구 초대            /r/i/[token]          피추천자 랜딩(비회원)
/welcome/box                        환영 박스(공용)
─ 사장님 ─────────────────────────────────────────────
/o/signup  /o/login  /o/home  /o/scan  /o/reviews  /o/campaign/new
/o/membership  /o/logs  /o/stores  /o/report  /o/me  /o/notifications
─ 운영팀 ─────────────────────────────────────────────
/admin/login  /admin/reviews
─ 공통(비로그인) ─────────────────────────────────────
/legal/terms  /legal/privacy
```

---

## 4. 네비게이션·게이트 규칙

| 상황 | 처리 |
|---|---|
| 미인증으로 `(app)` 접근 | 해당 역할 로그인 화면 redirect (체험자 `/r/login` 등) |
| 권한 없는 리소스 / 타인 체험권 | 404(`notFound()`) 또는 403 |
| 폐기된 경로 (`/api/passes/approve`) | 410 Gone |
| admin이 reviewer/owner 화면 | 접근·보상 대상에서 제외 |
| 가입 완료 후 | `?invite=` 있으면 `/welcome/box`, 없으면 역할 홈 |
| 초대 토큰 랜딩에서 로그인 상태 | `/welcome/box` 자동 redirect |

---

## 5. 화면 코드 ↔ 화면설계서(Figma)

Figma 화면설계서 보드가 작성된 화면(노드ID는 [`sdd/README.md`](sdd/README.md) 참조): R-00, R-01, R-02, R-03, R-04a, O-02, O-10, AD-01.
나머지 인벤토리 화면은 화면설계서 미작성(로드맵). 본 IA와 [`기능정의서.md`](기능정의서.md)가 그 화면들의 구조·기능 기준.

---

## 변경 이력

| 버전 | 일자 | 내용 |
|---|---|---|
| 1.0 | 2026-07-07 | PRD.md §3에서 분리 신설. 화면 인벤토리·BottomNav·라우트 맵·게이트 규칙 정리. 도달 불가하던 `/r/press` 인덱스 화면 제거 반영(기자단은 `/r/passes` 탭). |
