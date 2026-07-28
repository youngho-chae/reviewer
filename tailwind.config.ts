import type { Config } from "tailwindcss";

// CATCHPASS 디자인 시스템 v2 — "[체험단] 디자인시스템" (DESIGN.md v2.0)
// 단일 퍼플 액센트(#9333EA) + 흰 캔버스 + 헤어라인 카드 + 파스텔 SNS 배지.
// 시맨틱 토큰명은 v1과 호환 유지(값만 재매핑) — 전 화면이 일괄 전환된다.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces (Color/Bg/*)
        canvas: "#ffffff",
        parchment: "#FAFAFA", // Bg/Secondary (구 parchment 호환명)
        pearl: "#F5F5F5", // Bg/Tertiary
        surfaceSoft: "#FAFAFA",
        surfaceStrong: "#F5F5F5",
        sunken: "#F5F5F5",
        // Text (Color/Text/*)
        ink: "#171717",
        ink2: "#404040",
        body: "#171717",
        muted: "#737373",
        mutedSoft: "#A3A3A3",
        // Borders (Color/Border/*)
        hairline: "#E5E5E5",
        hairlineSoft: "#F5F5F5",
        borderStrong: "#D4D4D4",
        // 다크 서피스 — 지도 FAB·인버스 토스트 전용 (섹션 배경 금지)
        tile1: "#171717",
        tile2: "#262626",
        tile3: "#0A0A0A",
        // Primary Purple (Color/*/Interactive)
        brand: "#9333EA",
        brandActive: "#7E22CE",
        brandFocus: "#7E22CE",
        brandOnDark: "#C084FC",
        brandSoft: "#FAF5FF", // Interactive-subtle (Purple 10)
        brandTint: "#F3E8FF", // Purple 20
        brandInk: "#ffffff",
        // Info Blue — 프로모/마케팅 슬롯 전용
        info: "#3B82F6",
        infoSoft: "#EFF6FF",
        // States
        error: "#FF4242",
        errorSoft: "#FFFAFA",
        success: "#00BF40",
        successStrong: "#009632",
        successSoft: "#F2FFF6",
        warning: "#EAB308",
        warningSoft: "#FEFCE8",
        // 시안 오렌지 액센트 (2026-07-28 홈 카드 지역 표기 등 — 상태 컬러(warning)와 구분)
        accentWarm: "#F97316",
        // SNS 배지 (시그니처 아이덴티티 — 상태/카테고리 재사용 금지)
        snsBlogBg: "#F2FFF6",
        snsBlogText: "#009632",
        snsInstaBg: "#FDF2F8",
        snsInstaText: "#EC4899",
        snsTiktokBg: "#ECFEFF",
        snsTiktokText: "#0891B2",
        // Grades — 배지 컬러 (P1: 등급은 혜택 크기만)
        gradeS: "#171717",
        gradeA: "#9333EA",
        gradeB: "#3B82F6",
        gradeC: "#00BF40",
        gradeN: "#A3A3A3",
      },
      borderRadius: {
        none: "0px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        pill: "9999px",
      },
      boxShadow: {
        // 떠 있는 표면에만 — FAB / 지도 카드 / 바텀시트
        fab: "0 4px 14px rgba(0,0,0,0.18)",
        card: "0 8px 24px rgba(0,0,0,0.12)",
        sheet: "0 -8px 24px rgba(0,0,0,0.10)",
        ticket: "0 8px 24px rgba(0,0,0,0.12)",
        product: "none",
      },
      fontFamily: {
        sans: ["Pretendard Variable", "Pretendard", "-apple-system", "system-ui", "Roboto", "sans-serif"],
        display: ["Pretendard Variable", "Pretendard", "-apple-system", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        title: "-0.02em",
        bodyTight: "-0.01em",
      },
    },
  },
  plugins: [],
};
export default config;
