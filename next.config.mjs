/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // 브라우저 렌더 크롤(sns-bio-browser) — 번들링 대신 노드 런타임에서 직접 로드
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  // @sparticuz/chromium의 압축 바이너리(bin/*.br)는 fs로 읽혀 파일 트레이싱이 놓친다 —
  // 미포함 시 Vercel에서 "input directory .../bin does not exist" (2026-07-28 실 QA 로그)
  outputFileTracingIncludes: {
    "/api/sns/bio-verify/confirm": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};
export default nextConfig;
