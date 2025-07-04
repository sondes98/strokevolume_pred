import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/simulate": "http://localhost:5050",
      "/stop": "http://localhost:5050",
      "/socket.io": {
        target: "http://localhost:5050",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
