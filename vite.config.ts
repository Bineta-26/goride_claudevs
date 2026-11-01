import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom", "react-router"],
          "map-vendor": ["leaflet", "react-leaflet", "@react-leaflet/core"],
          "chart-vendor": [
            "recharts",
            "d3-array",
            "d3-color",
            "d3-ease",
            "d3-format",
            "d3-interpolate",
            "d3-path",
            "d3-scale",
            "d3-shape",
            "d3-time",
            "d3-time-format",
          ],
          "motion-vendor": ["framer-motion", "motion-dom", "motion-utils"],
        },
      },
    },
  },
});
