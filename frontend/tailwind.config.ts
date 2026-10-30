import type { Config } from "tailwindcss";

// Design tokens exported from the Stitch "ResearchConnect AI – Concept v3" project.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7c0320",
        "primary-container": "#9d2235",
        "primary-fixed": "#ffdada",
        "primary-fixed-dim": "#ffb3b5",
        "on-primary": "#ffffff",
        "on-primary-container": "#ffb3b5",
        secondary: "#2e4ed0",
        "secondary-container": "#4b69eb",
        "on-secondary": "#ffffff",
        tertiary: "#373c46",
        "tertiary-container": "#4e535d",
        error: "#ba1a1a",
        background: "#f7f9fb",
        surface: "#f7f9fb",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f6",
        "surface-container": "#eceef0",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "on-surface": "#191c1e",
        "on-surface-variant": "#584142",
        outline: "#8b7071",
        "outline-variant": "#dfbfbf",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2.5rem",
        margin: "2.5rem",
        gutter: "1.5rem",
      },
      fontFamily: {
        headline: ["var(--font-bricolage)", "sans-serif"],
        body: ["var(--font-public-sans)", "sans-serif"],
      },
      fontSize: {
        "headline-xl": ["44px", { lineHeight: "52px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["15px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "20px", fontWeight: "400" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "600" }],
        "label-sm": ["10px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "700" }],
      },
    },
  },
  plugins: [],
};

export default config;
