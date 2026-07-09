import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: __dirname,
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:3010",
      "/socket.io": {
        target: "http://localhost:3010",
        ws: true,
      },
      "/health": "http://localhost:3010",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        login: path.resolve(__dirname, "login.html"),
        chat: path.resolve(__dirname, "chat.html"),
      },
    },
  },
});
