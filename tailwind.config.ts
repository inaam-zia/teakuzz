import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cafe: {
          50: "#faf6f1",
          100: "#f3ebe0",
          200: "#e6d4bc",
          300: "#d4b896",
          400: "#c49a6c",
          500: "#b8834f",
          600: "#a66d43",
          700: "#8a5639",
          800: "#714733",
          900: "#5c3b2c",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
