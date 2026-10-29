import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#211d18",
        espresso: "#2f211c",
        cream: "#f4efe6",
        paper: "#fffdf8",
        olive: "#686947",
        orange: "#c9673a",
        sand: "#d8cbb9",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: { soft: "0 24px 80px rgba(47,33,28,.11)" },
    },
  },
  plugins: [],
} satisfies Config;
