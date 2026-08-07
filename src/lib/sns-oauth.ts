// SNS 채널 본인 검증 OAuth 코어 (2026-07-10).
//
// 채널 연동 시 "본인 소유 채널" 검증을 프로바이더 로그인으로 수행한다:
//   naver_blog → 네이버 로그인(OAuth 2.0)  · instagram → Meta/Facebook Login · tiktok → TikTok Login Kit v2
// 프로바이더 키(env)가 없으면 oauthConfigured=false — 호출측(/api/sns/[provider]/start)이
// 데모 검증 화면으로 폴백한다 (지도 키의 실지도/데모 지도 이원화와 동일 관례).
//
// [개인정보 최소 수집] 액세스 토큰은 저장하지 않는다 — 신원 조회 직후 폐기하고
// providerAccountId(고유 ID)·accountName(표시명)만 SnsAccount에 보존한다.
//
// [한계 — 운영정책서 §13]
//  - 네이버 프로필 API(/v1/nid/me)는 로그인 아이디를 반환하지 않아 블로그 주소를 자동 유도할 수 없다.
//    → 네이버 검증 = "본인 계정 인증 + 사용자가 입력한 블로그 URL 귀속". 글 게시 검증 등은 후속.
//  - 인스타그램 username/팔로워는 비즈니스 계정 + 앱 리뷰 승인(pages_show_list·instagram_basic) 시에만
//    조회 가능 — 실패해도 FB 계정 신원으로 검증은 성립(best-effort).
//  - 틱톡 username/팔로워는 user.info.profile/stats scope 승인 필요 — 기본 user.info.basic으로 동작.

import type { DBShape, SnsAccount, SnsKind } from "./types";
import { bestGrade, channelGradesFromSns } from "./grade";
import { SNS_PROVIDER_LOGIN_LABEL } from "./sns-oauth-labels";

export { SNS_PROVIDER_LOGIN_LABEL };

export interface SnsIdentity {
  accountId: string; // 프로바이더 고유 ID
  accountName: string; // 표시명 (또는 username)
  username?: string; // 핸들 — URL 자동 유도용 (인스타/틱톡)
  followers?: number; // 팔로워 수 — 조회 가능 시 influence로 채택
}

interface ProviderConf {
  label: string;
  idEnv: string;
  secretEnv: string;
}

const PROVIDERS: Record<SnsKind, ProviderConf> = {
  naver_blog: { label: "네이버 로그인", idEnv: "NAVER_LOGIN_CLIENT_ID", secretEnv: "NAVER_LOGIN_CLIENT_SECRET" },
  instagram: { label: "페이스북 로그인", idEnv: "META_APP_ID", secretEnv: "META_APP_SECRET" },
  tiktok: { label: "틱톡 로그인", idEnv: "TIKTOK_CLIENT_KEY", secretEnv: "TIKTOK_CLIENT_SECRET" },
};

export function isSnsKind(v: string): v is SnsKind {
  return v === "naver_blog" || v === "instagram" || v === "tiktok";
}

function creds(kind: SnsKind): { id: string; secret: string } {
  const c = PROVIDERS[kind];
  return { id: process.env[c.idEnv] || "", secret: process.env[c.secretEnv] || "" };
}

// 프로바이더 OAuth 키가 설정되어 있는가 — false면 데모 검증 모드로 폴백
export function oauthConfigured(kind: SnsKind): boolean {
  const { id, secret } = creds(kind);
  return !!id && !!secret;
}

export function redirectUri(kind: SnsKind, origin: string): string {
  return `${origin}/api/sns/${kind}/callback`;
}

// [통합 테스트 전용] SNS_OAUTH_TEST_BASE 설정 시 프로바이더 엔드포인트를 스텁 서버
// (scripts/sns-oauth-stub.mjs)로 대체 — 요청/응답 형태는 실 프로바이더와 동일하므로
// state·토큰 교환·프로필 파싱 등 "실 코드 경로"가 그대로 검증된다.
// production에서는 무시(실 엔드포인트 고정) — 우회 불가.
function testBase(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return process.env.SNS_OAUTH_TEST_BASE || null;
}

// 프로바이더별 엔드포인트 — 실 스펙 고정, 테스트 베이스가 있으면 같은 형태의 스텁 경로로 대체
function endpoints(kind: SnsKind): { authorize: string; token: string; profile: string; accounts?: string } {
  const tb = testBase();
  switch (kind) {
    case "naver_blog":
      return {
        authorize: tb ? `${tb}/naver_blog/authorize` : "https://nid.naver.com/oauth2.0/authorize",
        token: tb ? `${tb}/naver_blog/token` : "https://nid.naver.com/oauth2.0/token",
        profile: tb ? `${tb}/naver_blog/profile` : "https://openapi.naver.com/v1/nid/me",
      };
    case "instagram":
      return {
        authorize: tb ? `${tb}/instagram/authorize` : "https://www.facebook.com/v19.0/dialog/oauth",
        token: tb ? `${tb}/instagram/token` : "https://graph.facebook.com/v19.0/oauth/access_token",
        profile: tb ? `${tb}/instagram/profile` : "https://graph.facebook.com/v19.0/me",
        accounts: tb ? `${tb}/instagram/accounts` : "https://graph.facebook.com/v19.0/me/accounts",
      };
    case "tiktok":
      return {
        authorize: tb ? `${tb}/tiktok/authorize` : "https://www.tiktok.com/v2/auth/authorize/",
        token: tb ? `${tb}/tiktok/token` : "https://open.tiktokapis.com/v2/oauth/token/",
        profile: tb ? `${tb}/tiktok/profile` : "https://open.tiktokapis.com/v2/user/info/",
      };
  }
}

// 프로바이더 인가 URL — state는 호출측이 httpOnly 쿠키로 함께 보관(CSRF 방지)
export function buildAuthorizeUrl(kind: SnsKind, origin: string, state: string): string {
  const { id } = creds(kind);
  const cb = redirectUri(kind, origin);
  const ep = endpoints(kind);
  switch (kind) {
    case "naver_blog": {
      const p = new URLSearchParams({ response_type: "code", client_id: id, redirect_uri: cb, state });
      return `${ep.authorize}?${p}`;
    }
    case "instagram": {
      const p = new URLSearchParams({
        client_id: id,
        redirect_uri: cb,
        state,
        response_type: "code",
        scope: "public_profile,pages_show_list,instagram_basic",
      });
      return `${ep.authorize}?${p}`;
    }
    case "tiktok": {
      const p = new URLSearchParams({
        client_key: id,
        response_type: "code",
        scope: "user.info.basic",
        redirect_uri: cb,
        state,
      });
      return `${ep.authorize}?${p}`;
    }
  }
}

// code → 액세스 토큰 교환 (토큰은 반환 즉시 신원 조회에만 쓰고 폐기)
export async function exchangeToken(kind: SnsKind, code: string, origin: string, state: string): Promise<string> {
  const { id, secret } = creds(kind);
  const cb = redirectUri(kind, origin);
  const ep = endpoints(kind);
  switch (kind) {
    case "naver_blog": {
      const p = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: id,
        client_secret: secret,
        code,
        state,
      });
      const res = await fetch(`${ep.token}?${p}`);
      const j = await res.json();
      if (!j.access_token) throw new Error(`naver token: ${j.error_description || j.error || res.status}`);
      return j.access_token as string;
    }
    case "instagram": {
      const p = new URLSearchParams({ client_id: id, client_secret: secret, redirect_uri: cb, code });
      const res = await fetch(`${ep.token}?${p}`);
      const j = await res.json();
      if (!j.access_token) throw new Error(`meta token: ${j.error?.message || res.status}`);
      return j.access_token as string;
    }
    case "tiktok": {
      const res = await fetch(ep.token, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: id,
          client_secret: secret,
          code,
          grant_type: "authorization_code",
          redirect_uri: cb,
        }),
      });
      const j = await res.json();
      if (!j.access_token) throw new Error(`tiktok token: ${j.error_description || j.error || res.status}`);
      return j.access_token as string;
    }
  }
}

// 토큰 → 본인 신원 조회
export async function fetchIdentity(kind: SnsKind, token: string): Promise<SnsIdentity> {
  const ep = endpoints(kind);
  switch (kind) {
    case "naver_blog": {
      const res = await fetch(ep.profile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      const r = j.response;
      if (!r?.id) throw new Error(`naver profile: ${j.message || res.status}`);
      return { accountId: String(r.id), accountName: r.nickname || r.name || "네이버 사용자" };
    }
    case "instagram": {
      const meRes = await fetch(`${ep.profile}?fields=id,name&access_token=${encodeURIComponent(token)}`);
      const me = await meRes.json();
      if (!me?.id) throw new Error(`meta profile: ${me.error?.message || meRes.status}`);
      // best-effort: 연결된 페이지의 인스타 비즈니스 계정에서 username·팔로워 조회 (권한 미승인 시 무시)
      let username: string | undefined;
      let followers: number | undefined;
      try {
        const pagesRes = await fetch(
          `${ep.accounts}?fields=instagram_business_account{username,followers_count}&access_token=${encodeURIComponent(token)}`,
        );
        const pages = await pagesRes.json();
        const ig = (pages.data ?? []).map((p: any) => p.instagram_business_account).find(Boolean);
        if (ig?.username) username = ig.username;
        if (typeof ig?.followers_count === "number") followers = ig.followers_count;
      } catch {}
      return { accountId: String(me.id), accountName: username || me.name || "인스타그램 사용자", username, followers };
    }
    case "tiktok": {
      const res = await fetch(`${ep.profile}?fields=open_id,display_name,username,follower_count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      const u = j.data?.user;
      if (!u?.open_id) throw new Error(`tiktok profile: ${j.error?.message || res.status}`);
      return {
        accountId: String(u.open_id),
        accountName: u.username || u.display_name || "틱톡 사용자",
        username: u.username || undefined,
        followers: typeof u.follower_count === "number" ? u.follower_count : undefined,
      };
    }
  }
}

// 신원으로 채널 URL 자동 유도 — 네이버는 아이디 미반환으로 불가(사용자 입력 URL 사용)
export function deriveChannelUrl(kind: SnsKind, identity: SnsIdentity, pendingUrl: string): string {
  if (kind === "instagram" && identity.username) return `https://instagram.com/${identity.username}`;
  if (kind === "tiktok" && identity.username) return `https://www.tiktok.com/@${identity.username}`;
  return pendingUrl;
}

// 연동 커밋 — sns upsert + 채널별 등급·표기 등급(연동 채널 중 최고) 재계산 (signup·demo-verify·OAuth 콜백 공용).
// 등급 재계산은 가입 시 관례(channelGradesFromSns + bestGrade)와 동일. [P1] 참여 게이트는
// "연동 여부"뿐 — verified는 신뢰 표식이며 참여·지원금 산정에 영향을 주지 않는다.
// S+ 유의(2026-08-06 6단계): 채널 구성이 바뀌면 표기 등급을 채널 최고(상한 S)로 재계산하므로
// S+는 S로 내려가고, 다음 월간 재평가 스윕에서 조건 충족 시 다시 부여된다 — 의도된 동작.
export function applySnsConnect(
  db: DBShape,
  reviewerId: string,
  entry: SnsAccount,
): { ok: boolean; error?: string } {
  const rv = db.reviewers.find((r) => r.id === reviewerId);
  if (!rv) return { ok: false, error: "체험자를 찾을 수 없습니다" };
  const rest = rv.sns.filter((s) => s.kind !== entry.kind);
  rv.sns = [...rest, entry];
  rv.channelGrades = channelGradesFromSns(rv.sns);
  rv.grade = bestGrade(Object.values(rv.channelGrades));
  return { ok: true };
}

// 해제 — sns 제거 + 등급 재계산. 진행 중 패스는 유지(참여 시점 등급이 패스에 스냅샷됨).
export function applySnsDisconnect(db: DBShape, reviewerId: string, kind: SnsKind): { ok: boolean; error?: string } {
  const rv = db.reviewers.find((r) => r.id === reviewerId);
  if (!rv) return { ok: false, error: "체험자를 찾을 수 없습니다" };
  if (!rv.sns.some((s) => s.kind === kind)) return { ok: false, error: "연동되어 있지 않은 채널입니다" };
  rv.sns = rv.sns.filter((s) => s.kind !== kind);
  rv.channelGrades = channelGradesFromSns(rv.sns);
  rv.grade = bestGrade(Object.values(rv.channelGrades));
  return { ok: true };
}
