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
        "excelled-bg": "#1A1A1A",
        "excelled-text": "#33C481",
        "excelled-gradient-from": "#107C41",
        "excelled-gradient-to": "#00FF89",
      },
    },
  },
  plugins: [],
};
export default config;
