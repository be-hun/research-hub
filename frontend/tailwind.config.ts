import type { Config } from "tailwindcss";

// Design tokens from the Stitch project "ResearchConnect – v4 Data Redesign" (design system "ResearchConnect Data").
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F7F5",
        surface: "#FFFFFF",
        line: "#E6E4DF",
        "line-strong": "#D3D0C8",
        ink: "#1C1B19",
        "ink-2": "#4A4843",
        "ink-3": "#6B6862",
        cherry: "#A41E35",
        "cherry-dark": "#7F1528",
        "cherry-tint": "#F8E9EC",
        "active-ink": "#1B6B44",
        "active-bg": "#E5F3EB",
        "soon-ink": "#8A4B00",
        "soon-bg": "#FCF0DC",
        "running-ink": "#1F4E8C",
        "running-bg": "#E6EEF8",
        "stopped-ink": "#8C3B3B",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["52px", { lineHeight: "58px", letterSpacing: "-0.02em", fontWeight: "600" }],
        h1: ["38px", { lineHeight: "46px", letterSpacing: "-0.015em", fontWeight: "600" }],
        h2: ["26px", { lineHeight: "34px", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["19px", { lineHeight: "26px", fontWeight: "600" }],
        lead: ["19px", { lineHeight: "30px" }],
        body: ["16px", { lineHeight: "26px" }],
        small: ["14px", { lineHeight: "21px" }],
        tiny: ["14px", { lineHeight: "20px" }], // the smallest text on the site (accessibility review: 14px minimum)
      },
      maxWidth: { page: "1240px" },
      boxShadow: { card: "0 1px 2px rgba(28,27,25,0.04), 0 4px 16px rgba(28,27,25,0.04)" },
    },
  },
  plugins: [],
};

export default config;
