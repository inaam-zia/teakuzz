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
          50: "var(--brand-bg)",
          100: "var(--brand-bg-top)",
          200: "var(--brand-border)",
          300: "var(--brand-border)",
          400: "var(--brand-accent)",
          500: "var(--brand-subtle)",
          600: "var(--brand-muted)",
          700: "var(--brand-primary)",
          800: "var(--brand-primary-hover)",
          900: "var(--brand-heading)",
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
