/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // 브라우저 렌더 크롤(sns-bio-browser) — 번들링 대신 노드 런타임에서 직접 로드
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
};
export default nextConfig;
