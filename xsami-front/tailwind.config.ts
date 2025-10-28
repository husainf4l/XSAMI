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
        primary: {
          DEFAULT: "#00bfff",
          hover: "#0099cc",
          light: "#33ccff",
          dark: "#0088cc",
        },
        background: {
          primary: "#0A0A0A",
          secondary: "#0F0F0F",
          card: "#1A1A1A",
          hover: "#222222",
          darker: "#050505",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#A1A1A1",
          muted: "#666666",
        },
        border: {
          DEFAULT: "#2A2A2A",
          light: "#333333",
        },
        success: "#10b981",
        danger: "#ef4444",
        warning: "#f59e0b",
        info: "#3b82f6",
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)',
        'medium': '0 4px 6px rgba(0, 0, 0, 0.5)',
        'large': '0 10px 15px rgba(0, 0, 0, 0.6), 0 4px 6px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'float-up': {
          '0%': {
            opacity: '1',
            transform: 'translateY(0) scale(0.5)',
          },
          '10%': {
            transform: 'translateY(-10px) scale(1)',
          },
          '100%': {
            opacity: '0',
            transform: 'translateY(-200px) scale(1.5)',
          },
        },
      },
      animation: {
        'float-up': 'float-up 3s ease-out forwards',
      },
    },
  },
  plugins: [],
};
export default config;
