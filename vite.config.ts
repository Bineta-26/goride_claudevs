import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Only this one setting is passed to the browser (Google Maps keys are public by design; restrict it by website in Google Cloud).
  define: {
    __GOOGLE_MAPS_API_KEY__: JSON.stringify(process.env.CONFIG_GOOGLE_MAPS_API_KEY ?? ""),
  },
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
