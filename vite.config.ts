import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("/zod/")) return "forms";
          if (id.includes("react-router")) return "router";
          if (id.includes("zustand")) return "state";
          if (id.includes("axios")) return "api";
          if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
        },
      },
    },
  },
});
