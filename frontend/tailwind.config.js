/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        bg: {
          DEFAULT: "#fafafa",
          subtle: "#f5f5f5",
          inset: "#f9fafb",
        },
        border: {
          DEFAULT: "#e5e5e5",
          subtle: "#efefef",
          strong: "#d4d4d4",
        },
        fg: {
          DEFAULT: "#0a0a0a",
          muted: "#737373",
          subtle: "#a3a3a3",
        },
        accent: {
          DEFAULT: "#0a0a0a",
          subtle: "#262626",
        },
        success: {
          DEFAULT: "#16a34a",
          bg: "#f0fdf4",
          border: "#bbf7d0",
        },
        warning: {
          DEFAULT: "#d97706",
          bg: "#fffbeb",
          border: "#fde68a",
        },
        danger: {
          DEFAULT: "#dc2626",
          bg: "#fef2f2",
          border: "#fecaca",
        },
        info: {
          DEFAULT: "#2563eb",
          bg: "#eff6ff",
          border: "#bfdbfe",
        },
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
    },
  },
  plugins: [],
};
