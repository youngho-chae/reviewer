import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#ffffff",
        // CATCHPASS V3 — dark teal + lime accent
        ink: "#002720",
        ink2: "#0E3A33",
        body: "#1A2E2A",
        muted: "#5B6E6A",
        mutedSoft: "#9AA6A3",
        hairline: "#E5EAE8",
        hairlineSoft: "#EEF2F0",
        borderStrong: "#9AA6A3",
        surfaceSoft: "#F4F7F4",
        surfaceStrong: "#EAEFEC",
        // brand = accent lime
        brand: "#E1FF51",
        brandActive: "#CDEB3D",
        brandSoft: "rgba(225,255,81,0.22)",
        brandInk: "#002720",
        // grade colors (V3 palette)
        gradeS: "#002720",
        gradeA: "#002720",
        gradeB: "#5B6E6A",
        gradeC: "#9AA6A3",
        gradeN: "#FFFFFF",
        error: "#c0392b",
        success: "#2F8F6B",
        warning: "#E1FF51",
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "22px",
        xl: "32px",
      },
      boxShadow: {
        card: "rgba(0,18,14,0.04) 0 0 0 1px, rgba(0,18,14,0.06) 0 2px 8px 0, rgba(0,18,14,0.12) 0 8px 16px 0",
        ticket: "0 12px 28px rgba(0,18,14,0.18)",
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
