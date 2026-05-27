import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // CATCHPASS adopting Apple design system
        canvas: "#ffffff",
        parchment: "#f5f5f7",
        pearl: "#fafafc",
        // Near-black ink (not pure black)
        ink: "#1d1d1f",
        ink2: "#333333",
        body: "#1d1d1f",
        muted: "#7a7a7a",
        mutedSoft: "#cccccc",
        // Hairlines
        hairline: "#e0e0e0",
        hairlineSoft: "#f0f0f0",
        borderStrong: "#cccccc",
        surfaceSoft: "#f5f5f7",
        surfaceStrong: "#fafafc",
        // Dark tiles
        tile1: "#272729",
        tile2: "#2a2a2c",
        tile3: "#252527",
        // Single Action Blue — every interactive element
        brand: "#0066cc",
        brandActive: "#0066cc",
        brandFocus: "#0071e3",
        brandOnDark: "#2997ff",
        brandSoft: "rgba(0,102,204,0.08)",
        brandInk: "#ffffff",
        // Grades — quiet grayscale ladder, S anchored in ink
        gradeS: "#1d1d1f",
        gradeA: "#333333",
        gradeB: "#7a7a7a",
        gradeC: "#cccccc",
        gradeN: "#ffffff",
        error: "#c0392b",
        success: "#0066cc",
        warning: "#0066cc",
      },
      borderRadius: {
        none: "0px",
        xs: "5px",
        sm: "8px",
        md: "11px",
        lg: "18px",
        xl: "32px",
        pill: "9999px",
      },
      boxShadow: {
        // Single product shadow — only used on photographic surfaces
        product: "rgba(0,0,0,0.22) 3px 5px 30px 0",
        // Cards explicitly have no shadow per Apple system; map to none.
        card: "none",
        ticket: "none",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "system-ui", "Roboto", "sans-serif"],
        display: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        "apple-tight": "-0.022em",
        "apple-tighter": "-0.026em",
      },
    },
  },
  plugins: [],
};
export default config;
