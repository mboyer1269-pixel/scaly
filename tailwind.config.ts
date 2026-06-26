import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        scaly: {
          50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4",
          400: "#2dd4bf", 500: "#14b8a6", 600: "#0f766e", 700: "#115e59",
          800: "#134e4a", 900: "#134e4a", 950: "#042f2e"
        },
        ink: {
          50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1",
          400: "#64748b", 500: "#475569", 600: "#334155", 700: "#1e293b",
          800: "#1e293b", 900: "#0f172a", 950: "#020617"
        }
      }
    }
  },
  plugins: []
};
export default config;
