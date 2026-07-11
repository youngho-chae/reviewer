// SNS 본인 검증 프로바이더 로그인 표시명 — 클라이언트 공유용 (서버 OAuth 코어는 sns-oauth.ts).
import type { SnsKind } from "./types";

export const SNS_PROVIDER_LOGIN_LABEL: Record<SnsKind, string> = {
  naver_blog: "네이버 로그인",
  instagram: "페이스북 로그인",
  tiktok: "틱톡 로그인",
};
