import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#ffffff",
        ink: "#222222",
        body: "#3f3f3f",
        muted: "#6a6a6a",
        mutedSoft: "#929292",
        hairline: "#dddddd",
        hairlineSoft: "#ebebeb",
        borderStrong: "#c1c1c1",
        surfaceSoft: "#f7f7f7",
        surfaceStrong: "#f2f2f2",
        // CATCHPASS brand: warm orange (체험권 느낌)
        brand: "#ff6a00",
        brandActive: "#e85d00",
        brandSoft: "#fff1e6",
        // grade colors
        gradeS: "#1a1a1a",
        gradeA: "#9333ea",
        gradeB: "#2563eb",
        gradeC: "#16a34a",
        gradeN: "#6a6a6a",
        error: "#c13515",
        success: "#16a34a",
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        xl: "32px",
      },
      boxShadow: {
        card: "rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px 0, rgba(0,0,0,0.1) 0 4px 8px 0",
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
