import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const basePath = process.env.VITE_BASE_PATH || "/";
const basePathWithLeadingSlash =
  basePath === "./" || /^(https?:)?\/\//.test(basePath) || basePath.startsWith("/")
    ? basePath
    : `/${basePath}`;
const normalizedBasePath = basePathWithLeadingSlash.endsWith("/")
  ? basePathWithLeadingSlash
  : `${basePathWithLeadingSlash}/`;

export default defineConfig({
  plugins: [react()],
  base: normalizedBasePath,
  build: {
    outDir: path.resolve(__dirname, "../api/inst/www"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
