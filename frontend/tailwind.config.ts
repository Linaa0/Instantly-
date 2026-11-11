import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["14px", { lineHeight: "1.5" }],
        base: ["16px", { lineHeight: "1.5" }],
        lg: ["20px", { lineHeight: "1.3" }],
        xl: ["24px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "2xl": ["24px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "3xl": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "4xl": ["48px", { lineHeight: "1.15", letterSpacing: "-0.025em" }],
      },
      colors: {
        background: {
          DEFAULT: "var(--bg-base)",
          secondary: "var(--bg-elevated)",
        },
        surface: {
          DEFAULT: "var(--bg-surface)",
          elevated: "var(--bg-hover)",
        },
        brand: {
          purple: "var(--accent)",
          blue: "var(--accent)",
          violet: "var(--accent-soft)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
      },
      borderRadius: {
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 4px 20px -4px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
