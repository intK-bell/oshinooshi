import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#d9eaff",
          200: "#b3d4ff",
          300: "#84b9ff",
          400: "#5395ff",
          500: "#2b6dff",
          600: "#1d52f0",
          700: "#1a44c5",
          800: "#1a3aa0",
          900: "#1a337f",
        },
        status: {
          approved: "#12b76a",
          review: "#f79009",
          rejected: "#f04438",
        },
      },
      boxShadow: {
        card: "0 12px 32px -12px rgba(13, 26, 38, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
