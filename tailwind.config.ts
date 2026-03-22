import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#090511",
        panel: "#140d24",
        panelSoft: "#1d1333",
        line: "#34235c",
        accent: "#a855f7",
        accentSoft: "#c084fc",
        danger: "#fb7185",
        muted: "#a78bfa",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(168, 85, 247, 0.22), 0 24px 80px rgba(9, 5, 17, 0.62)",
      },
      backgroundImage: {
        noise:
          "radial-gradient(circle at top, rgba(192, 132, 252, 0.22), transparent 30%), radial-gradient(circle at bottom right, rgba(168, 85, 247, 0.18), transparent 28%)",
      },
    },
  },
  plugins: [],
};

export default config;
