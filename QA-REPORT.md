# CATCHPASS · QA & Deployment Report

## 배포 URL

| 환경 | URL |
|---|---|
| **Production (체험자 · 사장님 공용)** | https://reviewer-hgx1.vercel.app/ |
| **체험자 입구** | https://reviewer-hgx1.vercel.app/r/login |
| **사장님 입구** | https://reviewer-hgx1.vercel.app/o/login |
| Branch deployment | https://reviewer-hgx1-git-vercel-07d480-codudgh0810-gmailcoms-projects.vercel.app |
| Commit deployment | https://reviewer-hgx1-2vggkx74v-codudgh0810-gmailcoms-projects.vercel.app |

> 양면이 동일한 도메인에서 path로 분기됩니다(`/r/*` 체험자, `/o/*` 사장님). 모바일 사파리/크롬에서 그대로 사용 가능.

## 데모 계정 (시드 데이터)

| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 체험자 (B등급) | demo@reviewer.com | demo1234 |
| 사장님 (Standard 플랜) | demo@store.com | demo1234 |

## 자동 QA 결과 — 로컬 (동일 코드, 동일 빌드)

`npx next build && npx next start` + `bash /tmp/prod-qa.sh http://localhost:3000`

```
═══ A) 정적 페이지 도달성 ═══
✓ GET /
✓ GET /r/login
✓ GET /r/signup
✓ GET /o/login
✓ GET /o/signup

═══ B) 데모 체험자/사장님 로그인 ═══
✓ reviewer login
✓ owner login

═══ C) 체험자 홈 / 매장 리스트 ═══
✓ 체험자 홈 렌더
✓ 캠페인 카드 노출

═══ D) 핵심 트랜잭션: 참여 → QR → 사용 → 리뷰 → 검수 ═══
✓ 체험권 발급 (passId=ps_47gyxkodqk1i)
✓ QR 코드 표시 (code=CPS-66BXV4-ZNSQ)
✓ 24h 카운트다운 노출
✓ 사장님 QR 조회
✓ 사용 처리 (₩120,000)
✓ 지원금 상한 적용 (₩100,000)
✓ 리뷰 등록
✓ 사장님 검수 통과
✓ 체험자 MY 완료수 반영

═══ E) 신규 회원가입 ═══
✓ 신규 가입 (연동 없이) → N등급
✓ N등급 → 상위 캠페인 차단 (403)
✓ 신규 사장님 가입
✓ 신규 매장 자동 생성
✓ 신규 캠페인 생성

전체: 23건 / 통과 23 / 실패 0  ✅ ALL GREEN
```

빌드 산출물은 GitHub에 푸시된 코드와 1:1 동일하며, Vercel은 동일한 `next build` 명령으로 빌드합니다.

## 프로덕션 직접 QA — 샌드박스 환경 한계

다음 두 가지 제약이 동시에 걸려 제가 이 샌드박스에서 프로덕션 URL을 호출할 수 없습니다.

1. **샌드박스 아웃바운드 정책**: `*.vercel.app`, `vercel.com`, `api.vercel.com`이 모두 allowlist에 없어 sandbox curl이 403 "Host not in allowlist" 반환
2. **Vercel Deployment Protection (Vercel Authentication)**: 사용자 측에서 Disabled 처리 시도했으나 여전히 외부 호출 시 403. Protection Bypass for Automation 토큰을 받았으나 WebFetch가 헤더/쿠키를 전달하지 않아 우회 불가

따라서 프로덕션 환경의 23/23 자동 QA는 **사용자께서 직접 수행해야 합니다.** 아래 두 가지 방법 중 하나로 검증해주세요.

### 방법 1 — 브라우저 수동 검증 체크리스트 (3-5분)

| # | 동작 | 예상 결과 |
|---|---|---|
| 1 | `/` 접속 | 헤드라인 "선정 기다리는 체험단 말고…" + 시작 버튼 2개 |
| 2 | `/r/login`에서 demo@reviewer.com/demo1234로 로그인 | 홈으로 리다이렉트, B등급 배지 + "방문 가능한 매장 2곳" |
| 3 | "정식당 · 북촌" 카드 탭 → 매장 상세 | 지원금 ₩100,000 표시, "참여하기" 버튼 활성 |
| 4 | 참여하기 → 발급 모달 → 확인 | 패스 상세 화면으로 이동, 24시간 카운트다운 + QR 코드 표시 |
| 5 | (별도 창) `/o/login`에서 demo@store.com/demo1234로 로그인 | 사장님 홈, "오늘 할 일" 카드 |
| 6 | QR 스캔 탭 → 체험자 QR 코드 직접 입력 → 조회 | "북촌리뷰어 (B등급)" 정보 표시 |
| 7 | 결제 금액 80000 입력 → 사용 처리 | 사장님 홈으로 복귀 |
| 8 | (체험자 창 새로고침) 패스 상세 | "사용 완료 · ₩80,000 · 지원 ₩80,000" 표시 + 리뷰 등록 폼 |
| 9 | 채널/URL/본문(50자+) 입력 → 리뷰 등록 | "리뷰가 등록되었습니다" |
| 10 | 사장님 → 리뷰 검수 탭 → 통과 | "리뷰 검수 통과" 알림 |
| 11 | 체험자 MY 페이지 | 완료 리뷰 1, 리뷰 점수 80점대 표시 |
| 12 | `/r/signup`에서 SNS 연동 없이 가입 (가짜 이메일/6자+ pw) | "연동 없이 시작하기" 클릭 → 가입 완료 → N등급 부여 |
| 13 | 신규 N등급 사용자가 매장 카드 보면 | "이 매장은 C등급부터 이용 가능해요" 잠금 |

### 방법 2 — 자동 QA 스크립트를 본인 머신에서 실행

`/tmp/prod-qa.sh`(레포에 없고 챗에서 작성한 스크립트) 또는 아래 한 줄 셸 명령으로:

```bash
# 본인 노트북에서:
curl -sS -X POST -H 'Content-Type: application/json' \
  -c r.txt \
  https://reviewer-hgx1.vercel.app/api/auth/login \
  -d '{"role":"reviewer","email":"demo@reviewer.com","password":"demo1234"}'
# → {"ok":true}이면 인증·DB·서버리스 함수 정상
```

## 알려진 제약사항 (배포 후 추후 보완 필요)

1. **데이터 영속성**: 현재 in-memory 모듈 싱글톤 + `/tmp` JSON 스냅샷. Vercel 서버리스 인스턴스가 cold start 시 데이터 초기화될 수 있음. 프로덕션 안정화 위해서는 **Vercel Postgres** 또는 **Vercel KV** 연동 권장 (PRD 11절 로드맵). 추가 작업 약 2-3시간.
2. **카메라 QR 스캔**: 모바일 사파리에서 HTTPS는 필수이고 `*.vercel.app`은 자동 HTTPS이므로 OK. 카메라 권한 거부 시 "코드 직접 입력" 대체 경로 제공됨.
3. **SNS 연동 인증**: 현재 URL + 영향력 수치 자기 입력 방식. 실제 운영에선 OAuth + 크롤링 검증으로 업그레이드 필요 (PRD 12.9 확정 사항).
4. **결제 흐름**: "결제 전 QR 제시 → 사용 처리" 흐름은 매장 결제 시스템 외부에서 진행하는 것으로 PRD에서 확정. 실제 결제 게이트웨이 연동 불필요.

## 보안 후속 조치 (즉시 수행)

- [ ] Vercel 대시보드 → Settings → Tokens에서 챗에 노출된 토큰 **`vcp_4zpm…Cwe`** 즉시 **재발급(rotate)** 또는 삭제
- [ ] Bypass 토큰 `ufIYSVNJ…INkY`도 더 이상 필요 없으면 Deployment Protection 설정에서 삭제
- [ ] `AUTH_SECRET` 환경변수가 강력한 임의값(32바이트+)으로 설정되어 있는지 Vercel Project Settings에서 확인
