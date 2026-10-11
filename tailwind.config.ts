import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        apple: {
          bg: "#f5f5f7",
          darkBg: "#000000",
          card: "#ffffff",
          subtle: "#fbfbfd",
          border: "rgba(0, 0, 0, 0.08)",
          borderDark: "rgba(255, 255, 255, 0.12)",
          text: "#1d1d1f",
          secondary: "#86868b",
          tertiary: "#a1a1a6",
          blue: {
            DEFAULT: "#0071e3",
            hover: "#0077ed",
            active: "#005bb5",
            light: "rgba(0, 113, 227, 0.08)",
          },
          green: {
            DEFAULT: "#34c759",
            light: "rgba(52, 199, 89, 0.12)",
          },
          amber: {
            DEFAULT: "#ff9500",
            light: "rgba(255, 149, 0, 0.12)",
          },
          red: {
            DEFAULT: "#ff3b30",
            light: "rgba(255, 59, 48, 0.12)",
          },
          purple: {
            DEFAULT: "#af52de",
            light: "rgba(175, 82, 222, 0.12)",
          },
        },
      },
      boxShadow: {
        "apple-sm": "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        "apple-card": "0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)",
        "apple-hover": "0 12px 32px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.03)",
        "apple-modal": "0 24px 48px -12px rgba(0, 0, 0, 0.18)",
        "apple-inner": "inset 0 1px 2px 0 rgba(0, 0, 0, 0.04)",
      },
      borderRadius: {
        "apple-sm": "8px",
        "apple-md": "12px",
        "apple-lg": "16px",
        "apple-xl": "20px",
        "apple-2xl": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
